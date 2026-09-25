"""Cross-check our TypeScript simulator against Qiskit-Aer.

Reads the JSON written by `npm run sim:export` (in web/), rebuilds every circuit in Qiskit,
runs it on Aer's statevector simulator, and compares:
  * measurement probabilities (what learners see), and
  * the full amplitudes, which is stricter: it also checks phases.

Our simulator is big-endian (q0 is the leftmost bit), Qiskit is little-endian, so
Qiskit's statevector is reversed before comparing.

Usage: python scripts/crosscheck_simulator.py path/to/sim-crosscheck.json
Exits with status 1 if any circuit disagrees.
"""

import json
import sys

import numpy as np
from qiskit import QuantumCircuit, transpile
from qiskit.quantum_info import Statevector
from qiskit_aer import AerSimulator

TOLERANCE = 1e-9

SINGLE = {
    "I": "id",
    "X": "x",
    "Y": "y",
    "Z": "z",
    "H": "h",
    "S": "s",
    "Sdg": "sdg",
    "T": "t",
    "Tdg": "tdg",
}
ROTATIONS = {"RX": "rx", "RY": "ry", "RZ": "rz"}
MULTI = {"CNOT": "cx", "CZ": "cz", "SWAP": "swap", "TOFFOLI": "ccx"}


def build(circuit: dict) -> QuantumCircuit:
    qc = QuantumCircuit(circuit["numQubits"])
    for op in circuit["ops"]:
        gate, qubits = op["gate"], op["qubits"]
        if gate in SINGLE:
            getattr(qc, SINGLE[gate])(qubits[0])
        elif gate in ROTATIONS:
            getattr(qc, ROTATIONS[gate])(op["theta"], qubits[0])
        elif gate in MULTI:
            getattr(qc, MULTI[gate])(*qubits)
        else:
            raise ValueError(f"Unknown gate {gate}")
    qc.save_statevector()
    return qc


def main(path: str) -> int:
    with open(path) as f:
        data = json.load(f)
    assert data["convention"] == "big-endian"
    backend = AerSimulator(method="statevector")
    failures = 0
    worst_prob = worst_amp = 0.0

    for i, circuit in enumerate(data["circuits"]):
        qc = build(circuit)
        # optimization_level=0 runs the circuit exactly as built. Higher levels may remove
        # SWAP gates and record them as a qubit relabeling instead, which permutes the
        # saved statevector and makes a correct simulator look wrong.
        result = backend.run(transpile(qc, backend, optimization_level=0)).result()
        # reverse_qargs() turns Qiskit's little-endian order into our big-endian order.
        aer = Statevector(result.get_statevector()).reverse_qargs().data
        ours = np.array([complex(re, im) for re, im in circuit["amplitudes"]])

        prob_diff = float(np.max(np.abs(np.abs(aer) ** 2 - np.abs(ours) ** 2)))
        amp_diff = float(np.max(np.abs(aer - ours)))
        worst_prob, worst_amp = max(worst_prob, prob_diff), max(worst_amp, amp_diff)

        if prob_diff > TOLERANCE or amp_diff > TOLERANCE:
            failures += 1
            print(
                f"MISMATCH circuit {i} ({circuit['numQubits']} qubits, {len(circuit['ops'])} ops): "
                f"prob diff {prob_diff:.2e}, amplitude diff {amp_diff:.2e}"
            )

    total = len(data["circuits"])
    print(
        f"{total - failures}/{total} circuits match Qiskit-Aer "
        f"(max probability diff {worst_prob:.1e}, max amplitude diff {worst_amp:.1e})"
    )
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "sim-crosscheck.json"))
