# Anvil and Mainnet Forking

Fork-mode testing is how you validate against real liquidity, real oracles, and real protocol state without paying gas. Anvil is Foundry's local node — `forge test` can also fork directly via cheatcodes.

## Why fork

- Test integrations against live contracts (Uniswap routers, Aave pools, Chainlink feeds) that you do not have to redeploy and seed yourself.
- Reproduce production bugs by pinning a block where you saw the bad state.
- Inspect what a tx would do on mainnet before signing it (`cast run --quick`, `anvil_impersonateAccount`).
- Run end-to-end UI flows against a private fork without burning real ETH.

## Prerequisites

You need an **archive** RPC for old blocks (anything beyond ~128 blocks back from chain head usually requires archive). Free public RPCs are typically full nodes. For pinned-block fork tests, use Alchemy, QuickNode, dRPC, or run your own with archive enabled. Verify per-provider archive availability at https://docs.alchemy.com/, https://www.quicknode.com/docs, https://drpc.org.

## anvil --fork-url

```bash
anvil \
  --fork-url $MAINNET_RPC_URL \
  --fork-block-number 19000000 \
  --auto-impersonate \
  --chain-id 1 \
  --port 8545
```

Flags worth knowing:

| Flag | Effect |
|---|---|
| `--fork-url <url>` | Source chain RPC |
| `--fork-block-number <n>` | Pin starting block; default = head |
| `--fork-chain-id <n>` | Override chain id reported to clients |
| `--auto-impersonate` | Allow `eth_sendTransaction` from any address |
| `--chain-id <n>` | What anvil reports for `eth_chainId` (defaults to fork) |
| `--block-time <s>` | Auto-mine every s seconds (default: instant on tx) |
| `--no-mining` | Mine only via `evm_mine` |
| `--code-size-limit <n>` | Raise EIP-170 24 KiB cap for tests |
| `--steps-tracing` | Verbose VM step tracing |
| `--silent` | Suppress request logs |
| `--dump-state ./s.json` | Snapshot state on shutdown |
| `--load-state ./s.json` | Resume from snapshot |
| `--state ./s.json` | Both load and dump (sticky state) |
| `--prune-history` | Trim memory by dropping unneeded historical state |

Default 10 unlocked accounts each holding 10000 ETH. Print account info on start; the deterministic mnemonic `test test test test test test test test test test test junk` produces the same accounts every time.

## Forking from inside a test (preferred)

`forge test --fork-url $RPC` forks the entire suite. Per-test forks via cheatcodes are usually cleaner:

```solidity
import {Test} from "forge-std/Test.sol";

contract ForkTest is Test {
    uint256 mainnet;
    uint256 base;

    function setUp() public {
        mainnet = vm.createFork(vm.envString("MAINNET_RPC_URL"), 19_000_000);
        base    = vm.createFork(vm.envString("BASE_RPC_URL"),    12_500_000);
        vm.selectFork(mainnet);
    }

    function test_OnMainnet() public {
        vm.selectFork(mainnet);
        // assertions against mainnet state at block 19_000_000
    }

    function test_OnBase() public {
        vm.selectFork(base);
        // assertions against base state at block 12_500_000
    }
}
```

Cheatcode reference:

| Cheatcode | Behavior |
|---|---|
| `vm.createFork(url)` | Fork at chain head; returns fork id |
| `vm.createFork(url, block)` | Fork at specific block |
| `vm.createSelectFork(url, block)` | Create + select |
| `vm.selectFork(id)` | Switch active fork |
| `vm.activeFork()` | Returns current fork id |
| `vm.rollFork(block)` | Move active fork to a new block |
| `vm.rollFork(id, block)` | Move a specific fork |
| `vm.makePersistent(addr)` | Keep contract code/state across `selectFork` |
| `vm.revokePersistent(addr)` | Stop persisting |
| `vm.isPersistent(addr)` | Check persistence |

Persistent contracts are the bridge for cross-fork tests: deploy a helper on fork A, mark it persistent, switch to fork B, the helper retains its address and code (state is per-fork).

## Pinning blocks for reproducibility

```solidity
function setUp() public {
    vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), 19_000_000);
}
```

Without a block, fork tests use head — your CI run today and your local run tomorrow disagree. Pin a block, write the result down, and treat upgrades to that block as deliberate.

When you need newer state (e.g. testing a freshly deployed contract), bump the pinned block and re-run; do not silently rely on head.

