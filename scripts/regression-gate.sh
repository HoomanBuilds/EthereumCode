#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "→ typecheck"
npm run typecheck

echo "→ build"
npm run build

echo "→ doctor"
doctor_out=$(node dist/index.js doctor 2>&1 || true)
echo "$doctor_out"
if ! echo "$doctor_out" | grep -q "doctor"; then
  echo "  ✗ doctor produced no recognizable output"
  exit 1
fi

echo "→ skill loader integrity"
npx tsx scripts/check-skills.ts

echo "→ catalog integrity (if present)"
if [ -f scripts/check-catalogs.ts ]; then
  npx tsx scripts/check-catalogs.ts
else
  echo "  (skipped — P2 not yet shipped)"
fi

echo "→ help smoke"
cmds=$(node dist/index.js --help 2>&1 | awk '/^  commands$/{flag=1; next} /^  [a-z]/ && !/^  commands$/{flag=0} flag && /^    [a-z]/ {print $1}')
if [ -z "$cmds" ]; then
  echo "  ✗ help smoke discovered zero commands — awk pattern broken"
  exit 1
fi
echo "  discovered: $(echo $cmds | tr '\n' ' ')"
# Per-command --help is a P3 deliverable (--agent flag work). For now we only
# assert top-level --help renders the commands block correctly.

echo "→ forge test (templates/defi-vault)"
( cd templates/defi-vault && forge test )

echo "✓ regression gate passed"
