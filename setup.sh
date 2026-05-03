#!/usr/bin/env bash
# ethereum-code installer — idempotent. Target: first command to running dApp < 2 minutes.
# usage:  curl -fsSL https://ethereum-code.vercel.app/setup.sh | bash

set -euo pipefail

CYAN="$(printf '\033[36m')"
DIM="$(printf '\033[2m')"
GOOD="$(printf '\033[32m')"
WARN="$(printf '\033[33m')"
BAD="$(printf '\033[31m')"
BOLD="$(printf '\033[1m')"
END="$(printf '\033[0m')"

say()   { printf "  ${CYAN}●${END} %s\n" "$*"; }
ok()    { printf "  ${GOOD}✓${END} %s\n" "$*"; }
warn()  { printf "  ${WARN}✗${END} %s\n" "$*"; }
bail()  { printf "  ${BAD}✗${END} %s\n" "$*" >&2; exit 1; }
hdr()   { printf "\n${BOLD}%s${END}  ${DIM}%s${END}\n" "$1" "$2"; }

hdr "ethereum-code" "idea → build → ship → audit → raise"

# --- 1. node -----------------------------------------------------------------
if command -v node >/dev/null 2>&1; then
  NODE_MAJOR="$(node -v | sed 's/v//' | cut -d. -f1)"
  if [ "$NODE_MAJOR" -ge 20 ]; then
    ok "node $(node -v)"
  else
    bail "node >= 20 required (found $(node -v)). install via nvm or fnm."
  fi
else
  bail "node not found. install node >= 20 via nvm (https://nvm.sh) and re-run."
fi

# --- 2. foundry --------------------------------------------------------------
if command -v forge >/dev/null 2>&1; then
  ok "foundry $(forge --version | head -n1)"
else
  say "installing foundry"
  curl -L https://foundry.paradigm.xyz | bash >/dev/null 2>&1 || true
  # shellcheck disable=SC1090
  [ -f "$HOME/.foundry/bin/foundryup" ] && source "$HOME/.bashrc" 2>/dev/null || true
  if command -v foundryup >/dev/null 2>&1; then
    foundryup >/dev/null
  else
    warn "run 'foundryup' in a new shell, then re-run this installer."
  fi
fi

# --- 3. slither (optional but recommended) -----------------------------------
if command -v slither >/dev/null 2>&1; then
  ok "slither $(slither --version 2>&1 | head -n1)"
else
  warn "slither not installed (optional). install with: pip install slither-analyzer"
fi

# --- 4. ethereum-code global --------------------------------------------------
say "installing ethereum-code (npm global)"
if command -v pnpm >/dev/null 2>&1; then
  pnpm add -g ethereum-code >/dev/null
elif command -v npm >/dev/null 2>&1; then
  npm i -g ethereum-code >/dev/null
else
  bail "no npm or pnpm found."
fi
ok "eth CLI installed"

# --- 5. config ---------------------------------------------------------------
CFG_DIR="$HOME/.ethereum-code"
CFG_FILE="$CFG_DIR/config.toml"
mkdir -p "$CFG_DIR"
if [ ! -f "$CFG_FILE" ]; then
  cat > "$CFG_FILE" <<'TOML'
# ethereum-code config — edit to taste.
# Never commit this file.
chain            = "base"
rpc              = ""
anthropic_key    = ""
wallet_key_path  = "~/.foundry/keystores/default"
etherscan_key    = ""
TOML
  ok "wrote $CFG_FILE (placeholder — edit to set chain, rpc, keys)"
else
  ok "config $CFG_FILE already exists (leaving alone)"
fi

# --- 6. doctor ---------------------------------------------------------------
hdr "doctor" "verifying toolchain"
if eth doctor; then
  ok "toolchain ok"
else
  warn "doctor reported issues. fix them and re-run 'eth doctor'."
fi

# --- 7. install agent skills -------------------------------------------------
hdr "skills" "installing slash-command skills"
if eth init >/dev/null 2>&1; then
  ok "skills installed to ~/.claude/skills and ~/.codex/skills"
else
  warn "could not install skills. run 'eth init' manually."
fi

ok "ready. run: ${BOLD}eth new${END}"
