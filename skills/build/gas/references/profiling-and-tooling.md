# Gas Profiling and Tooling

The toolchain for measuring, snapshotting, and debugging gas. Use these to prove an optimization works before merging it.

## `forge test --gas-report`

Runs the test suite and prints a per-function table:

```
| src/Vault.sol:Vault contract |                 |       |        |       |         |
|------------------------------|-----------------|-------|--------|-------|---------|
| Function Name                | min             | avg   | median | max   | # calls |
| deposit                      | 86234           | 91102 | 91102  | 95971 | 2       |
| withdraw                     | 47812           | 47812 | 47812  | 47812 | 1       |
```

Configure in `foundry.toml` for a specific suite:

```toml
[profile.default]
gas_reports = ["Vault", "Strategy"]   # only these contracts
gas_reports_ignore = ["MockERC20"]
```

The `avg` is the mean across all test calls — outliers in setup tests skew it. Look at `min` and `max` for the realistic range.

## `forge snapshot` — diff-able gas baselines

```bash
forge snapshot                              # writes .gas-snapshot
forge snapshot --check                      # CI: fail if diff vs committed snapshot
forge snapshot --diff .gas-snapshot         # show deltas vs prior snapshot
```

Workflow:

1. Commit `.gas-snapshot` to the repo.
2. CI runs `forge snapshot --check` — fails the PR if any test's gas changed.
3. When optimizing intentionally, run `forge snapshot` to update the file and commit it as part of the PR.

Tolerance: by default any change fails. To allow small deltas:

```bash
forge snapshot --check --tolerance 100      # allow +/- 100 gas per test
```

## `console.log` for inline gas measurement

Add per-line measurements to a test:

```solidity
import {console2} from "forge-std/console2.sol";

function test_deposit_gas() public {
    uint256 g0 = gasleft();
    vault.deposit(100e18, alice);
    uint256 g1 = gasleft();
    console2.log("deposit gas:", g0 - g1);
}
```

`forge test -vv` prints `console2` output. Useful for measuring sub-blocks of a function during optimization sprints.

## `forge debug` — step through opcodes

```bash
forge debug --debug Vault.sol:Vault.deposit -vvvvv -- 100e18 0x...
```

Opens an interactive TUI:

- `n` — step to next opcode
- `s` — step over (call into) functions
- `c` — continue to next breakpoint
- Shows stack, memory, storage, and the gas remaining at each opcode

Use it to find where unexpected gas is going — a `MUL` taking 200k gas is a `KECCAK256` in disguise.

## `cast run` — replay a real tx with a trace

```bash
cast run 0x<txHash> --rpc-url $RPC --quick
```

Replays a historical transaction in a local fork and prints the call trace with gas per call. With `-vvvv` shows opcode-level for the failing call.

For more detail:

```bash
cast run 0x<txHash> --rpc-url $RPC --debug    # full debug TUI
```

## EVM debugger via Foundry

When `forge test --gas-report` says a function is expensive but you don't know why, run with maximum verbosity:

```bash
forge test --match-test test_deposit -vvvv
```

`-vvvv` prints the full call tree with gas per call:

```
[91102] Vault::deposit(100000000000000000000, ...)
  ├─ [22918] USDC::transferFrom(alice, vault, 100e18)
  ├─ [38234] _updateAccrual()
  │   └─ [12109] StETH::balanceOf(vault)
  └─ [29950] emit Deposit(...)
```

Each subcall shows its gas; the overhead at the top is the parent's bookkeeping. Hot spots become obvious.

## Hardhat gas reporter (if working in Hardhat)

```bash
npm install --save-dev hardhat-gas-reporter
```

```js
// hardhat.config.js
require("hardhat-gas-reporter");
module.exports = {
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
    coinmarketcap: process.env.CMC_KEY,
    L1: "ethereum",
    L2: "base",
    excludeContracts: ["MockERC20"],
  },
};
```

Prints USD costs in addition to gas, by querying CoinMarketCap or a configured oracle. For L2 chains it splits L1 + L2.

## Tenderly — production gas profiling

