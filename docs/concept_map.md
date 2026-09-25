# Concept map (proposed, pending the content owner's approval)

31 concepts. The brief's starting list was cross-checked against the course's topic order, and two concepts were added that the entry questions need but the starting list didn't have: **quantum advantage** and **applications**. Each concept is a YAML file in `content/concepts/`.

**Status key:**
- **draft**: full lesson written, awaiting your review.
- **stub**: in the map (so paths and question routing work), but no lesson yet.

Lessons were drafted for every concept on the paths of the two v1 journeys ("Is entanglement faster than light?" and "Is quantum teleportation real teleportation?"), plus the Bloch sphere.

## Foundations
| id | Concept | Prerequisites | Status |
| --- | --- | --- | --- |
| `classical_bits` | Bits and logic gates | — | draft |
| `probability_basics` | Probability basics | — | draft |
| `complex_numbers` | Complex numbers (light) | — | stub |
| `vectors_and_kets` | State vectors and ket notation | probability_basics | draft |

## One qubit
| id | Concept | Prerequisites | Status |
| --- | --- | --- | --- |
| `qubit` | The qubit | classical_bits, vectors_and_kets | draft |
| `superposition` | Superposition | qubit | draft |
| `measurement` | Measurement | superposition | draft |
| `bloch_sphere` | The Bloch sphere | measurement, complex_numbers | draft |
| `quantum_gates` | Quantum gates: X, Z, H and circuits | measurement | draft |
| `phase` | Phase (relative vs. global, S and T) | quantum_gates, bloch_sphere | stub |
| `interference` | Interference | phase | stub |

## Many qubits
| id | Concept | Prerequisites | Status |
| --- | --- | --- | --- |
| `multiple_qubits` | Multiple qubits and the tensor product | quantum_gates | draft |
| `cnot` | CNOT and two-qubit gates | multiple_qubits, classical_bits | draft |
| `entanglement` | Entanglement | cnot | draft |
| `bell_states` | Bell states | entanglement | draft |
| `no_cloning` | No-cloning | entanglement | draft |
| `no_signaling` | No-signaling: why entanglement can't send messages | bell_states | draft |
| `teleportation` | Quantum teleportation | bell_states, no_cloning, no_signaling | draft |

## Computation and algorithms
| id | Concept | Prerequisites | Status |
| --- | --- | --- | --- |
| `reversible_computation` | Reversible computation (Toffoli) | cnot | stub |
| `deutsch_jozsa` | Oracles, phase kickback and Deutsch–Jozsa | interference, cnot | stub |
| `grover` | Grover's search | deutsch_jozsa | stub |
| `qft_period_finding` | QFT and period finding (intuition) | interference, multiple_qubits | stub |
| `quantum_advantage` | Quantum advantage and complexity (P, BQP) | interference, entanglement | stub |
| `shor` | Shor's algorithm (intuition) | qft_period_finding, public_key_crypto | stub |

## Cryptography
| id | Concept | Prerequisites | Status |
| --- | --- | --- | --- |
| `public_key_crypto` | RSA and ECC basics | classical_bits | stub |
| `post_quantum_crypto` | Post-quantum cryptography | shor, grover | stub |

## Hardware and the real world
| id | Concept | Prerequisites | Status |
| --- | --- | --- | --- |
| `decoherence` | Decoherence and noise | measurement, entanglement | stub |
| `physical_qubits` | Physical qubits (superconducting, ions, photons, atoms) | decoherence | stub |
| `error_correction` | Error correction (intuition) | decoherence, cnot | stub |
| `interpretations` | Interpretations of quantum mechanics (brief) | measurement, entanglement | stub |
| `quantum_applications` | What quantum computers are useful for | quantum_advantage, physical_qubits | stub |

## Entry questions → targets
| # | Question | Targets | v1 |
| --- | --- | --- | --- |
| 1 | Can quantum computers break my passwords or Bitcoin? | shor, grover, post_quantum_crypto | coming soon |
| 2 | Did Google prove that parallel universes exist? | quantum_advantage, interpretations | coming soon |
| 3 | Why are quantum computers supposed to be so fast? | quantum_advantage, grover | coming soon |
| 4 | Is quantum computing real, or just hype? | physical_qubits, error_correction, quantum_advantage | coming soon |
| 5 | Why do quantum computers need to be so cold? | physical_qubits | coming soon |
| 6 | Is entanglement faster than light? | no_signaling | **enabled** |
| 7 | Is quantum teleportation real teleportation? | teleportation | **enabled** |
| 8 | What will quantum computers actually be useful for? | quantum_applications | coming soon |

## Choices to review
- **Why questions 6 and 7 for v1:** they share most of their path (qubit → measurement → entanglement → Bell states), so two complete journeys needed 14 authored lessons instead of about 25. Their rewards are hands-on (try to signal through entanglement; teleport a qubit you prepared). "Bitcoin" is the most popular question, but its path runs through nearly the whole map.
- **Complex numbers are not required before the qubit.** Every lesson on the v1 paths uses real amplitudes (plus signs), and says honestly that amplitudes can be complex in general. Complex numbers become required at the Bloch sphere and phase.
- **No-cloning sits after entanglement.** The intuitive argument ("a CNOT copier works for 0 and 1 but turns |+⟩ into an entangled pair instead of two copies") needs entanglement.
- **Folded in:** Bernstein–Vazirani into `deutsch_jozsa`, and phase estimation into `qft_period_finding`. Variational algorithms and annealing go into `quantum_applications`.