## Time travel

```solidity
vm.warp(block.timestamp + 7 days);   // change block.timestamp
vm.roll(block.number + 50);          // change block.number
```

`warp` is what you use for vesting cliffs, lockups, oracle staleness checks, and Aave/Compound interest accrual. `roll` is what you use when a contract reads `block.number` directly (rate limits, governance proposals).

Note: forking does **not** advance time automatically when you mine. If your contract relies on continuous accrual (e.g. checks `lastUpdate < block.timestamp`), call `vm.warp` explicitly.

## Impersonating whales

```solidity
address whale = 0x55FE002aefF02F77364de339a1292923A15844B8;
address usdc  = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;

function test_WhaleDeposit() public {
    vm.prank(whale);
    IERC20(usdc).transfer(address(this), 100_000e6);
    // now we have real USDC without minting
}
```

For ETH balances, prefer `deal(addr, amount)` from forge-std over impersonating a whale. For ERC-20s, `deal(token, addr, amount)` works for most tokens but **fails on tokens with non-standard storage** (e.g. rebasing tokens, tokens whose balance is computed from index). For those, impersonate a real holder.

`deal(token, addr, amount, true)` adjusts `totalSupply` to keep accounting consistent — required for some tests that check supply.

## Snapshot / revert (within a test)

```solidity
function test_DepositPreservesPause() public {
    uint256 snap = vm.snapshotState();
    pauseable.pause();
    vm.expectRevert();
    vault.deposit(1e6, address(this));
    vm.revertToState(snap);             // back to pre-pause state
    vault.deposit(1e6, address(this));  // works
}
```

`vm.snapshotState()` captures the entire EVM state of the active fork; `vm.revertToState(id)` restores it. Cheaper than re-running `setUp`. The legacy names `vm.snapshot()` / `vm.revertTo(id)` still alias in current forge-std but are deprecated — verify at https://book.getfoundry.sh/cheatcodes/.

## Reading raw storage on a fork

```solidity
bytes32 slot0 = vm.load(0xUniswapV3Pool, bytes32(0));
// slot0 is packed; decode by bit-shifting (NOT abi.decode — abi.decode expects ABI encoding, not packed)
uint160 sqrtPriceX96 = uint160(uint256(slot0));
int24   tick         = int24(uint24(uint256(slot0) >> 160));
uint16  obsIndex     = uint16(uint256(slot0) >> 184);
// remaining fields shifted further; consult Uniswap V3 Pool storage layout
```

Or via `cast`:

```bash
cast storage 0xPool 0 --rpc-url $RPC --block 19000000
cast storage 0xPool 0 --rpc-url http://localhost:8545
```

For mappings, compute the slot:

```bash
# slot of mapping(address => uint) at base slot 1, key 0xAlice
cast index address 0xAlice 1
cast storage 0xToken $(cast index address 0xAlice 1) --rpc-url $RPC
```

## cast run — replay any tx

```bash
cast run 0xTxHash --rpc-url $RPC --quick                # print trace
cast run 0xTxHash --rpc-url $RPC                        # full trace, slower
cast run 0xTxHash --rpc-url $RPC --debug                # interactive debugger
cast run 0xTxHash --rpc-url $RPC --label 0xVault:Vault  # add labels
```

`--quick` skips state setup and re-executes against the parent block — fast and usually sufficient. Without it, the runner replays every prior tx in the block which is much slower but matches mainnet exactly.

For "what would this tx do if I sent it?":

```bash
# Encode a tx, simulate against a fork
cast send --unlocked 0xTo "fn()" --from 0xWhale --rpc-url http://localhost:8545
```

## Multi-fork stress test pattern

```solidity
contract MultiChainTest is Test {
    struct Chain { string name; uint256 fork; address asset; }
    Chain[] internal chains;

    function setUp() public {
        chains.push(Chain("mainnet", vm.createFork(vm.envString("MAINNET_RPC_URL")), 0xA0b8...EB48));
        chains.push(Chain("base",    vm.createFork(vm.envString("BASE_RPC_URL")),    0x8335...2913));
        chains.push(Chain("arb",     vm.createFork(vm.envString("ARBITRUM_RPC_URL")),0xaf88...831));
    }

    function test_DepositOnEachChain() public {
        for (uint256 i; i < chains.length; i++) {
            vm.selectFork(chains[i].fork);
            // deploy vault on this fork
            // assert deposit semantics match
        }
    }
}
```

