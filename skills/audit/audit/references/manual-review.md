# Manual Review: What the Human Auditor Does

Automated checklists catch the known-class bugs. Manual review catches the bugs *between* the categories — the architectural mistakes, the multi-contract interactions, the subtle invariants. This file is the discipline of human review: how to read a codebase, what to look for that no checklist will tell you, and how to keep yourself honest.

For intake, see `references/scoping-and-intake.md`. For finding writeup, see `references/finding-writeup.md`.

## What manual review is for

| Catches | Doesn't catch |
|---|---|
| Architectural mistakes | Misuse of well-known patterns (checklists) |
| Multi-contract interaction bugs | Single-contract logic errors (checklists) |
| Trust-model violations | Common standards violations (checklists) |
| Invariant breaks under composition | Compiler-level issues (Slither/Mythril) |
| Off-by-one in unusual code paths | Reentrancy on standard patterns (Slither) |
| "This shouldn't exist" red flags | Missing checks on standard interfaces |

The big ones — Cream's reentrancy, Wormhole's signature verification, Euler's donation — are nearly always architectural. No checklist would have caught Wormhole because the bug was in how validation was structured, not in a missing modifier.

## Reading order

For a new codebase, read in this order:

1. **README** — what does the team think this does?
2. **Architecture diagrams** — if they exist; ask if not
3. **Deployment script** — what gets deployed, in what order, with what state
4. **Top-level contract** — usually the user-facing contract
5. **Walk every external function on the top-level**, following each into its callees
6. **Storage layout** of every contract — `forge inspect Contract storageLayout`
7. **Tests** — read what they test (often reveals what the team thinks is critical)
8. **Comments and TODOs** — `git grep -i 'todo\|fixme\|hack\|workaround\|temporary'`

After this pass you have a working mental model. *Now* the audit begins.

## The questions to ask of every function

For each external function:

```
1. What's the precondition? (caller, state, args)
2. What's the postcondition? (state changes, events, return value)
3. What invariants must hold afterward?
4. Who can call it?
5. Can it be called recursively (reentrant)?
6. Can it be front-run? Sandwiched? Censored?
7. What happens if it reverts mid-execution?
8. What happens if it's called with extreme arguments? (0, max, MAX_UINT256, contract, EOA, self)
9. What external contracts does it interact with? Are those trusted?
10. What's the gas cost? Can it be DOSed by gas limit?
```

For each storage variable:

```
1. Who can write to it?
2. What's the valid range?
3. What happens at boundaries?
4. Can it be temporarily inconsistent across two writes?
5. Is it readable across reentrant contexts?
```

These aren't novel insights — but applying them systematically to every function catches what skimming misses.

## Architectural smells

Things that should make you stop and investigate:

### Smell: many privileged functions

```solidity
function setFee(uint256 _fee) external onlyOwner;
function setOracle(address _oracle) external onlyOwner;
function setStrategy(address _strategy) external onlyOwner;
function pause() external onlyOwner;
function rescueTokens(address t, uint256 a) external onlyOwner;
// ...10 more
```

The more knobs the owner has, the more centralization risk. Walk every privileged function: what damage if the owner is malicious? What damage if the multisig is phished? Document each.

### Smell: external calls before state updates

```solidity
function withdraw() external {
    uint256 amount = balances[msg.sender];
    payable(msg.sender).transfer(amount);
    balances[msg.sender] = 0;  // After external call
}
```

CEI (checks-effects-interactions) violation — the canonical reentrancy. But also look for the *subtle* ones: writes after `safeTransferFrom`, after a callback hook, after a `delegatecall`.

### Smell: many small contracts that delegate

```solidity
contract Diamond { fallback() external { /* dispatch via selector */ } }
```

Diamond pattern is fine, but *easy to misuse*. Storage collisions across facets. Selector clashes. Initialization order. Read `references/checklist.md` for `evm-audit-proxies` and run them all.

### Smell: trust the caller is a contract

```solidity
function flashLoan(...) external {
    callback();
    require(repaid >= amount + fee);
}
```

Anything that calls back into msg.sender opens reentrancy. If `callback()` is unchecked, the caller can do anything during it.

### Smell: conditional behavior on `block.timestamp`

```solidity
if (block.timestamp < START) return;
// or
if (block.timestamp - lastUpdate > STALE) revert();
```

Validators can manipulate timestamp by ~12s. Acceptable for daily granularity; dangerous for sub-minute. Note the dependency.

### Smell: math that mixes scales

```solidity
uint256 priceUSD = price * 1e8;       // 8 decimals
uint256 amountToken = amount * 1e18;   // 18 decimals
uint256 valueUSD = priceUSD * amountToken;  // 26 decimals; downstream code likely wrong
```

Mixing decimals is a top finding source. Always trace the decimal scale of every multiplication and division.

### Smell: silent failure

```solidity
(bool ok, ) = target.call(data);
// no `require(ok)`
```

A failed external call that doesn't revert lets the protocol continue in an inconsistent state. Confirm whether failure is intentional and documented.

### Smell: assumptions about caller's address shape

```solidity
require(tx.origin == msg.sender, "no contracts");
```

`tx.origin` checks are bypassable in many ways and break ERC-4337 / EIP-7702. They're nearly always wrong.

### Smell: code paths only reachable post-init

Many bugs hide in the second/third epoch of operation:

```solidity
if (lastWithdraw == 0) {
    // first time path
} else {
    // subsequent path — has the bug
}
```

Spend equal time on "first call" and "after many calls" paths. Use Forge's stateful fuzzing to reach later states.

## Cross-contract review

