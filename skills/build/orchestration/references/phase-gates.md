# Phase Gates: Validation Between Build Phases

The three-phase build (local → live contracts + local UI → production) only protects against bad ships if each phase **gates** the next. This file is the explicit checklist for each gate, the failure modes that warrant a phase-back, and the bright-line rules that keep the agent from skipping ahead.

For the high-level pipeline, see `SKILL.md`. This is the operational discipline.

## Why gates exist

```
Phase 1 → Phase 2: contracts going live cost real money and gas
Phase 2 → Phase 3: production = users; bugs = lost funds + reputation
```

A bug found in Phase 1 costs ten seconds. Same bug in Phase 3 costs a postmortem. Gates make Phase-1 catches cheap and Phase-3 catches loud.

## Gate 1 → 2: contracts ready for live deployment

Before `yarn deploy --network <real-chain>`, ALL of these must hold:

### Code correctness
- [ ] All Foundry tests pass: `forge test`
- [ ] Coverage ≥ 90% on every contract: `forge coverage --report summary`
- [ ] Fuzz suite ran with `--fuzz-runs 10000` and reverted nothing unexpected
- [ ] Invariant tests defined for any protocol with conserved quantities (TVL, total supply)
- [ ] Slither: `slither . --filter-paths "lib/|node_modules/"` — zero unreviewed High/Medium
- [ ] No `selfdestruct`, no `delegatecall` to user input, no inline assembly without comment

### Audit posture
- [ ] Internal review pass against `audit/SKILL.md` checklist
- [ ] Independent review by a different agent or human (not the builder)
- [ ] Known-issues file (`KNOWN_ISSUES.md`) lists any accepted risk
- [ ] Critical functions documented (function signature → purpose → caller restrictions)

### Deployment plan
- [ ] Deploy script (`packages/foundry/script/Deploy.s.sol`) idempotent
- [ ] Constructor args parameterized via env vars, not hardcoded
- [ ] Post-deploy ownership transfer scripted, not manual
- [ ] Verification command tested on testnet first: `yarn verify --network <testnet>`
- [ ] Etherscan/Sourcify metadata accurate (license, optimizer, runs)

### Funds + keys
- [ ] Deployer is a fresh wallet with only the gas needed (estimate × 2)
- [ ] Deployer key stored in `wallets/SKILL.md`-recommended way (keystore, hardware, KMS)
- [ ] Owner-of-deployment is a multisig, not the deployer EOA
- [ ] If deploying upgrade proxies: timelock contract deployed first

### Network sanity
- [ ] Target chain in `scaffold.config.ts` matches the deploy target
- [ ] RPC endpoint not the public default (rate-limited at 5 req/s)
- [ ] Gas price set or strategy chosen (auto, EIP-1559 priority fee)
- [ ] Block-explorer URL configured for verification

### Failure → revert to Phase 1

If any of these fails, you go back to Phase 1. Specifically:

| Symptom | Phase to revert to |
|---|---|
| Test reveals contract bug | Phase 1, fix + write regression |
| Slither flags new High | Phase 1, refactor |
| Invariant violated | Phase 1, fix root cause |
| Deploy script fails on fork | Phase 1, fix script |
| Verification fails on testnet | Phase 1 (constructor args / metadata mismatch) |

Never deploy "we'll fix it after."

## Gate 2 → 3: live contracts ready for production frontend

Before `yarn ipfs` or `yarn vercel` for production:

### Onchain state
- [ ] Contracts deployed to target chain
- [ ] Contracts verified on block explorer (Etherscan + Sourcify)
- [ ] Ownership transferred to multisig — verify with `cast call`:
  ```bash
  cast call $CONTRACT "owner()(address)" --rpc-url $RPC
  # Must equal the multisig address
  ```
- [ ] Deployer EOA drained or holds < $1 in residual gas
- [ ] No privileged role still on deployer:
  ```bash
  cast call $CONTRACT "hasRole(bytes32,address)(bool)" 0x00...00 $DEPLOYER --rpc-url $RPC
  # Must return false
  ```

