# Post-MVP Iteration

The launch announcement isn't the finish line — it's the start of the part where the codebase has to survive contact with users. This file is the playbook for the first 90 days after launch: what to fix, what to defer, when to redeploy vs patch the frontend, and how to migrate ownership over time.

For pre-launch sequencing, see `references/launch-runbook.md`. For the contract patterns themselves, see `references/archetype-blueprints.md`.

## The first 7 days

**Triage, don't build.** The instinct to ship features is wrong here. Your job is:

1. Watch the funnel (connect → first action → return)
2. Watch the failure rate (reverts, RPC errors, wallet errors)
3. Fix the obvious UX bugs people are reporting
4. Don't touch the contracts unless they're broken

Things that *feel* urgent and aren't:
- A feature request from one Discord user
- Improving the landing page copy
- Adding a second chain
- Adding analytics dashboards beyond what you already have

Things that are actually urgent:
- A wallet that doesn't work for >5% of attempted connects
- A class of transactions reverting unexpectedly
- A subgraph that has fallen behind chain head
- An RPC provider degrading

Keep a running incident log even for non-pages-on-fire issues. Pattern emerges fast: 80% of bug reports cluster into 2-3 root causes.

## Frontend patches vs contract redeploys

The cost asymmetry should drive every decision:

| Change type | Cost | When |
|---|---|---|
| Frontend patch | minutes, free, reversible | Bug fixes, copy changes, UX improvements, data display |
| Subgraph redeploy | hours, ~free, reversible | Indexing schema changes, new event handlers |
| New contract deployment | hours-days, gas + audit, irreversible | Genuinely broken contract logic, new feature requiring state |
| Migration (users move funds) | weeks, painful | Last resort — only when patch is impossible |

**Default to frontend patches.** A surprising number of "contract bugs" are actually display bugs. Before assuming the contract is wrong, check:

- Is the value being formatted with the right decimals?
- Is the indexer up to date?
- Is the user on the right chain?
- Is the frontend reading from the right contract address?

If yes to all of those and behavior is still wrong, then look at the contract.

## Feature flags for staged rollout

When you do ship a new feature, gate it. Two patterns:

**Frontend feature flag** (the cheap path):

```ts
const FLAGS = {
  newDepositFlow: process.env.NEXT_PUBLIC_FF_NEW_DEPOSIT === "1",
  multiAssetSupport: false,
};

if (FLAGS.newDepositFlow) {
  return <NewDepositForm />;
}
return <LegacyDepositForm />;
```

Toggle without redeploying contracts. Use Vercel/Netlify env vars or a service like LaunchDarkly / GrowthBook for percentage rollouts.

**Contract feature flag** (when on-chain logic must change):

```solidity
mapping(address => bool) public allowlistedFeatures;

modifier whenFeatureEnabled(address user) {
    require(allowlistedFeatures[user] || globallyEnabled, "feature not enabled");
    _;
}
```

Use sparingly — every flag is a permanent surface to maintain. But for a risky new code path, gating to a small allowlist for the first week is much safer than a flag day.

## When to redeploy contracts

You'll be tempted to redeploy. Often. Resist unless one of these is true:

- **A bug is actively losing user funds.** Pause first if pausable, then patch and migrate.
- **A bug locks user funds.** Same — pause + migrate path.
- **A new feature requires storage changes** that can't be added (no upgradeability or unsafe to upgrade).
- **An audit finding is High/Critical** and must be fixed before more users onboard.

Things that are NOT redeploy reasons:
- A new feature that *could* be added but isn't required
- Gas optimization (rarely worth a migration)
- "Cleaner code" or refactor (never worth migration)
- A minor inconvenience in the API

If you do redeploy, the migration is the hard part:

```
1. Deploy V2
2. Pause V1 (if possible)
3. Provide a migration path: users withdraw from V1, deposit to V2
4. Or: write a migration contract that does both atomically
5. Communicate clearly: announcement, email, in-app banner
6. Long tail: V1 stays live with reduced functionality for users who don't migrate
7. Wind down V1 after a known deadline
```

Migrations bleed users. The drop-off between V1 and V2 is typically 30-60% even with a smooth path. Plan for it.

## Ownership migration over time

Day-1 ownership is usually a 3/5 multisig. Over time, decentralize:

```
T+0:    Multisig (3/5 founding team)
T+30d:  Add timelock (48h delay on owner actions)
T+60d:  Multisig with broader signer set (5/9, includes community members)
T+90d:  Token-holder governance proposes; multisig executes (Snapshot + Safe)
T+180d: Full on-chain governance (Governor) for non-emergency actions
T+365d: Sunset pause guardrail (renounce or set immutable)
```

This is *aspirational*. Many protocols never decentralize past step 2 because they don't need to. The right pace depends on:

- TVL: high TVL → faster decentralization (centralization risk grows)
- Token distribution: concentrated → governance is theater; defer
- Team size: small team can't run a full Governor flow

Don't decentralize for ideology. Decentralize when the centralization is the actual risk.

## Sunsetting the pause guardrail

The pause function is a powerful but dangerous primitive. Plan its sunset.

```solidity
// Self-disabling pause: after a deadline, pause stops working
function pause() external onlyOwner {
    require(block.timestamp < pauseSunset, "pause expired");
    _pause();
}
```

Or transfer the pauser role to a separate timelock that requires a long delay. Or simply renounce the role at a known date.

The signal to users: "we built an emergency stop, we used it during early days, and now we're locking the box."

## Security maintenance cadence

Audits are not a one-and-done event:

