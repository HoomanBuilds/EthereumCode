# skills

Bundled snapshot of the [ethskills](https://github.com/ethskills/ethskills) knowledge base.

These files are loaded directly from disk by `cli/skills/loader.ts` and injected into every Claude invocation as grounded context. **No runtime fetching.** No network dependency. What you see here is what every agent sees.

## contents

| file | purpose |
| ---- | ------- |
| `ship.md` | end-to-end dApp deployment flow (master guide) |
| `concepts.md` | mental models for onchain state |
| `l2s.md` | Layer 2 selection reasoning |
| `standards.md` | ERC token standards |
| `why.md` | why Ethereum (vs other chains) |
| `security.md` | defensive patterns |
| `tools.md` | frameworks & libraries |
| `addresses.md` | verified contract addresses — never hallucinate |
| `gas.md` | live gas cost reality |
| `testing.md` | Foundry testing patterns |
| `frontend-ux.md` | UX rules (three-button flow, etc.) |
| `frontend-playbook.md` | Scaffold-ETH 2 patterns |
| `wallets.md` | wallet integrations |
| `orchestration.md` | three-phase build system |
| `audit.md` | audit methodology (500+ checklist items) |
| `qa.md` | pre-ship QA checklist |
| `building-blocks.md` | DeFi composability (Money Legos) |
| `indexing.md` | onchain data queries (The Graph, Ponder) |
| `noir.md` | zero-knowledge privacy |
| `protocol.md` | EIP lifecycle and upgrades |

## refreshing

These files are a snapshot. To pull newer versions, re-run the fetch from the ethskills repo or:

```bash
for s in ship concepts l2s standards why security tools addresses gas testing \
         frontend-ux frontend-playbook wallets orchestration audit qa \
         building-blocks indexing noir protocol; do
  curl -sSf -o "skills/$s.md" "https://ethskills.com/$s/SKILL.md"
done
```

## license

ethskills is MIT-licensed. Upstream: https://github.com/ethskills/ethskills
