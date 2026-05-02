# Audit Scoping and Intake

The audit starts before code review. A poorly-scoped audit produces vague findings, misses critical paths, or burns time on out-of-scope code. This file is the intake protocol — what to gather, what to ask, and what to lock down before running checklists.

For finding writeup conventions, see `references/finding-writeup.md`. For the manual review pass alongside automated checklists, see `references/manual-review.md`.

## Scoping checklist

Before reading a single line of Solidity:

- [ ] **Repository pinned to a commit hash.** Auditing `main` is a moving target; you need an immutable reference.
- [ ] **Build reproduces locally.** `forge build` passes; same compiler version as deployment intent.
- [ ] **Tests run and pass.** If tests fail in your environment, you can't trust later findings about behavior.
- [ ] **Deployment scripts identified.** What gets deployed, in what order, with what initial parameters.
- [ ] **Off-chain dependencies enumerated.** Keepers, relayers, oracles, indexers, frontends — what does the protocol assume about them?
- [ ] **Trust assumptions documented.** Who is privileged? Owners, admins, multisigs, EOAs.
- [ ] **In-scope vs out-of-scope contracts listed.** Imported libraries (OpenZeppelin, Solady) usually out of scope; project-modified copies in scope.
- [ ] **Threat model agreed.** What attackers do you protect against? (random user, sophisticated DeFi attacker, malicious owner, sandwich bot)

## The kickoff document

Before audit work begins, write a 1-2 page intake document. Template:

```markdown
# Audit Scope: <protocol>

**Commit**: <full hash>
**Compiler**: solc <version> with <optimizer settings>
**Chain(s)**: mainnet, base, arbitrum (or whichever)
**Auditor**: <name> + sub-agents
**Audit window**: <date range>

## In-scope contracts
- contracts/Vault.sol
- contracts/Strategy.sol
- contracts/Router.sol

## Out of scope
- contracts/test/ (test mocks)
- lib/openzeppelin-contracts/ (audited library)

## Trust model
- Owner = 3/5 multisig at 0x...
- Strategy admin = team EOA at 0x... (will move to multisig post-launch — flag if exploited pre-migration)
- Keeper = single relayer with rate limit; not trusted with funds

## Off-chain dependencies
- Chainlink ETH/USD price feed (heartbeat 1h, deviation 0.5%)
- Off-chain rebalancer triggers `harvest()` daily
- Subgraph for UI; non-critical

## Known limitations
- The team is aware that `claim()` is callable in pause mode — they want this for emergency exits.
- The team is aware of MEV on `swap()` — accepts as known risk.

## Threat model
- Random user calling random functions: must not lose funds
- Sophisticated attacker with capital: must not extract funds beyond intended fees
- Compromised owner: documented in centralization risks; flag if exceeds disclosed
- L1/L2 reorg: depth-3 reorg should not corrupt state
```

This document **prevents arguments later**. If a finding is "owner can rug", but the README says "owner is trusted multisig", you mark it Centralization-Risk-Acknowledged and move on. Without the scope doc, you re-litigate every finding.

## Reading the codebase: order of operations

Don't open random files. Walk the call graph from entry points:

1. **External entry points first.** Find every `external` and `public` function on top-level contracts. These are the attack surface.
2. **Inheritance tree.** `forge inspect Contract storageLayout` and `forge inspect Contract abi` to see what's actually exposed and how storage is laid out.
3. **State diagram.** For each contract: what variables exist, who can write them, what invariants must hold.
4. **Money flow.** Trace every path that moves value (ERC-20 transfers, ETH sends, NFT transfers). For each: who can trigger, who pays, who receives.
5. **External calls.** Every `call`, `delegatecall`, `staticcall`, `transfer`, `send` — note them. Reentrancy candidates.
6. **Math.** Every division, multiplication, exponentiation — note them. Precision loss, overflow, underflow candidates.
7. **Access control.** Who can call what. Map roles to functions in a table.

## Extracting invariants

Most high-severity bugs are invariant violations. Find the invariants by:

```
For each state variable, ask:
  - What's its valid range?            (totalSupply >= 0, fee <= 100%, etc.)
  - What relationships hold with other vars?  (sum(balances) == totalSupply)
  - When can it change?                (only via deposit/withdraw; not in view fns)
  - Who can change it?                 (any user, owner only, internal only)
```

Then write the invariants down as a list. Example for ERC-4626:

