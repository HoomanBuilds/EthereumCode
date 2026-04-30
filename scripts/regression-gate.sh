#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "→ typecheck"
npm run typecheck

echo "→ build"
npm run build

echo "→ doctor"
node dist/index.js doctor

echo "→ skill loader integrity"
npx tsx scripts/check-skills.ts

echo "→ catalog integrity (if present)"
if [ -f scripts/check-catalogs.ts ]; then
  npx tsx scripts/check-catalogs.ts
else
  echo "  (skipped — P2 not yet shipped)"
fi

echo "→ help smoke"
cmds=$(node dist/index.js --help 2>&1 | awk '/^    [a-z]/ {print $1}')
if [ -z "$cmds" ]; then
  echo "  ✗ help smoke discovered zero commands — awk pattern broken"
  exit 1
fi
for cmd in $cmds; do
  node dist/index.js "$cmd" --help >/dev/null
done

echo "→ forge test (templates/defi-vault)"
( cd templates/defi-vault && forge test )

echo "✓ regression gate passed"
