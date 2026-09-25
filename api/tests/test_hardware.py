"""Real-hardware runs, with IBM faked: circuit building, bit order, limits, and job polling."""

import pytest
from fastapi.testclient import TestClient
from qiskit.quantum_info import Statevector

from app.hardware import CircuitError, JobState, Submitted, build_circuit, to_big_endian
from app.main import app
from app.routes import hardware


def test_circuit_building_matches_our_gates():
    qc = build_circuit(2, [{"gate": "H", "qubits": [0]}, {"gate": "CNOT", "qubits": [0, 1]}])
    qc.remove_final_measurements()
    probs = Statevector(qc).probabilities_dict()
    assert probs == pytest.approx({"00": 0.5, "11": 0.5})


def test_qiskit_counts_are_converted_to_big_endian():
    # X on q0 of 2 qubits: Qiskit reports "01" (q0 is rightmost); Qurious writes "10".
    assert to_big_endian({"01": 256}) == {"10": 256}


@pytest.mark.parametrize(
    "num_qubits, ops, message",
    [
        (6, [{"gate": "X", "qubits": [0]}], "between 1 and 5"),
        (1, [], "at least one gate"),
        (1, [{"gate": "X", "qubits": [0]}] * 31, "30 gates"),
        (1, [{"gate": "FOO", "qubits": [0]}], "Unknown gate"),
        (2, [{"gate": "CNOT", "qubits": [0, 0]}], "different qubit"),
        (1, [{"gate": "X", "qubits": [3]}], "outside the circuit"),
        (1, [{"gate": "RX", "qubits": [0]}], "needs an angle"),
    ],
)
def test_bad_circuits_are_rejected(num_qubits, ops, message):
    with pytest.raises(CircuitError, match=message):
        build_circuit(num_qubits, ops)


class FakeRunner:
    def __init__(self):
        self.submitted = []

    def submit(self, circuit):
        self.submitted.append(circuit)
        return Submitted("job-1", "ibm_fake", pending_jobs=12)

    def state(self, job_id):
        return JobState("DONE", "ibm_fake", {"00": 120, "11": 130, "01": 6})


@pytest.fixture
def client(monkeypatch):
    hardware.submit_limiter._hits.clear()
    return TestClient(app)


def test_disabled_without_a_token(client, monkeypatch):
    monkeypatch.setattr(hardware, "get_runner", lambda: None)
    assert client.get("/hardware/status").json()["available"] is False
    body = {"num_qubits": 1, "ops": [{"gate": "H", "qubits": [0]}]}
    assert client.post("/hardware/jobs", json=body).status_code == 404


def test_submit_and_poll(client, monkeypatch):
    runner = FakeRunner()
    monkeypatch.setattr(hardware, "get_runner", lambda: runner)
    body = {
        "num_qubits": 2,
        "ops": [{"gate": "H", "qubits": [0]}, {"gate": "CNOT", "qubits": [0, 1]}],
    }
    res = client.post("/hardware/jobs", json=body).json()
    assert res == {"job_id": "job-1", "backend": "ibm_fake", "pending_jobs": 12}
    assert client.get("/hardware/jobs/job-1").json()["counts"]["11"] == 130


def test_submissions_are_rate_limited(client, monkeypatch):
    monkeypatch.setattr(hardware, "get_runner", lambda: FakeRunner())
    body = {"num_qubits": 1, "ops": [{"gate": "H", "qubits": [0]}]}
    codes = [client.post("/hardware/jobs", json=body).status_code for _ in range(4)]
    assert codes == [200, 200, 200, 429]


def test_invalid_circuits_never_reach_ibm(client, monkeypatch):
    runner = FakeRunner()
    monkeypatch.setattr(hardware, "get_runner", lambda: runner)
    body = {"num_qubits": 2, "ops": [{"gate": "CNOT", "qubits": [1, 1]}]}
    assert client.post("/hardware/jobs", json=body).status_code == 422
    assert runner.submitted == []
