"""Optional: run a learner's circuit on real IBM quantum hardware.

Disabled unless IBM_QUANTUM_TOKEN is set. The free IBM plan includes only a few minutes of
hardware time per month, so circuits are small (≤ 5 qubits, ≤ 30 gates, 256 shots) and
submissions are rate-limited. Uses qiskit-ibm-runtime (checked against v0.50): channel
"ibm_quantum_platform", least-busy backend, transpiled to the backend's native gates, SamplerV2.

Qurious writes basis states big-endian (q0 leftmost); Qiskit's count keys are little-endian,
so they're reversed before being returned.
"""

from __future__ import annotations

import logging
import threading
from dataclasses import dataclass, field
from typing import Protocol

from qiskit import QuantumCircuit

log = logging.getLogger("qurious.hardware")

MAX_QUBITS = 5
MAX_GATES = 30
SHOTS = 256

SINGLE = {"X": "x", "Y": "y", "Z": "z", "H": "h", "S": "s", "Sdg": "sdg", "T": "t", "Tdg": "tdg"}
ROTATIONS = {"RX": "rx", "RY": "ry", "RZ": "rz"}
MULTI = {"CNOT": "cx", "CZ": "cz", "SWAP": "swap", "TOFFOLI": "ccx"}
ARITY = {
    **dict.fromkeys(SINGLE, 1),
    **dict.fromkeys(ROTATIONS, 1),
    "CNOT": 2,
    "CZ": 2,
    "SWAP": 2,
    "TOFFOLI": 3,
}


class CircuitError(ValueError):
    pass


def build_circuit(num_qubits: int, ops: list[dict]) -> QuantumCircuit:
    """Qurious operations → a measured Qiskit circuit, with the same checks as the simulator."""
    if not 1 <= num_qubits <= MAX_QUBITS:
        raise CircuitError(f"Use between 1 and {MAX_QUBITS} qubits")
    if not ops:
        raise CircuitError("Add at least one gate")
    if len(ops) > MAX_GATES:
        raise CircuitError(f"Real hardware runs are limited to {MAX_GATES} gates")
    qc = QuantumCircuit(num_qubits)
    for op in ops:
        gate, qubits = op.get("gate"), op.get("qubits", [])
        if gate not in ARITY:
            raise CircuitError(f"Unknown gate {gate}")
        if len(qubits) != ARITY[gate] or len(set(qubits)) != len(qubits):
            raise CircuitError(f"{gate} needs {ARITY[gate]} different qubit(s)")
        if any(not isinstance(q, int) or not 0 <= q < num_qubits for q in qubits):
            raise CircuitError(f"{gate} uses a qubit outside the circuit")
        if gate in SINGLE:
            getattr(qc, SINGLE[gate])(qubits[0])
        elif gate in ROTATIONS:
            theta = op.get("theta")
            if not isinstance(theta, (int, float)):
                raise CircuitError(f"{gate} needs an angle")
            getattr(qc, ROTATIONS[gate])(theta, qubits[0])
        else:
            getattr(qc, MULTI[gate])(*qubits)
    qc.measure_all()
    return qc


def to_big_endian(counts: dict[str, int]) -> dict[str, int]:
    return {key[::-1]: n for key, n in counts.items()}


@dataclass
class Submitted:
    job_id: str
    backend: str
    pending_jobs: int | None


@dataclass
class JobState:
    status: str  # INITIALIZING, QUEUED, RUNNING, DONE, ERROR, CANCELLED
    backend: str
    counts: dict[str, int] = field(default_factory=dict)
    error: str | None = None


class Runner(Protocol):
    def submit(self, circuit: QuantumCircuit) -> Submitted: ...

    def state(self, job_id: str) -> JobState: ...


class IBMRunner:
    def __init__(self, token: str, instance: str | None = None):
        self.token, self.instance = token, instance or None
        self._service = None
        self._lock = threading.Lock()

    def _svc(self):
        from qiskit_ibm_runtime import QiskitRuntimeService  # heavy import, only when used

        with self._lock:
            if self._service is None:
                self._service = QiskitRuntimeService(
                    channel="ibm_quantum_platform", token=self.token, instance=self.instance
                )
        return self._service

    def submit(self, circuit: QuantumCircuit) -> Submitted:
        from qiskit.transpiler import generate_preset_pass_manager
        from qiskit_ibm_runtime import SamplerV2

        service = self._svc()
        backend = service.least_busy(
            operational=True, simulator=False, min_num_qubits=circuit.num_qubits
        )
        isa = generate_preset_pass_manager(backend=backend, optimization_level=1).run(circuit)
        job = SamplerV2(mode=backend).run([isa], shots=SHOTS)
        try:
            pending = backend.status().pending_jobs
        except Exception:  # noqa: BLE001 - queue length is nice to have, not essential
            pending = None
        return Submitted(job.job_id(), backend.name, pending)

    def state(self, job_id: str) -> JobState:
        job = self._svc().job(job_id)
        status = str(job.status())
        backend = job.backend().name
        if status == "DONE":
            counts = job.result()[0].data.meas.get_counts()
            return JobState(status, backend, to_big_endian(counts))
        if status in ("ERROR", "CANCELLED"):
            return JobState(status, backend, error=str(job.error_message() or "The job failed"))
        return JobState(status, backend)