- `totalAssets() >= sum of user shares × shares-to-assets ratio`
- `previewDeposit(x) <= deposit(x)` (no front-running of yourself)
- `convertToShares(convertToAssets(s)) <= s` (rounding doesn't add)

These become test targets and audit focal points.

## Build environment lockdown

```bash
# Pin everything
git checkout <commit-hash>
forge --version  # record
solc --version   # record
node --version   # record (for any TS deployment scripts)

# Verify no untracked files
git status

# Verify dependencies
forge install
git submodule status   # all clean

# Build with deployment-equivalent settings
forge build --use 0.8.27 --evm-version cancun
```

If the team uses Hardhat or Foundry, match their exact toolchain. Different solc patch versions can produce different bytecode (and different bugs).

## Tooling baseline

Before manual review, run automated tools and triage their output:

```bash
# Slither — static analysis (false positives expected, but read every one)
slither . --filter-paths "test/|lib/" --print human-summary
slither . --detect all > slither-out.txt

# Mythril — symbolic execution (slow, catches deeper bugs)
myth analyze contracts/Vault.sol --solv 0.8.27

# Aderyn — Rust-based analyzer; complementary to Slither
aderyn .

# 4naly3er — gas + general findings
4naly3er report .

# Forge coverage — find untested branches
forge coverage --report lcov
```

Triage rule: every Slither finding gets one of {real bug, intentional, false positive — with rationale}. Don't dismiss without writing why.

## Forge invariants and fuzzing

For non-trivial protocols, write invariant tests **as part of the audit**, not as a separate phase:

```solidity
contract VaultInvariantTest is Test {
    Vault vault;

    function setUp() public { vault = new Vault(...); /* configure */ }

    function invariant_totalAssetsConsistent() public {
        assertEq(vault.totalAssets(), token.balanceOf(address(vault)));
    }

    function invariant_sharesNeverExceedAssets() public {
        if (vault.totalSupply() > 0) {
            assertGe(vault.totalAssets(), vault.convertToAssets(vault.totalSupply()));
        }
    }
}
```

Run with: `forge test --match-test invariant -vv`

If an invariant breaks during fuzzing, you have a finding. This catches bugs that no checklist will.

## Information you need from the team

Send a structured list before kickoff:

```markdown
## Audit prerequisites — please provide:

1. Final commit hash for audit scope
2. Deployment plan (chains + addresses if pre-deployed)
3. README + architecture diagram
4. Trust model: who is privileged, with what powers
5. Test suite status (% coverage, known failing tests)
6. Prior audits (reports + remediation status)
7. Known issues / accepted risks
8. List of in-scope vs out-of-scope contracts
9. Off-chain components and their assumptions
10. Communication channel (Slack? Email? Issues?)
11. Response SLA for clarification questions
12. Disclosure timeline preferences
```

If they can't answer #4 (trust model) or #8 (scope), the audit isn't ready to start.

## What "in scope" really means

Be ruthless about scope. If a finding is in `lib/openzeppelin-contracts/`, it's not the team's bug — it's an OZ bug. Note it as informational ("uses OZ vX.Y.Z, no known vulns at audit time") and move on.

But: **modified library code is in scope**. If someone copy-pasted `ERC20.sol` into the project tree and changed three lines, audit those three lines. The fact that it derives from OZ doesn't mean it's safe.

## Engagement format options

| Format | When | Tradeoffs |
|---|---|---|
| Checklist sweep only | Small contracts, tight budget | Misses architectural issues; good for "have we covered the basics" |
| Manual + checklist | Standard | Best ROI; most audits are this |
| Manual + invariants + checklist | Complex DeFi | Most thorough; takes 2-4× longer |
| Continuous audit | Long-term partnership | Catches new code as it lands; requires retainer |
| Pre-deploy review only | Late-stage code that's "frozen" | Cheap, surface-level; false sense of security |

Pick based on contract complexity and stakes, not what the team can afford. If they can't afford a thorough audit, they shouldn't ship to mainnet.

## Common scoping mistakes

- **Auditing without a commit hash** — code shifts under you; findings become irreproducible.
- **Skipping the trust-model document** — every finding becomes "well, the owner can already do that"; pointless arguments.
- **Including `test/` in scope** — wastes time on mocks. Test contracts are not deployed.
- **Excluding deployment scripts** — Foundry scripts often have privileged calls; bugs there ship as deployed state.
- **Trusting the team's "this is safe" without independent reasoning** — every assumption gets challenged. "We use OZ" means OZ is challenged separately.
- **Letting the team see findings before write-up** — premature disclosure leads to defensive arguments. Lock findings, then share.

## What to read next

- `SKILL.md` — the full audit methodology and parallel-agent flow
- `references/manual-review.md` — what the human auditor does that the agents don't
- `references/finding-writeup.md` — severity rubric and PoC requirements
- Trail of Bits Audit Methodology: https://github.com/trailofbits/publications
- Rekt News (https://rekt.news) — case studies in what gets missed