Each fork is an isolated EVM. Deploying on one fork does not leak to another unless you mark addresses persistent.

## State dumps for shared dev environments

```bash
anvil --fork-url $RPC --fork-block-number 19000000 \
      --dump-state ./fixtures/state.json
# ... run a deploy script, seed accounts, set roles ...
# Ctrl-C — anvil writes state.json on shutdown

anvil --load-state ./fixtures/state.json --port 8545
```

Commit state dumps for fast e2e tests that don't need to re-run the seed each run. Caveat: dumps are tied to an anvil version (verify compatibility at https://github.com/foundry-rs/foundry).

## Cache and rate limits

Foundry caches RPC responses under `~/.foundry/cache/` — this is what makes pinned-block fork tests fast on the second run. Clear with `forge cache clean` if a provider returns stale or wrong data.

Free RPC tiers will rate-limit fork tests. Symptoms: `429 Too Many Requests`, missing logs, slow reverts. Mitigations:

- Run a paid provider (Alchemy free tier 300M CU/mo handles most fork suites — verify current limits at https://www.alchemy.com/pricing).
- Pin a block — Foundry can cache aggressively when state is stable.
- Set `FOUNDRY_RPC_TIMEOUT_MS=120000` for slow upstreams.
- Use `--no-storage-caching` only when debugging cache issues; default is to cache.

For very heavy suites, run a local archive node (Reth, Erigon) with `--http`. Verify hardware requirements at https://reth.rs/ or https://github.com/erigontech/erigon.

## Anvil RPC namespaces (cheats over JSON-RPC)

When testing client code (not Solidity), call anvil cheats over RPC:

```bash
# Set balance
cast rpc anvil_setBalance 0xAlice 0xDE0B6B3A7640000 --rpc-url http://localhost:8545

# Impersonate
cast rpc anvil_impersonateAccount 0xWhale --rpc-url http://localhost:8545
cast send 0xUSDC "transfer(address,uint256)" 0xMe 1e6 \
  --from 0xWhale --unlocked --rpc-url http://localhost:8545
cast rpc anvil_stopImpersonatingAccount 0xWhale --rpc-url http://localhost:8545

# Set storage slot
cast rpc anvil_setStorageAt 0xToken 0x0 0x...newvalue --rpc-url http://localhost:8545

# Mine
cast rpc evm_mine --rpc-url http://localhost:8545
cast rpc evm_increaseTime 86400 --rpc-url http://localhost:8545
```

Hardhat-compatible aliases (`hardhat_setBalance`, `hardhat_impersonateAccount`, etc.) work too — useful when porting Hardhat scripts.

## Debugging failed tx

```bash
# Get the exact revert
cast call 0xAddr "fn()" --rpc-url $RPC          # cast call surfaces revert reason
cast estimate 0xAddr "fn()" --rpc-url $RPC

# Replay with traces
cast run 0xTxHash --rpc-url $RPC

# Trace a forge test
forge test --match-test test_BrokenThing -vvvv  # full call trace + setup
forge test --debug test_BrokenThing             # opens interactive debugger
```

The interactive debugger lets you step opcodes, inspect stack/memory/storage, and view source mapping. Arrow keys, `q` to quit, `?` for help.

## L2-specific gotchas

- **Optimism / Base / Arbitrum** charge L1 calldata in addition to L2 execution gas. `forge test --gas-report` reports L2 gas only. To estimate true cost, deploy to a testnet and use the chain's gas oracle (`OptimismGasPriceOracle.getL1Fee`, `ArbGasInfo.getL1BaseFeeEstimate`).
- **zkSync Era** has its own EVM differences (no `selfdestruct`, account abstraction native, paymasters). Foundry support is via `foundry-zksync` fork — verify status at https://github.com/matter-labs/foundry-zksync.
- **Some L2s** lag mainnet on opcodes (`MCOPY`, `BLOBHASH`, `TLOAD/TSTORE`). Set `evm_version` in `foundry.toml` to match the target chain's hard fork.

## What to read next

- `references/foundry-deep-dive.md` — `forge test` flag reference
- `references/rpc-and-explorers.md` — choosing an archive provider
- Anvil section of the book: https://book.getfoundry.sh/anvil/
- Foundry cheatcodes: https://book.getfoundry.sh/cheatcodes/
