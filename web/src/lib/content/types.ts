/**
 * Types for the YAML content in /content. The authoritative schema (and validation) lives in
 * api/app/content/schema.py; these mirror it for the web app.
 */
import type { GateName } from "@/lib/quantum";

export type InteractiveType =
  | "bit_switches"
  | "coin_sampler"
  | "amplitude_bars"
  | "bloch_sphere"
  | "measurement_lab"
  | "circuit_sandbox"
  | "bell_lab"
  | "cloning_attempt"
  | "teleport_lab";

export type RewardType = "bell_signal_game" | "teleport_lab" | "coming_soon";

/** Gate ids used in content (a subset of the simulator's gates). */
export type PuzzleGate = Extract<
  GateName,
  "X" | "Y" | "Z" | "H" | "S" | "T" | "CNOT" | "CZ" | "SWAP" | "TOFFOLI"
>;

export interface Check {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
  misconception_addressed?: string;
}

export interface MathLayer {
  level: number;
  latex: string;
  plain_english: string;
}

export interface CircuitGoalPuzzle {
  type: "circuit_goal";
  prompt: string;
  num_qubits: number;
  allowed_gates: PuzzleGate[];
  target_probabilities: Record<string, number>;
  target_amplitudes?: Record<string, [number, number]> | null;
  max_gates?: number | null;
  required_gates?: PuzzleGate[];
  hints: string[];
}

export interface NumericPuzzle {
  type: "numeric";
  prompt: string;
  answer: number;
  tolerance: number;
  hints: string[];
}

export type Puzzle = CircuitGoalPuzzle | NumericPuzzle;

export interface Concept {
  id: string;
  title: string;
  summary: string;
  status: "stub" | "draft" | "reviewed";
  prerequisites: string[];
  estimated_minutes: number;
  hook: string;
  question_hooks: Record<string, string>;
  intuition: { analogy: string; where_it_breaks: string } | null;
  interactive: {
    type: InteractiveType;
    props: Record<string, unknown>;
    caption: string;
  } | null;
  math: MathLayer[];
  puzzle: Puzzle | null;
  checks: Check[];
  diagnostic: Check[];
  alt_explanation: string;
  common_misconceptions: string[];
}

export interface Question {
  id: string;
  question: string;
  status: "draft" | "reviewed";
  enabled: boolean;
  order: number;
  preview: string;
  targets: string[];
  reward: { type: RewardType; title: string; description: string };
}
