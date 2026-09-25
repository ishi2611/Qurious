"""Guards the cross-check script itself, so a bug there can't hide a bug in the simulator."""

import importlib.util
import json
import math
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "crosscheck_simulator.py"
spec = importlib.util.spec_from_file_location("crosscheck", SCRIPT)
crosscheck = importlib.util.module_from_spec(spec)
spec.loader.exec_module(crosscheck)

S = math.sqrt(0.5)


def write(tmp_path, circuits):
    path = tmp_path / "circuits.json"
    path.write_text(json.dumps({"convention": "big-endian", "circuits": circuits}))
    return str(path)


def test_matching_big_endian_results_pass(tmp_path):
    circuits = [
        # X on q0 of 2 qubits is |10⟩ in big-endian order (index 2)
        {
            "numQubits": 2,
            "ops": [{"gate": "X", "qubits": [0]}],
            "amplitudes": [[0, 0], [0, 0], [1, 0], [0, 0]],
        },
        # Bell state
        {
            "numQubits": 2,
            "ops": [{"gate": "H", "qubits": [0]}, {"gate": "CNOT", "qubits": [0, 1]}],
            "amplitudes": [[S, 0], [0, 0], [0, 0], [S, 0]],
        },
        # A SWAP must stay a real SWAP (regression: transpiler optimizations used to elide it)
        {
            "numQubits": 2,
            "ops": [{"gate": "X", "qubits": [0]}, {"gate": "SWAP", "qubits": [0, 1]}],
            "amplitudes": [[0, 0], [1, 0], [0, 0], [0, 0]],
        },
    ]
    assert crosscheck.main(write(tmp_path, circuits)) == 0


def test_a_wrong_result_is_reported(tmp_path):
    wrong = {"numQubits": 1, "ops": [{"gate": "X", "qubits": [0]}], "amplitudes": [[1, 0], [0, 0]]}
    assert crosscheck.main(write(tmp_path, [wrong])) == 1
