# Finding Write-Up: Severity, Reproduction, Communication

A finding without a reproducible PoC is a guess. A finding with the wrong severity is noise. A finding without a clear remediation is unactionable. This file is the writeup contract — what every finding must contain, how to assign severity, and how to deliver findings without arguments.

For audit intake, see `references/scoping-and-intake.md`. For manual review, see `references/manual-review.md`.

## Standard finding format

Every finding follows the same template:

```markdown
## [SEVERITY] Title

**ID**: F-001
**Severity**: Critical | High | Medium | Low | Informational
**Category**: Reentrancy | Access Control | Math | Oracle | Logic | Gas | etc.
**Location**: `contracts/Vault.sol:142`
**Status**: Open | Acknowledged | Fixed | Disputed

### Description
Plain-English description of the vulnerability. Two paragraphs max.

### Impact
Concrete consequence. Quantify where possible.
"An attacker can drain X% of the pool in a single tx."
"User funds permanently locked if owner key is lost."

### Likelihood
Conditions required to exploit. Cost. Detection.

### Proof of Concept
\`\`\`solidity
function testExploit() public {
    // Setup
    vault.deposit(100e18);
    // Trigger
    attacker.exploit();
    // Verify
    assertEq(vault.balanceOf(victim), 0);
    assertEq(token.balanceOf(attacker), 100e18);
}
\`\`\`

### Recommended Mitigation
Specific code change. Not "add reentrancy guard" — show the modifier or pattern.

### References
Past incidents, related EIPs, prior art.
```

## Severity rubric

Severity = **Impact × Likelihood**. Both axes are required; never assign on one alone.

```
                       LIKELIHOOD
              Low      Medium      High
         ┌──────────┬──────────┬──────────┐
   High  │  Medium  │   High   │ Critical │
         ├──────────┼──────────┼──────────┤
 Medium  │   Low    │  Medium  │   High   │
         ├──────────┼──────────┼──────────┤
   Low   │   Info   │   Low    │  Medium  │
         └──────────┴──────────┴──────────┘
                          IMPACT
```

### Impact axis

- **High**: Direct loss of user funds, permanent freezing of assets, ability to mint unbounded tokens, governance hijack.
- **Medium**: Indirect loss (e.g., griefing that wastes user gas), partial loss, denial of service to specific users, value extraction up to a bounded amount.
- **Low**: User experience degradation, gas waste, minor incorrect accounting that doesn't compound.

### Likelihood axis

- **High**: Any user can exploit. No special conditions. Single tx. Free or cheap.
- **Medium**: Requires specific conditions (specific market state, specific timing, specific role) but conditions are reasonable to engineer.
- **Low**: Requires unlikely conditions (compromised oracle, multi-block coordination, specific other contract states) or significant capital.

### Severity definitions

- **Critical**: High impact + High likelihood. Funds at immediate risk. Stop launch. File CVE if deployed.
- **High**: High impact + Medium likelihood, or Medium impact + High likelihood. Must fix before launch.
- **Medium**: Substantial issue worth fixing. Combination of factors that an attacker would seriously consider.
- **Low**: Worth knowing about. Fix if cheap, document if not.
- **Informational**: Code quality, minor optimization, missed standard. No security impact alone.

### Severity calibration mistakes

- **"Owner can rug" auto-Critical**: Only if not disclosed in trust model. If the README says "owner is multisig with admin powers", it's Centralization-Risk-Acknowledged or Informational depending on context.
- **Theoretical Critical**: A bug that requires a 51% attack on a major price oracle is Critical-If-Conditions-Met but not the same as a Critical exploitable today. Adjust likelihood honestly.
- **Severity inflation by category**: "Reentrancy" doesn't auto-mean High. A reentrancy on a view function with no state change is Low. A reentrancy on `withdraw()` that drains all funds is Critical.
- **Severity by precedent**: "Cream Finance lost X to this class of bug" — if your bug has a meaningful structural difference (e.g., the deposit function has no path back to the attacker), severity differs.