Most checklists are per-contract. The bugs you catch with manual review are between contracts:

```
ContractA.deposit() ─→ ContractB.flashloanProvider()
                              │
                              ▼
                       ContractA.callback()
                              │
                       (state inconsistent here?)
```

Build a call graph for the top 10 most-called external paths. For each:

- What state is in flux during the call?
- What invariants might be violated mid-call?
- What does the callback see that the caller assumes is stable?

## The "what if" loop

For each function, run:

```
What if the caller is a contract?
What if the caller reenters?
What if msg.value is 0? Max? Negative (no, but uint256 wraparound)?
What if the token is fee-on-transfer?
What if the token reverts on transfer to address(0)?
What if the token is non-standard (USDT, BNB)?
What if the oracle is stale? Is manipulated?
What if the chain reorgs?
What if multiple users call the same function in the same block?
What if this is called pre-initialization?
What if this is called post-pause / post-emergency-stop?
What if the gas limit is too low?
What if the array argument is empty? Massive?
What if the recipient is the contract itself?
What if the recipient is the zero address?
What if the recipient is a contract with a malicious receive()?
```

Most aren't bugs. Some will be. The ones that are bugs are the manual-review wins.

## Specific patterns worth reading carefully

These keep yielding findings across audits:

### ERC-4626 inflation / deposit ordering

First depositor can manipulate share price. Standard fix: virtual shares + virtual assets. Verify implementation; it's frequently wrong.

### Permit signature replay across forks

`permit` uses chainId in the domain. If chainId is read at init time (cached) and chain forks, signatures from one chain become valid on the other. Check `DOMAIN_SEPARATOR` is computed dynamically or chain-id check is enforced.

### Compound-style market parameter updates

If `updateMarket()` writes new parameters before all interest accrual, users see stale rates. Check ordering of writes.

### Oracle staleness

```solidity
(,int256 price,,uint256 updatedAt,) = oracle.latestRoundData();
require(updatedAt + STALE > block.timestamp);
```

The check should be `block.timestamp - updatedAt < STALE`. Order matters; `updatedAt + STALE` can overflow if `updatedAt` is poisoned. Also check `price > 0` and `answeredInRound >= roundId`.

### Off-by-one in array bounds

```solidity
for (uint256 i = 0; i <= arr.length; i++) // <= is wrong
```

Sounds dumb; appears in real code; especially in Yul and in copy-pasted unbounded loops.

### Approval race condition

ERC-20 `approve(spender, X)` then `approve(spender, Y)` is a known race. Look for protocols that use `approve` instead of `safeIncreaseAllowance` / `forceApprove`.

### `safeApprove` / `forceApprove` confusion

`safeApprove` from old OZ is deprecated. Modern code uses `forceApprove` (sets to 0 first, then to N). If the codebase uses `approve` directly, flag it.

### Storage gaps in upgradeable contracts

OZ upgradeable contracts have `uint256[50] __gap`. If a child contract removes the gap or adds storage where the gap was, upgrade collisions ensue. Run `forge inspect` on every version of every upgradeable contract and diff the layouts.

### Unsafe `delegatecall`

`delegatecall` runs target code in the calling contract's storage context. If target is not validated, the target can rewrite any state. Check whether target is `immutable`, in a registry, or user-controlled.

### Fallback `receive()` consuming gas

```solidity
receive() external payable {
    _someExpensiveLogic();
}
```

If a user sends ETH to the contract, `receive()` runs. If logic exceeds 2300 gas (the `transfer`/`send` budget), it reverts. Some integrators use `transfer`/`send` and this bricks them.

### EIP-2612 permit deadline

`permit(owner, spender, value, deadline, v, r, s)` — if deadline is in the past, signature is invalid. But also: if deadline is `type(uint256).max`, signature lasts forever — phishing surface. Flag if app uses unlimited deadlines without rationale.

## The peer-review pass

Before delivering findings, get a second auditor (or yourself, fresh tomorrow) to:

1. Re-read each finding without the original reasoning
2. Re-run each PoC
3. Re-evaluate severity in isolation

Drift catches itself this way. Ten findings written in one day all start to feel "Critical" — peer review re-calibrates.

## Time budget

Rough split for a focused audit week:

- 20% — intake, scoping, reading docs
- 40% — manual review (the work this file describes)
- 20% — running tools, triaging output
- 10% — writing findings (one-off; not the bottleneck)
- 10% — peer review and final report

If you're spending >50% on tool output, you're auditing tool output, not the protocol.

## Common manual-review mistakes

- **Skimming on the second pass** — you missed something the first time; slow down on the second.
- **Trusting comments** — comments lie. Read the code.
- **Trusting tests** — tests prove what was tested, not what's correct. Read the test logic; it might be wrong.
- **Treating every external call as reentrancy-prone** — many aren't (transfer to a static address, view calls). Severity inflation.
- **Auditing in isolation** — peer review is essential. Fresh eyes catch the bugs you've rationalized.
- **Not running the PoC** — typing the PoC is the cheapest way to verify a hypothesis. If you don't, you'll write findings on bugs that aren't.
- **Stopping at the first bug** — find and document, then keep reading. Multiple bugs often share a root cause; document them all and let the synthesis pass them up.

## What to read next

- `SKILL.md` — full audit methodology
- `references/scoping-and-intake.md` — pre-audit setup
- `references/finding-writeup.md` — severity rubric and PoC requirements
- "How to Become a Smart Contract Auditor" by Owen Thurm — beginner-friendly
- secureum.xyz — security curriculum
- Code4rena reports archive: https://code4rena.com/reports
