# Trace Techniques

You can't fix what you can't see. Tracing is how you see what the EVM actually did. This file is the cookbook for getting a usable trace out of every common debugging context.

For reproduction strategy see `references/repro-and-isolation.md`. For bug pattern recognition see `references/common-bug-patterns.md`.

## Forge verbosity levels

```bash
forge test                    # PASS / FAIL only
forge test -v                 # + test names
forge test -vv                # + console.log output
forge test -vvv               # + traces for failing tests
forge test -vvvv              # + traces for all tests, with setup
forge test -vvvvv             # + storage reads / writes (rare)
```

Default to `-vvvv` when debugging. Verbosity is free.

## Reading a forge trace

```
[FAIL. Reason: ERC4626: deposit more than max] testDepositCapped() (gas: 64812)
Traces:
  [64812] DepositTest::testDepositCapped()
    ├─ [22651] MockUSDC::approve(Vault: [0x...], 1000000)
    │   ├─ emit Approval(owner: test, spender: Vault, value: 1000000)
    │   └─ ← true
    ├─ [38900] Vault::deposit(1000000, test)
    │   ├─ [600] Vault::maxDeposit(test) [staticcall]
    │   │   └─ ← 500000
    │   └─ ← "ERC4626: deposit more than max"
    └─ ← ()
```

Key reading patterns:

- **Top-down:** test → setup → action → assertion
- **Indentation:** depth = call stack depth
- **Brackets** `[gas]` per call
- **`emit`** lines = events
- **`← value`** = return; **`← "string"`** = revert reason
- **`[staticcall]`** = read-only call

The bug here: `maxDeposit` returned `500000` but user tried `1000000`. Either the cap is wrong, or the test inputs are wrong, or there's an unfunded position.

## cast run — replay a real transaction

For a deployed transaction:

```bash
cast run --rpc-url $MAINNET_RPC 0xabc123...
```

Output looks identical to a forge trace. This is the gold standard for debugging mainnet failures.

You can `--label` known addresses:

```bash
cast run \
  --rpc-url $MAINNET_RPC \
  --label 0xa0b8...:USDC \
  --label 0xc02a...:WETH \
  0xabc123...
```

Now the trace shows token names instead of hex addresses.

## cast call — read state

Read any view function or storage slot:

```bash
# Read balanceOf
cast call $TOKEN "balanceOf(address)" $USER

# Read with --rpc-url at a specific block
cast call $TOKEN "balanceOf(address)" $USER \
  --rpc-url $MAINNET_RPC \
  --block 18_500_000

# Read raw storage slot 0
cast storage $CONTRACT 0 --rpc-url $MAINNET_RPC

# Read mapping(address => uint) at slot N: keccak256(key . slot)
cast keccak $(cast abi-encode "f(address,uint256)" $USER 5)
cast storage $CONTRACT 0xabc... # the computed slot
```

## cast 4byte — decode an unknown selector

Sometimes you see a selector in a revert and don't know what function it is:

```bash
cast 4byte 0x4e487b71
# → Panic(uint256)
```

For Panic codes specifically, the value tells you the panic kind:

| Panic | Meaning |
|---|---|
| 0x01 | Assertion failed |
| 0x11 | Arithmetic overflow / underflow |
| 0x12 | Division by zero |
| 0x21 | Invalid enum |
| 0x22 | Bad storage encoding |
| 0x31 | `pop()` on empty array |
| 0x32 | Array out of bounds |
| 0x41 | Out of memory |
| 0x51 | Called zero-initialized fn pointer |

So `Panic(0x11)` = arithmetic overflow.

## Decoding revert data

Custom errors return raw bytes. Decode them:

```bash
# Suppose revert data is 0xe450d38c000000...
cast 4byte 0xe450d38c
# → ERC20InsufficientBalance(address,uint256,uint256)

cast --abi-decode "ERC20InsufficientBalance(address,uint256,uint256)(address,uint256,uint256)" 0xe450d38c000000...
# → (0xabc..., 100, 50)
```