### Frontend integrity
- [ ] `scaffold.config.ts` `targetNetworks` matches the live chain
- [ ] `pollingInterval: 3000` (not the 4000ms default — feels sluggish)
- [ ] `rpcOverrides` set with project RPC, NOT public default
- [ ] `burnerWalletMode: "localNetworksOnly"` (or v2 equivalent) — burner UI MUST NOT ship
- [ ] No `console.log` in production code
- [ ] No raw addresses rendered (use `<Address>` component)
- [ ] All buttons have `disabled` during pending tx
- [ ] Three-button flow holds (switch → approve → execute, never simultaneous)

### Metadata + branding
- [ ] Page title not "Scaffold-ETH 2"
- [ ] OG image 1200×630, custom (not stock SE2)
- [ ] `NEXT_PUBLIC_PRODUCTION_URL` set to canonical URL
- [ ] Favicon updated
- [ ] No SE2 boilerplate copy

### Real-money testing
- [ ] $5–$50 walkthrough on production contracts (not testnet)
- [ ] Approve flow worked
- [ ] Execute flow worked
- [ ] State updated as expected
- [ ] Transaction shows on explorer with proper labels

### Failure → revert to Phase 2

| Symptom | Action |
|---|---|
| Frontend bug only | Stay in Phase 2: fix locally against live contracts, redeploy frontend only |
| Contract bug discovered | Phase 1: fix, redeploy contracts to a NEW address (or upgrade if upgradeable), then back through Gate 1 → 2 |
| RPC issues | Phase 2: swap provider, raise rate limit, check `eth_getLogs` quota |
| Verification missing | Phase 2: re-run `yarn verify` |

## Gate 3: production live, watch first 24h

After deploy, the gate is on **shipping it out**:

- [ ] Live URL responds 200 from 2+ gateways (IPFS) or production CDN (Vercel)
- [ ] Smoke test from a fresh browser (no cached state, no extension besides wallet)
- [ ] Mobile smoke test (real iOS Safari, real Android Chrome)
- [ ] OG link preview rendered correctly on Twitter/X, Telegram, Slack, Discord
- [ ] Onchain monitoring active (Tenderly alert, Defender Sentinel, custom subgraph)
- [ ] Error tracking active (Sentry, custom)
- [ ] First 24h traffic reviewed — anomalies investigated, not ignored

A gate-3 fail (post-launch bug) is the most expensive class. Have a rollback plan:
- IPFS: revert ENS content hash to previous CID (one mainnet tx)
- Vercel: `vercel alias set <previous-deploy>` (instant)
- Contracts: pause if pause-able; otherwise, write a follow-up advisory and migrate users

## Anti-patterns

- **"Just push it; we'll fix in prod"** — Phase 3 is not a fix-up environment. Go back to the right phase.
- **"Tests pass locally, that's enough"** — Local fork ≠ live network. Gate 1→2 requires testnet (or fork-of-mainnet) deployment first.
- **"We don't need a multisig yet"** — Yes you do. The deployer can be your multisig, OR you transfer ownership before announcing. Never both options "later."
- **"The audit is informal, that's fine"** — A second pair of eyes is the cheapest insurance. Even an LLM auditor with the audit/SKILL.md is better than nothing.
- **"Burner wallet is harmless on prod"** — Users see a "use a temporary wallet" CTA on a financial app. They will use it. They will lose funds. Disable.
- **"OG image is just marketing"** — It's also the user's first signal that this isn't a phishing clone. Custom ≠ optional.

## Phase-revert hygiene

When you revert phases, do it cleanly:

1. **Make the bug visible**: open an issue, reproduce in a test.
2. **Don't keep prod state** that depends on the buggy code path. Migrate users off, mark deprecated.
3. **Re-run all gates from the revert point forward** — partial gating is what causes "we forgot to verify on the new contract" disasters.

## What to read next

- `references/monorepo-layout.md` — the directory structure these gates assume
- `references/ci-and-deploy.md` — automating gate checks in CI
- `audit/SKILL.md` — what "internal review" means at gate 1
- `qa/SKILL.md` — what "smoke test" means at gate 3