Tenderly (https://tenderly.co/) shows opcode-level gas for any historical or simulated transaction. Paste a tx hash, get a flame-graph. Particularly useful for debugging "this swap that worked yesterday now reverts on revertByOOG."

Free tier covers most needs. The `tenderly_simulateBundle` RPC method lets you run a sequence of transactions against forked state; combined with their UI, it's the best post-mortem tool for live incidents.

## `eth_createAccessList` — pre-warming

The RPC method `eth_createAccessList` returns the list of accounts and storage slots a transaction would touch. Including this list in the tx (EIP-2930) pre-warms them at submission, paying a flat 1,900 gas per address + 19 gas per slot up front instead of cold-access penalties (2,600 + 2,100) later.

```ts
const list = await publicClient.request({
  method: "eth_createAccessList",
  params: [{ to, data, from }, "latest"],
});

// list.accessList is the array of {address, storageKeys}
// Submit a type-1 (EIP-2930) tx with that accessList, or include it in a type-2/4 tx
```

Net savings only if the tx touches many cold slots. Often a wash for simple txs; useful for cross-protocol orchestration (a swap → deposit → stake bundle that touches many addresses).

## Dune / Etherscan gas analysis

For aggregate analysis:

- **Etherscan gas tracker** (https://etherscan.io/gastracker) — historical fees, percentiles.
- **Dune dashboards**: query `ethereum.transactions` for your contract's gas distribution: which functions cost most, which times of day, which selectors burn budget.

```sql
SELECT
  date_trunc('day', block_time) as day,
  bytes2numeric(substring(data, 1, 4)) as selector,
  avg(gas_used) as avg_gas,
  count(*) as txs
FROM ethereum.transactions
WHERE "to" = 0xYourContract
  AND block_time > now() - interval '7 days'
GROUP BY 1, 2
ORDER BY 1 DESC, 4 DESC;
```

This kind of breakdown surfaces the function that 80% of users hit — the one that should get optimization attention.

## Bytecode size

```bash
forge build --sizes
```

```
| Contract       | Runtime Size (B) | Init Size (B) |
|----------------|-------------------|---------------|
| Vault          | 14523             | 17891         |
| Strategy       | 9120              | 11034         |
```

24,576 bytes is the EIP-170 hard limit for runtime. If a contract approaches this:

- Move pure helpers into a library (linked at deploy).
- Toggle `via-ir = true` (often produces smaller bytecode).
- Increase `optimize-runs` (counterintuitively can shrink runtime for some patterns).
- Split into multiple contracts (proxy + implementation, or facets via diamond pattern — but only if you actually need the upgradeability).

## CI gas regression check (GitHub Actions)

```yaml
name: gas-check
on: pull_request
jobs:
  snapshot:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: foundry-rs/foundry-toolchain@v1
      - run: forge install
      - run: forge snapshot --check --tolerance 50
```

Combined with `forge build --sizes` post-build to catch contracts that crossed the EIP-170 line.

## Common pitfalls

- **`gasleft()` itself costs gas**: the value you measure with `g0 - g1` includes the cost of the two `gasleft()` calls (~2 gas each). Negligible, but don't treat the number as exact.
- **First call vs subsequent calls**: cold storage, cold accounts make the first invocation of a function much more expensive than the second. Test both.
- **`vm.pauseGasMetering()` / `vm.resumeGasMetering()`**: lets you exclude setup gas from measurement. Use it when measuring a single operation inside a complex test.
- **`forge test --gas-report` vs production gas**: Foundry's default profile uses `optimizer = true, runs = 200`. Production deployments often use different runs. Match `foundry.toml` to your real deployment config.
- **L2 gas reports miss the L1 fee**: `forge test --gas-report` measures L2 execution only. For OP Stack, simulate via a fork against the GasPriceOracle to get the L1 portion.
- **`hardhat-gas-reporter` USD pricing is at report-run time**, not at the time of the historical data — useful for relative comparisons, not absolute fee history.
- **Snapshots churn on minor refactors**: each compiler version, each optimizer-runs change shifts gas. Pin both in CI.

## What to read next

- `references/optimization-patterns.md` — what to fix once profiling shows the hot path
- `references/l2-economics.md` — beyond execution gas, the L1 data fee
- Foundry book: https://book.getfoundry.sh/forge/gas-tracking
- Tenderly: https://docs.tenderly.co/
