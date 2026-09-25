#!/usr/bin/env bash
# Runs N random circuits (default 50) through our TypeScript simulator and Qiskit-Aer
# and checks that they agree. Needs the "qurious" Python env active (for qiskit).
set -euo pipefail
cd "$(dirname "$0")/.."
count="${1:-50}"
tmp="$(mktemp -d)/sim-crosscheck.json"
(cd web && npm run -s sim:export -- "$tmp" "$count")
python api/scripts/crosscheck_simulator.py "$tmp"
