---
name: debug-contract
description: Use when a Solidity contract reverts, returns wrong values, fails a test, or behaves unexpectedly. Provides a structured debugging workflow — reproduce, isolate, instrument with traces and forks, identify the root cause, and fix without making it worse. For audit-grade analysis see audit; for testing patterns see testing.
---

# Debug a Contract

A contract that fails in production has already cost the user money. A contract that fails in test has cost you nothing — yet. Debugging is the discipline of turning the second into the first as cheaply as possible. This skill is the workflow.

For preventative testing patterns see `testing/SKILL.md`. For security review see `security/SKILL.md`. For audit-grade analysis see `audit/SKILL.md`. For gas debugging specifically see `gas/SKILL.md`.

## When to use

Trigger this skill when:

- "My contract is reverting and I don't know why"
- "Why does this test fail?"
- "The function returns 0 when it should return X"
- "This works locally but fails on testnet"
- "I'm getting `EvmError: Revert` with no details"
- "How do I trace a failed transaction?"

Do **not** use this skill for:

- Comprehensive security review (use `security` or `audit`)
- Initial contract design (use `protocol`)
- Deployment failures (use `ship`)

## Workflow

1. **Reproduce the failure deterministically.** A bug that happens "sometimes" hasn't been understood. Pin the inputs, the block number, the chain state. Read [references/repro-and-isolation.md](references/repro-and-isolation.md).

2. **Read the actual revert reason.** Don't guess from the error code. Use `forge test -vvvv`, `cast run`, or `cast call --trace`. Read [references/trace-techniques.md](references/trace-techniques.md).

3. **Isolate the failing call.** If a multi-call sequence fails, narrow to the specific call that reverts. Re-run that call alone with the same state.

4. **Form a hypothesis.** State it explicitly: "I think the revert is because `balanceOf(user) < amount`." A vague suspicion isn't a hypothesis.

5. **Verify the hypothesis with one cheap test.** A `console.log`, a `cast call` to read the state, a fork test that asserts the precondition. Don't fix yet.

6. **Identify the root cause class.** Use [references/common-bug-patterns.md](references/common-bug-patterns.md) — most contract bugs fall into ~15 known categories (off-by-one, integer order, missing approval, stale storage, reentrancy, etc.).

7. **Fix the smallest thing that addresses the root cause.** Don't refactor. Don't add abstractions. Make the failing test pass without breaking other tests.

8. **Add a regression test that would have caught the bug.** If the bug was real, the test deserves to exist forever.

9. **Re-run the full test suite.** A fix that breaks two other tests is not a fix.

## The diagnostic ladder

Climb in this order. Don't skip rungs.

```
1. Compile errors           — fix first; everything else is built on a green build
2. Static lint warnings     — solhint / slither catches obvious issues for free
3. Failing unit test        — narrow scope; you wrote the test, you know the spec
4. Failing fork test        — real-state interactions; mainnet/testnet fork
5. Reverting transaction    — runtime trace via cast / Tenderly / Anvil
6. Wrong return value       — state mismatch; storage layout or read path
7. Behavior diff prod vs test — environment difference: chain, block, oracle, time
```

## Tools cheatsheet

| Need | Tool |
|---|---|
| Verbose stack trace | `forge test -vvvv` (4 v's = full trace) |
| Single-tx replay | `cast run <txHash>` |
| Read storage slot | `cast storage <addr> <slot>` |
| Read mapping value | `cast call <addr> "balanceOf(address)" <user>` |
| Decode revert | `cast 4byte-decode 0x...` for selector, `cast --abi-decode` for data |
| Fork mainnet locally | `anvil --fork-url $MAINNET_RPC --fork-block-number N` |
| Step through opcodes | Tenderly debugger or `forge test --debug` |
| Inspect receipt | `cast receipt <txHash>` |
| Watch contract events | `cast logs --address <addr>` |
| Trace gas usage | `forge test --gas-report` |

## Console.log in Solidity

For quick `printf` debugging:

```solidity
import {console} from "forge-std/console.sol";

function deposit(uint256 amount) external {
    console.log("amount", amount);
    console.log("sender", msg.sender);
    console.log("balance", balanceOf[msg.sender]);
    // ...
}
```

`console.log` is a no-op when the contract is deployed normally; it only prints in `forge test`. Don't ship contracts with `console.log` calls — they bloat bytecode.

## Anatomy of a forge trace

```
[FAIL. Reason: assertion failed] testDepositRevertsBelowMin() (gas: 18234)
Traces:
  [18234] DepositTest::testDepositRevertsBelowMin()
    ├─ [3127] MockERC20::approve(Vault: [0xabc...], 50)
    │   └─ ← true
    ├─ [12491] Vault::deposit(50)
    │   ├─ [3000] MockERC20::transferFrom(test, Vault, 50)
    │   │   └─ ← true
    │   └─ ← "ERC4626: deposit more than max"   ← THIS IS THE REVERT
    └─ ← ()
```

The trace shows:

- Each call with its gas cost
- Arguments and return values
- The exact revert string at the deepest frame

Read traces bottom-up: the deepest revert is the proximate cause, the call chain above is the path that triggered it.

## Forks vs unit tests

- **Unit test:** isolated, deterministic, fast. Use for logic.
- **Fork test:** runs against real mainnet/testnet state at a specific block. Use for "does this work with real Aave?"

```solidity
function setUp() public {
    vm.createSelectFork("mainnet", 18_500_000);
    vault = new Vault(USDC_MAINNET);
}
```

If a bug only reproduces on mainnet, fork at the block before the bad transaction and re-run.

## Mainnet bug? Don't panic-fix.

If a deployed contract has a bug:

1. **Pause** if there's a pause function. Buy time.
2. **Assess** — is funds at risk, or just functionality broken?
3. **Communicate** — pin a notice on the dApp, post on Twitter / Discord.
4. **Fork-test the fix** before deploying.
5. **Coordinate** with users on migration / claim path.
6. **Post-mortem** publicly within a week.

Don't deploy a hot-fix without forking and testing. Don't make it worse under pressure.

## What NOT to do

- **Don't add try/catch to silence reverts.** If something reverts, there's a reason. Surface it.
- **Don't increase gas limits to "make it work."** Reverts aren't usually OOG.
- **Don't comment out the failing assertion.** Fix the cause.
- **Don't blame the compiler.** Solc bugs exist but are rare. Suspect your code first.
- **Don't fix bugs without a regression test.** The bug will return.
- **Don't refactor while debugging.** Fix one thing, commit, then refactor.

## Resources

- [references/repro-and-isolation.md](references/repro-and-isolation.md) — pin state, narrow the failing call
- [references/trace-techniques.md](references/trace-techniques.md) — forge / cast / tenderly tracing
- [references/common-bug-patterns.md](references/common-bug-patterns.md) — recognize the 15 frequent bug shapes

## What to read next

- `testing/SKILL.md` — write tests that catch bugs before deploy
- `security/SKILL.md` — bug classes that have security implications
- `gas/SKILL.md` — debug gas/OOG issues specifically
- `audit/SKILL.md` — audit-grade analysis when the stakes are high