| Trigger | Action |
|---|---|
| Major version released | Full audit before deploy |
| Minor logic change | Targeted re-audit (smaller scope, ~30% cost) |
| New integration (oracle, AMM) | Audit the integration boundary |
| Quarterly | Internal review pass — invariants still hold? |
| Bug bounty hit | Re-scope audit if bug suggests systemic issue |

Set a bug bounty on Immunefi or Cantina from week 1. The cost is reputation + potential payout; the value is finding bugs before exploiters do. Standard tiers:

- Critical (loss of funds): 5-10% of TVL, capped
- High (denial of funds, governance takeover): $50K-$250K
- Medium: $5K-$25K
- Low / informational: $500-$2,500

Document scope clearly. Bug bounty disputes are painful — clarity upfront prevents them.

## Adding a second chain

Multi-chain is a tax most teams underestimate. Costs:

- 2x deploys, 2x audits (or partial re-audit)
- 2x indexers, 2x monitoring
- 2x frontend chain switching, 2x RPC failover
- Liquidity fragmentation: users on chain A can't trade against chain B
- Bridge risk if you connect them

Don't add a second chain until:

- Single-chain product is healthy (DAU growing, retention OK)
- You've heard the demand from real users, not Twitter
- You have the operational bandwidth (on-call coverage, monitoring stack already humming)

If you do add a second chain:

```
1. Deploy on testnet of new chain
2. Run fork tests against it
3. Deploy on mainnet of new chain (separate deployer key)
4. Identical owner: same multisig (use canonical Safe address)
5. Frontend chain switcher tested in 3+ wallets
6. Analytics segmented by chain
7. Indexer configured per chain
8. Status page shows per-chain status
```

The "identical multisig address" pattern requires using `safe-singleton-factory` so the Safe lands at the same address on every EVM chain. Worth setting up day 1.

## Feedback loops

You need a structured way to hear from users:

```
SOURCE                    SIGNAL                         ROUTING
──────                    ──────                         ───────
Discord support channel   Bug reports, confusion         Daily triage → GitHub issues
Twitter mentions          Reactions, complaints          Auto-ingest with sentiment
GitHub issues             Power users, devs              Sprint planning
Sentry / on-chain alerts  Errors / anomalies             On-call queue
Direct DMs                Whales, partners               Founder-level
NPS / in-app survey       Quantitative satisfaction      Quarterly review
```

The Discord channel is usually the highest signal-to-noise. Read it daily. Respond within hours.

Quantitative funnel from the analytics stack tells you *what*; user reports tell you *why*. Both are needed.

## Deprecation patterns

When you're winding down V1 or removing a feature:

```
T-30d: Announce deprecation
T-21d: In-app banner; warn on every interaction
T-14d: Email/notification to active users
T-7d:  Final reminder; freeze new deposits/usage
T-0:   Pause or remove from frontend; backend continues to allow withdrawals
T+90d: Optional: full disable of withdrawals (only if state can be migrated)
```

Never silently disappear a feature. Users who stop opening the app for a few weeks shouldn't lose access without warning.

## Common post-MVP failure modes

- **Premature feature factory.** Every Discord request becomes a ticket; team builds 10 things, none well. Pick 1-2 themes per month.
- **Drifting from invariants.** Quick "fix" introduces a math bug because nobody re-checked the invariants suite. Run the invariant tests on every change.
- **Indexer rot.** Subgraph grows unmaintained, falls behind, frontend reads stale data, users assume contracts are broken. Treat the indexer as production code.
- **Stale dependencies.** Wagmi v1 → v2 has breaking changes; viem versions move fast. Pin versions and update intentionally, not reactively.
- **Forgotten admin keys.** A multisig signer leaves the team; nobody updates the Safe. First time you need 3/5 in an incident, you have 2/4 and a panic.
- **Bug bounty drift.** Scope unclear; researchers report ineligible bugs, want payment, public dispute. Tighten scope after first incident.
- **One-person on-call.** That person burns out, nobody else knows the runbook. Document runbooks, rotate.
- **Multi-chain too early.** Team operationally falls over. See above.
- **Ignoring quiet warnings.** RPC starts taking 3s instead of 200ms. Indexer falls 10 blocks behind. Sentry has a slow climb. None individually trip an alert. All three together = imminent outage.

## When to do a follow-up audit

Not every change needs a full audit, but plan for follow-ups:

| Change | Audit needed? |
|---|---|
| Frontend bug fix | No |
| New contract function | Yes (targeted) |
| Storage layout change in upgradeable contract | Yes (full diff review) |
| New oracle integration | Yes (boundary review) |
| New chain deployment, same code | Maybe (review chain-specific behaviors) |
| Refactor without behavior change | Optional (code review at minimum) |
| Adding a strategy to a vault | Yes (strategy is new attack surface) |

Build a relationship with one auditor (Spearbit, Cantina, OZ) so re-engagements are fast. Cold-starting an audit firm on every change is slow and expensive.

## 90-day check-in template

At T+90 days, do a structured retro:

```
1. Numbers: DAU, TVL, transactions, retention by cohort
2. Top 5 user complaints (cluster Discord + Twitter + email)
3. Top 5 bugs found post-launch (severity, fix path)
4. Audit findings status (open / closed / accepted risk)
5. Ownership decentralization status (where on the timeline?)
6. What surprised us? (positive and negative)
7. Next 90 days: 2-3 themes, 5-7 specific tickets
```

Write it up. Share with team and (depending on trust) with the community. The retro is when "iteration" becomes "strategy."

## What to read next

- `SKILL.md` — full ship lifecycle
- `references/launch-runbook.md` — pre-launch + launch
- `references/archetype-blueprints.md` — contract patterns
- `audit/qa/references/post-launch-monitoring.md` — monitoring stack
- `audit/audit/SKILL.md` — when triggering a follow-up audit