Now you know the user, what they tried, and what they had.

## Tenderly — visual debugger

For complex traces, [Tenderly](https://dashboard.tenderly.co/) is unmatched:

- Paste a tx hash
- Click "Debugger"
- Step through opcodes line-by-line
- See storage diffs at each step
- Hover variables to see values

Tenderly works on every EVM chain. Free tier handles individual transactions.

For private failures (a tx that didn't make it on-chain), use **Tenderly Simulator** with the bytecode and inputs.

## Anvil traces

Anvil can replay a real chain locally:

```bash
anvil --fork-url $MAINNET_RPC --fork-block-number 18_500_000
```

Send a tx against it via `cast send`:

```bash
cast send $VAULT "deposit(uint256)" 1000000 \
  --rpc-url http://localhost:8545 \
  --from $USER --unlocked
```

Then `cast run` the resulting hash for the trace, but locally — no network round trips.

## Foundry's debug mode

To step through opcodes interactively:

```bash
forge test --match-test test_failing --debug
```

Opens an interactive debugger. Keys:

- `n` — next instruction
- `s` — step into call
- `c` — continue to next breakpoint
- `g` — go to line
- `m` — show memory
- `t` — show stack

Useful for "why is this value here?" questions when traces aren't enough.

## Hardhat traces

If the codebase uses Hardhat:

```bash
npx hardhat test --verbose
```

Hardhat doesn't auto-trace failures. Add `console.log` from `hardhat/console.sol`:

```solidity
import "hardhat/console.sol";

function deposit(uint256 amount) external {
    console.log("amount", amount);
    // ...
}
```

For deployed contracts, Hardhat's `--network` and `npx hardhat trace <txHash>` work after enabling the trace plugin.

## Etherscan / Blockscan

For mainnet transactions:

- Open the tx on Etherscan
- Click "More Details" → "State"
- Click "Internal Txns" tab
- Click "Logs" tab for emitted events

Etherscan also has a "Debug" tab for failed transactions on supported chains, showing the call trace.

For Base / Arbitrum / Optimism, use the chain's Blockscan equivalent.

## Common traces and what they mean

### "EvmError: Revert" with no string

The contract reverted with empty data. Either:

- A `require(condition)` with no message
- A `revert()` with no args
- An assertion failure (`assert`)
- An external call returned a bool false where the calling contract expected revert

Add console logs around the suspect line and re-run.

### "out of gas"

OOG happens when:

- Loop iterates over unbounded data
- Recursive call depth too large
- Inefficient storage layout

Check the gas spent on the call vs the limit. Use `forge test --gas-report` to find expensive functions.

### "execution reverted: 0x..."

The 4 bytes after `0x` is the selector of a custom error. Decode:

```bash
cast 4byte 0xe450d38c
```

If unrecognized, search GitHub for the selector — popular OZ / Solmate errors are usually indexed.

### "STATICCALL" suddenly fails

A view function called something with a side effect. Check if any function in the call path is non-view. Common causes:

- Calling a non-view function from a view function
- Re-entering a view from a write context after `vm.prank`

## Trace troubleshooting

| Trace shows | Likely meaning |
|---|---|
| Long `[xxx] CONTRACT::function(...)` with no return arrow | Reverted or out-of-gas mid-execution |
| `← FailedCall()` or similar | Lower-level call returned false; caller wasn't checking |
| `delegatecall` to address that returned `("")` | Implementation address wrong (proxy bug) |
| Storage slot value that should be non-zero is zero | Storage layout collision (proxy with mismatched layout) |

## What to read next

- `references/repro-and-isolation.md` — make the failure reproducible first
- `references/common-bug-patterns.md` — recognize what the trace is showing
- `testing/SKILL.md` — write tests that produce useful traces
- `gas/SKILL.md` — debug gas-specific issues
