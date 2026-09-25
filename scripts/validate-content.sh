#!/usr/bin/env bash
# Validates everything in content/: schema, prerequisites, cycles, dead ends, puzzle solvability
# (Python), and that every math block renders with KaTeX (Node).
# Needs the "qurious" Python env active.
set -euo pipefail
cd "$(dirname "$0")/.."
(cd api && python -m app.content.validate)
(cd web && npm run -s content:math)