## Proof-of-concept requirements

Every Critical or High finding **must** have a runnable PoC. Mediums should where feasible. Low/Info can describe the path without code.

```solidity
// PoC must be:
// - Self-contained in one file
// - Runnable with `forge test --match-test testExploit_F001 -vv`
// - Asserting the bad state (not just "transaction succeeded")

contract ExploitVault is Test {
    Vault vault;
    MockToken token;
    address attacker = address(0xBAD);
    address victim = address(0xC0FFEE);

    function setUp() public {
        token = new MockToken();
        vault = new Vault(address(token));
        // ... initialize realistic state
    }

    function testExploit_F001_drainViaReentrancy() public {
        // Step 1: Setup
        vm.prank(victim);
        token.approve(address(vault), 100e18);
        vm.prank(victim);
        vault.deposit(100e18);
        assertEq(vault.balanceOf(victim), 100e18, "victim has shares");

        // Step 2: Exploit
        Reenterer reenterer = new Reenterer(vault);
        vm.deal(attacker, 1 ether);
        vm.prank(attacker);
        reenterer.attack{value: 1}();

        // Step 3: Bad state asserted
        assertEq(token.balanceOf(victim), 0, "victim drained");
        assertEq(token.balanceOf(address(reenterer)), 100e18, "attacker got it");
    }
}
```

If you can't write the PoC, **the finding is suspect**. Either the bug is theoretical, you misread the code, or there's a subtlety you're missing. Don't ship findings without PoCs except for clear-cut issues (missing return value check, etc.).

### When PoC is hard but bug is real

Some bugs need state that's hard to set up:

- **Oracle manipulation**: PoC needs a forked mainnet at a specific block, plus a mock oracle exhibiting the manipulated state.
- **Cross-contract**: PoC needs all involved contracts deployed and in a specific configuration.
- **Long-tail timing**: PoC needs `vm.warp` to advance through epochs.

Build the harness anyway. If the test takes 200 lines, that's fine. Working PoCs survive disputes; arguments don't.

## Categorizing findings

Use a stable taxonomy. Helps the team triage and helps you avoid miscategorizing:

| Category | Scope |
|---|---|
| Access Control | Missing `onlyOwner`, role bypass, initializer reentrancy |
| Reentrancy | Cross-function, cross-contract, read-only |
| Math/Precision | Rounding direction, division before multiplication, overflow |
| Logic | Off-by-one, missing check, incorrect state transition |
| Oracle | Stale prices, manipulable price source, single-source dependency |
| Bridges/Cross-chain | Replay, message ordering, finality assumption |
| Signatures | EIP-712 domain, replay, signature malleability |
| Tokens (ERC-20) | Fee-on-transfer, rebase, USDT non-standard return, weird tokens |
| ERC-4626 | Inflation attack, share/asset rounding, deposit ordering |
| ERC-4337/AA | Paymaster griefing, signature aggregation, postOp revert |
| Proxies | Storage collision, initialization, selector clash |
| Governance | Vote-buying, proposal manipulation, timelock bypass |
| Gas/DoS | Unbounded loop, gas griefing, block stuffing |
| Front-running/MEV | Sandwich, JIT liquidity, oracle frontrun |
| Centralization | Single point of failure, ungated admin powers |

Pick one. If it spans two, name both: `[Access Control + Reentrancy]`.

## The finding lifecycle

```
Draft (auditor only)
   │
   ▼
Review (peer auditor reads + re-runs PoC)
   │
   ▼
Open (delivered to team)
   │
   ▼
   ├─→ Acknowledged (team agrees, will fix)
   │      │
   │      ▼
   │   Fixed (commit hash provided)
   │      │
   │      ▼
   │   Verified (auditor confirms fix)
   │
   ├─→ Acknowledged (team agrees, accepts as risk)
   │      │
   │      ▼
   │   Centralization-Risk-Acknowledged (documented, not fixed)
   │
   └─→ Disputed (team disagrees)
          │
          ▼
       Re-evaluated (auditor + team)
          │
          ▼
       Closed-No-Action | Severity-Adjusted | Confirmed-Open
```

