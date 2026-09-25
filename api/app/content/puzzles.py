"""Circuit-goal puzzle logic on the Python side: checking an answer and proving a puzzle solvable.

The browser has its own checker (web/src/lib/puzzles.ts) for instant feedback. This module
uses the same rules, and the content validator uses it to make sure every authored puzzle can
actually be solved with its allowed gates. An unsolvable puzzle would be a dead end for a
learner.

States are big-endian (q0 is the leftmost bit), matching the rest of Qurious.
"""

from __future__ import annotations

from collections import deque
from itertools import permutations

import numpy as np

from app.content.schema import CircuitGoalPuzzle

PROBABILITY_TOLERANCE = 1e-6

_S2 = np.sqrt(0.5)
SINGLE = {
    "X": np.array([[0, 1], [1, 0]], dtype=complex),
    "Y": np.array([[0, -1j], [1j, 0]], dtype=complex),
    "Z": np.array([[1, 0], [0, -1]], dtype=complex),
    "H": np.array([[_S2, _S2], [_S2, -_S2]], dtype=complex),
    "S": np.array([[1, 0], [0, 1j]], dtype=complex),
    "T": np.array([[1, 0], [0, np.exp(1j * np.pi / 4)]], dtype=complex),
}
ARITY = {"CNOT": 2, "CZ": 2, "SWAP": 2, "TOFFOLI": 3}


def apply(state: np.ndarray, gate: str, qubits: tuple[int, ...], n: int) -> np.ndarray:
    """Apply one gate to an n-qubit big-endian state vector."""
    psi = state.reshape([2] * n)  # axis q is qubit q, because the order is big-endian
    if gate in SINGLE:
        psi = np.moveaxis(np.tensordot(SINGLE[gate], psi, axes=([1], [qubits[0]])), 0, qubits[0])
    elif gate in ("CNOT", "CZ", "TOFFOLI"):
        *controls, target = qubits
        index = [slice(None)] * n
        for c in controls:
            index[c] = 1
        idx = tuple(index)
        sub = psi[idx].copy()
        # After fixing the controls, the target's axis index shifts left by the number of
        # control axes that came before it.
        axis = target - sum(1 for c in controls if c < target)
        matrix = SINGLE["Z"] if gate == "CZ" else SINGLE["X"]
        sub = np.moveaxis(np.tensordot(matrix, sub, axes=([1], [axis])), 0, axis)
        psi = psi.copy()
        psi[idx] = sub
    elif gate == "SWAP":
        psi = np.swapaxes(psi, qubits[0], qubits[1])
    else:
        raise ValueError(f"unknown gate {gate}")
    return psi.reshape(-1)


def _label(index: int, n: int) -> str:
    return format(index, f"0{n}b")


def meets_goal(state: np.ndarray, puzzle: CircuitGoalPuzzle) -> bool:
    """True if `state` satisfies the puzzle's target (probabilities, and amplitudes if given)."""
    n = puzzle.num_qubits
    probs = np.abs(state) ** 2
    for i, p in enumerate(probs):
        want = puzzle.target_probabilities.get(_label(i, n), 0.0)
        if abs(p - want) > PROBABILITY_TOLERANCE:
            return False
    if puzzle.target_amplitudes:
        target = np.array(
            [complex(*puzzle.target_amplitudes.get(_label(i, n), (0, 0))) for i in range(2**n)]
        )
        target = target / np.linalg.norm(target)
        # Equal up to a global phase ⇔ |⟨target|state⟩| = 1.
        if abs(abs(np.vdot(target, state)) - 1) > PROBABILITY_TOLERANCE:
            return False
    return True


def moves(puzzle: CircuitGoalPuzzle) -> list[tuple[str, tuple[int, ...]]]:
    """Every (gate, qubits) placement the puzzle allows."""
    n = puzzle.num_qubits
    result = []
    for gate in puzzle.allowed_gates:
        arity = ARITY.get(gate, 1)
        result.extend((gate, qubits) for qubits in permutations(range(n), arity))
    return result


def uses_required_gates(gates: list[str], puzzle: CircuitGoalPuzzle) -> bool:
    return set(puzzle.required_gates) <= set(gates)


def shortest_solution(puzzle: CircuitGoalPuzzle, max_depth: int = 6) -> list | None:
    """Breadth-first search for the fewest gates that solve the puzzle (None if none found).

    Search nodes are (state up to global phase, which required gates were used), so the search
    stays small for 1–3 qubits and respects `required_gates`.
    """
    n = puzzle.num_qubits
    limit = min(max_depth, puzzle.max_gates or max_depth)
    start = np.zeros(2**n, dtype=complex)
    start[0] = 1
    if meets_goal(start, puzzle) and not puzzle.required_gates:
        return []

    def key(state: np.ndarray) -> bytes:
        # Remove the global phase by making the first nonzero amplitude real and positive.
        nz = np.flatnonzero(np.abs(state) > 1e-9)[0]
        phase = state[nz] / abs(state[nz])
        return np.round(state / phase, 6).tobytes()

    required = frozenset(puzzle.required_gates)
    seen = {(key(start), frozenset())}
    queue = deque([(start, [])])
    all_moves = moves(puzzle)
    while queue:
        state, path = queue.popleft()
        if len(path) >= limit:
            continue
        for gate, qubits in all_moves:
            nxt = apply(state, gate, qubits, n)
            step = [*path, (gate, qubits)]
            used = frozenset(g for g, _ in step) & required
            k = (key(nxt), used)
            if k in seen:
                continue
            seen.add(k)
            if used == required and meets_goal(nxt, puzzle):
                return step
            queue.append((nxt, step))
    return None
