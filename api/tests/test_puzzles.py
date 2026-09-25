import numpy as np
import pytest
from qiskit import QuantumCircuit
from qiskit.quantum_info import Statevector

from app.content.puzzles import apply, meets_goal, shortest_solution
from app.content.schema import CircuitGoalPuzzle

S2 = np.sqrt(0.5)


def puzzle(**kwargs) -> CircuitGoalPuzzle:
    return CircuitGoalPuzzle.model_validate({"type": "circuit_goal", "prompt": "p", **kwargs})


def run(n, ops):
    state = np.zeros(2**n, dtype=complex)
    state[0] = 1
    for gate, qubits in ops:
        state = apply(state, gate, qubits, n)
    return state


QISKIT = {"X": "x", "Y": "y", "Z": "z", "H": "h", "S": "s", "T": "t"}
QISKIT_MULTI = {"CNOT": "cx", "CZ": "cz", "SWAP": "swap", "TOFFOLI": "ccx"}


@pytest.mark.parametrize("seed", range(20))
def test_numpy_simulator_matches_qiskit(seed):
    """The validator's little simulator must agree with Qiskit (big-endian vs little-endian)."""
    rng = np.random.default_rng(seed)
    n = 3
    ops = []
    for _ in range(15):
        gate = rng.choice([*QISKIT, *QISKIT_MULTI])
        arity = {"CNOT": 2, "CZ": 2, "SWAP": 2, "TOFFOLI": 3}.get(gate, 1)
        ops.append((str(gate), tuple(int(q) for q in rng.permutation(n)[:arity])))
    qc = QuantumCircuit(n)
    for gate, qubits in ops:
        getattr(qc, QISKIT.get(gate) or QISKIT_MULTI[gate])(*qubits)
    expected = Statevector(qc).reverse_qargs().data
    np.testing.assert_allclose(run(n, ops), expected, atol=1e-12)


def test_meets_goal_checks_probabilities():
    p = puzzle(allowed_gates=["H"], target_probabilities={"0": 0.5, "1": 0.5})
    assert meets_goal(run(1, [("H", (0,))]), p)
    assert not meets_goal(run(1, []), p)


def test_meets_goal_checks_phase_when_amplitudes_are_given():
    plus = puzzle(
        allowed_gates=["H", "X"],
        target_probabilities={"0": 0.5, "1": 0.5},
        target_amplitudes={"0": [S2, 0], "1": [S2, 0]},
    )
    assert meets_goal(run(1, [("H", (0,))]), plus)  # |+⟩
    assert not meets_goal(run(1, [("X", (0,)), ("H", (0,))]), plus)  # |−⟩
    # A global phase doesn't matter: −|+⟩ still counts.
    assert meets_goal(-run(1, [("H", (0,))]), plus)


def test_shortest_solution_finds_minimal_circuits():
    bell = puzzle(
        num_qubits=2, allowed_gates=["H", "CNOT"], target_probabilities={"00": 0.5, "11": 0.5}
    )
    assert shortest_solution(bell) == [("H", (0,)), ("CNOT", (0, 1))]


def test_required_gates_are_enforced():
    p = puzzle(
        num_qubits=2,
        allowed_gates=["X", "CNOT"],
        required_gates=["CNOT"],
        max_gates=2,
        target_probabilities={"11": 1},
    )
    solution = shortest_solution(p)
    assert solution is not None and "CNOT" in [g for g, _ in solution]


def test_unsolvable_puzzle_is_detected():
    # Z alone can never move |0⟩ anywhere.
    assert shortest_solution(puzzle(allowed_gates=["Z"], target_probabilities={"1": 1})) is None