Document the path in the report. "Disputed → Auditor concedes" is fine; "Open → Closed without explanation" isn't.

## Communication: deliver findings, don't argue them

When delivering findings to the team:

- **Lead with severity counts**: "3 Critical, 5 High, 12 Medium, 20 Low" — they triage fast.
- **Don't relitigate during delivery call.** Let them ask questions; if they push back, log as Disputed and respond in writing.
- **Provide remediation, not lectures.** "Add `nonReentrant` modifier on line X" beats "you should learn about reentrancy."
- **Be specific about what's still TODO from the auditor side.** If you ran out of time on a section, say so explicitly.
- **Separate "this is broken" from "this could be better."** Mixing security findings with style preferences erodes credibility.

## When the team disputes a finding

Common patterns and responses:

| Team says | Auditor response |
|---|---|
| "The owner is trusted" | "Documented in trust model? If not, please add. Severity adjusts based on the doc, not the call." |
| "This is in OpenZeppelin code" | Verify it's unmodified OZ. If yes, downgrade or move to Informational. If modified, finding stays. |
| "We have monitoring for this" | Off-chain mitigation reduces likelihood. Adjust severity by one rank, document the dependency. |
| "Fixed in dev branch" | Re-test against the fix commit. Either Verified or Open with new finding ID. |
| "This requires too much capital" | Quantify capital. If $1M+, mention in likelihood. Doesn't change exploit existence. |
| "Nobody would do this" | Not a defense. If it's exploitable, it's a finding. |

## False positive rate

Auditors with a high false positive rate (>20% of findings withdrawn) lose credibility. Calibrate by:

- Always running the PoC before writing the finding
- Asking "what would I say if the team pushes back" before submitting
- Peer-reviewing findings before delivery

If you're unsure, mark as `Speculative` in your draft and decide before delivery.

## Finding ID stability

Once a finding has an ID, it doesn't change. If F-005 is invalid, mark Withdrawn — don't reuse the ID. The history matters for traceability across reports.

## Final report structure

```markdown
# Audit Report: <Protocol>

## Executive Summary
- Scope (commit, contracts, days)
- Findings count by severity
- Recommendation: Ready/Not-Ready/Conditional

## Methodology
- Tools used
- Manual review process
- Limitations and caveats

## Findings
- F-001 [Critical] ...
- F-002 [High]    ...
- ...

## Centralization Risks (if any)
Specific to admin powers, oracle dependencies, etc.

## Out-of-Scope Notes
What was excluded and why.

## Appendix: Tool Output
- Slither summary
- Coverage gaps
- Test failures encountered
```

Keep the executive summary readable by a non-technical reader (founder, board, investor). Findings stay technical. Methodology section earns trust.

## Common writeup mistakes

- **Vague titles**: "Issue in withdraw()" — useless. Use "Reentrancy in withdraw() drains vault balance".
- **No location**: Without `file:line`, the team has to hunt. Always specify.
- **Imagined exploits**: "An attacker could potentially..." — either prove it or downgrade.
- **Missing impact quantification**: "Funds at risk" — how much? "Up to 100% of vault TVL within one block" is actionable.
- **Lecturing in the recommendation**: "Be careful when..." — give code.
- **Severity drift across the report**: F-001 Critical, F-002 Critical — but F-002's path is much harder. Calibrate against each other before final delivery.
- **Reusing language across findings**: "An attacker can call X to drain funds" — every finding is this sentence. Be specific.

## What to read next

- `SKILL.md` — full audit methodology
- `references/scoping-and-intake.md` — pre-audit setup
- `references/manual-review.md` — the human review pass
- Trail of Bits report archive: https://github.com/trailofbits/publications
- Rekt News: https://rekt.news
- Sigma Prime audit reports: https://github.com/sigp/public-audit-reports
