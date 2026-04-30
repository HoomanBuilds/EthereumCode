#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "→ typecheck"
npm run typecheck

echo "→ build"
npm run build

echo "→ doctor"
node dist/index.js doctor >/dev/null

echo "→ skill loader integrity"
npx tsx scripts/check-skills.ts

echo "→ catalog integrity (if present)"
[ -f scripts/check-catalogs.ts ] && npx tsx scripts/check-catalogs.ts || echo "  (skipped — P2 not yet shipped)"

echo "→ help smoke"
for cmd in $(node dist/index.js --help 2>&1 | awk '/^    [a-z]/ {print $1}'); do
  node dist/index.js "$cmd" --help >/dev/null
done

echo "→ forge test (templates/defi-vault)"
( cd templates/defi-vault && forge test >/dev/null )

echo "✓ regression gate passed"
