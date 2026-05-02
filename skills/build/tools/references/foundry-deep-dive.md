# Foundry Deep Dive

Foundry is the default Ethereum dev toolkit in 2026. This is a runnable cookbook for `forge`, `cast`, and `anvil` plus `foundry.toml` configuration. Pin tool versions in CI — Foundry is on a rolling release; use `foundryup --version <commit-or-tag>` and verify against https://book.getfoundry.sh/.

## Install and Pin

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup                                       # latest stable
foundryup --version nightly-<sha>              # pin a specific build
forge --version
```

In CI, prefer `foundry-rs/foundry-toolchain@v1` and pass a `version` input — verify the action at https://github.com/foundry-rs/foundry-toolchain.

## Project Layout

```
my-app/
  foundry.toml
  remappings.txt          # optional; foundry.toml [profile.default] remappings preferred
  src/
    Vault.sol
  test/
    Vault.t.sol
  script/
    Deploy.s.sol
  lib/
    forge-std/            # git submodule
    openzeppelin-contracts/
```

Initialize:

```bash
forge init my-app --no-git
cd my-app
forge install OpenZeppelin/openzeppelin-contracts@v5.1.0
forge install foundry-rs/forge-std
forge build
```

`forge install` adds a git submodule. To consume an exact tag, pass `<org>/<repo>@<tag>`. To bump:

```bash
forge update lib/openzeppelin-contracts
```

## foundry.toml

A production config covering most needs:

```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc_version = "0.8.28"        # pin compiler explicitly
evm_version = "cancun"         # or "shanghai" for L2s without 4844 yet
optimizer = true
optimizer_runs = 1_000_000     # bias for runtime cost; lower for deploy-cost
via_ir = false                 # enable when stack-too-deep; slower compile
bytecode_hash = "none"         # deterministic deploys
fs_permissions = [{ access = "read", path = "./" }]

remappings = [
  "@openzeppelin/=lib/openzeppelin-contracts/",
  "forge-std/=lib/forge-std/src/",
]

[profile.default.fuzz]
runs = 1000
max_test_rejects = 65536
seed = "0x1"                   # deterministic fuzzing in CI

[profile.default.invariant]
runs = 256
depth = 500
fail_on_revert = false
call_override = false

[profile.ci]
fuzz = { runs = 10000 }
invariant = { runs = 1000, depth = 2000 }
verbosity = 3

[fmt]
line_length = 120
tab_width = 4
bracket_spacing = false
int_types = "long"             # uint256 not uint
quote_style = "double"

[rpc_endpoints]
mainnet = "${MAINNET_RPC_URL}"
base    = "${BASE_RPC_URL}"
arb     = "${ARBITRUM_RPC_URL}"
op      = "${OPTIMISM_RPC_URL}"
sepolia = "${SEPOLIA_RPC_URL}"

[etherscan]
mainnet = { key = "${ETHERSCAN_API_KEY}" }
base    = { key = "${ETHERSCAN_API_KEY}", chain = 8453 }
arb     = { key = "${ETHERSCAN_API_KEY}", chain = 42161 }
op      = { key = "${ETHERSCAN_API_KEY}", chain = 10 }
```

Note on Etherscan v2: a single API key works across most chains supported by Etherscan v2 (mainnet, Base, Arbitrum, Optimism, Polygon, Linea, Scroll, others). Verify the chain list and migration status at https://docs.etherscan.io/. For chains not on Etherscan v2 (e.g. Blockscout-only L2s), use `verifier = "blockscout"` and `verifier_url`.

Run an alternate profile:

```bash
FOUNDRY_PROFILE=ci forge test
```

## forge build

```bash
forge build                               # incremental
forge build --force                       # ignore cache
forge build --sizes                       # print contract bytecode sizes (24 KiB limit reminder)
forge build --skip script test            # skip non-src
forge build --use 0.8.28                  # override solc version once
forge build --extra-output storageLayout  # emit storage layouts to out/
```

If you hit `Stack too deep` during compilation, enable `via_ir = true` in `foundry.toml`. Compile time roughly doubles — consider scoping it to a single contract via `[profile.default.compilation_restrictions]` (verify field names against https://book.getfoundry.sh/reference/config/).

## forge test

```bash
forge test                                # all tests, default verbosity
forge test -vv                            # logs from console2
forge test -vvv                           # + traces for failing
forge test -vvvv                          # + setup traces
forge test -vvvvv                         # + traces for passing
forge test --match-contract VaultTest
forge test --match-test test_Deposit
forge test --match-path "test/Vault*"
forge test --no-match-test invariant_
forge test --gas-report                   # gas usage per function
forge test --watch                        # rerun on change
forge test --fork-url $MAINNET_RPC_URL    # mainnet fork
forge test --fork-block-number 19000000   # pin a fork block
forge test --fuzz-runs 10000
forge test --invariant-runs 1000 --invariant-depth 2000
forge test --debug test_Deposit           # interactive debugger
```

Coverage:

```bash
forge coverage --report lcov --report-file lcov.info
forge coverage --report summary --no-match-coverage "(test|script)/"
```

Coverage instruments every line — slow on large suites. Use `--no-match-coverage` to drop test/script files; use `--match-contract` to scope. For invariant test coverage you may need `--ir-minimum` (verify in current docs).

## Test patterns with forge-std

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, console2} from "forge-std/Test.sol";
import {Vault} from "../src/Vault.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract VaultTest is Test {
    Vault internal vault;
    address internal alice = makeAddr("alice");
    address internal usdc   = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48; // mainnet USDC
    address internal whale  = 0x55FE002aefF02F77364de339a1292923A15844B8; // arbitrary

    function setUp() public {
        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), 19_000_000);
        vault = new Vault(IERC20(usdc));
        vm.label(alice, "alice");
        vm.label(usdc, "USDC");
    }

    function test_Deposit_TransfersAndMintsShares() public {
        uint256 amount = 1_000e6;
        deal(usdc, alice, amount);                  // forge-std cheat
        vm.startPrank(alice);
        IERC20(usdc).approve(address(vault), amount);
        uint256 shares = vault.deposit(amount, alice);
        vm.stopPrank();

        assertEq(vault.balanceOf(alice), shares);
        assertEq(IERC20(usdc).balanceOf(address(vault)), amount);
    }

    function testFuzz_DepositWithdraw_RoundsDown(uint96 amount) public {
        amount = uint96(bound(amount, 1, type(uint96).max));
        deal(usdc, alice, amount);
        vm.startPrank(alice);
        IERC20(usdc).approve(address(vault), amount);
        uint256 shares = vault.deposit(amount, alice);
        uint256 out = vault.redeem(shares, alice, alice);
        vm.stopPrank();
        assertLe(out, amount);
    }

    function test_RevertWhen_DepositZero() public {
        vm.expectRevert(Vault.ZeroAmount.selector);
        vault.deposit(0, alice);
    }

    function test_EmitsDeposit() public {
        deal(usdc, alice, 1e6);
        vm.startPrank(alice);
        IERC20(usdc).approve(address(vault), 1e6);
        vm.expectEmit(true, true, false, true, address(vault));
        emit Vault.Deposit(alice, alice, 1e6, 1e6);
        vault.deposit(1e6, alice);
        vm.stopPrank();
    }
}
```

Cheatcodes you will actually use:

| Cheatcode | Purpose |
|---|---|
| `vm.prank(addr)` | Sets `msg.sender` for the next call only |
| `vm.startPrank` / `vm.stopPrank` | Prank for many calls |
| `vm.deal(addr, eth)` | Set ETH balance |
| `deal(token, addr, amt)` (StdCheats) | Set ERC-20 balance |
| `vm.expectRevert(selector)` | Expect specific revert |
| `vm.expectEmit(t1, t2, t3, data, addr)` | Expect a log; emit immediately after |
| `vm.warp(ts)` | Set `block.timestamp` |
| `vm.roll(blockNum)` | Set `block.number` |
| `vm.createSelectFork(url, block)` | Fork into a specific block |
| `vm.selectFork(forkId)` | Switch active fork |
| `vm.recordLogs()` / `vm.getRecordedLogs()` | Capture all events |
| `vm.broadcast()` / `vm.startBroadcast()` | Mark calls as live tx in scripts |
| `vm.envString` / `envUint` / `envAddress` | Read env vars |
| `vm.skip(true)` | Skip a test (return without failure) |
| `vm.assume(cond)` | Reject fuzz inputs that violate `cond` |
| `bound(x, min, max)` | Bound a fuzz input to a range |

## Invariant tests

```solidity
import {Test} from "forge-std/Test.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";
import {Vault} from "../src/Vault.sol";
import {VaultHandler} from "./handlers/VaultHandler.sol";

contract VaultInvariantTest is StdInvariant, Test {
    Vault internal vault;
    VaultHandler internal handler;

    function setUp() public {
        vault = new Vault(/*...*/);
        handler = new VaultHandler(vault);
        targetContract(address(handler));        // restrict the fuzzer
        bytes4[] memory selectors = new bytes4[](3);
        selectors[0] = handler.deposit.selector;
        selectors[1] = handler.withdraw.selector;
        selectors[2] = handler.harvest.selector;
        targetSelector(FuzzSelector(address(handler), selectors));
    }

    function invariant_TotalAssetsEqualsTokenBalance() public view {
        assertEq(vault.totalAssets(), IERC20(vault.asset()).balanceOf(address(vault)));
    }

    function invariant_SharesNonNegativePerUser() public view {
        // walk handler-tracked actors
        for (uint256 i; i < handler.actorsLength(); i++) {
            address a = handler.actorAt(i);
            assertGe(vault.balanceOf(a), 0);
        }
    }
}
```

A `Handler` narrows the fuzzer's call surface to plausible sequences. `targetContract` includes; `excludeContract` excludes. Without a handler, the fuzzer calls every public function on every contract reachable from the test, including reverts you don't care about.

## forge script

`script/Deploy.s.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {Vault} from "../src/Vault.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Deploy is Script {
    function run() external returns (Vault vault) {
        IERC20 asset = IERC20(vm.envAddress("ASSET"));
        bytes32 salt = vm.envBytes32("SALT");

        vm.startBroadcast();
        vault = new Vault{salt: salt}(asset);
        vm.stopBroadcast();

        console2.log("Vault deployed at", address(vault));
    }
}
```

Run:

```bash
forge script script/Deploy.s.sol:Deploy \
  --rpc-url base \
  --broadcast \
  --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY \
  --private-key $DEPLOYER_PK \
  --slow                                  # wait for receipts between tx
```

`new X{salt: s}(args)` inside Solidity uses `address(this)` (the script contract itself, not the broadcasting EOA) as the CREATE2 deployer — so the resulting address depends on where the script is deployed and differs across chains unless you use a fixed factory. For deterministic same-address-on-every-chain deploys via the Arachnid `0x4e59b44847b379578588920cA78FbF26c0B4956C` factory, use `forge create --salt` (which routes through Arachnid automatically) — see `references/cross-chain-deployment.md` in the `idea/l2s` skill.

Common script flags:

```
--broadcast            actually send tx; without this it's a dry run
--rpc-url <name|url>   resolve from foundry.toml [rpc_endpoints] or pass URL
--private-key $KEY     EOA hex key (avoid in prod; prefer keystore)
--keystore path.json   encrypted keystore
--account <name>       cast wallet alias
--slow                 wait for receipts; safer with reorgs
--legacy               legacy gas (chains without EIP-1559)
--with-gas-price <g>   pin tip
--gas-estimate-multiplier 130
--verify               post-deploy verify
--resume               re-run a partial broadcast
--unlocked             use eth_sendTransaction (Frame, MetaMask, dev)
```

## forge create

```bash
forge create src/Vault.sol:Vault \
  --rpc-url base \
  --private-key $DEPLOYER_PK \
  --constructor-args 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  --salt 0x0000000000000000000000000000000000000000000000000000000000000001 \
  --verify --etherscan-api-key $ETHERSCAN_API_KEY
```

`--salt` makes Foundry route the deploy through the Arachnid CREATE2 factory at `0x4e59b44847b379578588920cA78FbF26c0B4956C` (verify presence on your chain at https://github.com/Arachnid/deterministic-deployment-proxy). No separate `--create2` flag exists.

Predict an address before deploying:

```bash
INIT_CODE=$(forge inspect src/Vault.sol:Vault bytecode)
ARGS=$(cast abi-encode "constructor(address)" 0xAsset)
INIT_HASH=$(cast keccak $INIT_CODE$ARGS)
cast create2 \
  --deployer 0x4e59b44847b379578588920cA78FbF26c0B4956C \
  --salt 0x...01 \
  --init-code-hash $INIT_HASH
```

## forge verify-contract

Etherscan-compatible:

```bash
forge verify-contract \
  0xVaultAddr \
  src/Vault.sol:Vault \
  --chain base \
  --etherscan-api-key $ETHERSCAN_API_KEY \
  --constructor-args $(cast abi-encode "constructor(address)" 0xAsset) \
  --watch
```

Blockscout:

```bash
forge verify-contract \
  0xVaultAddr \
  src/Vault.sol:Vault \
  --chain optimism \
  --verifier blockscout \
  --verifier-url https://optimism.blockscout.com/api/ \
  --constructor-args $(cast abi-encode "constructor(address)" 0xAsset) \
  --watch
```

Sourcify (no API key):

```bash
forge verify-contract 0xAddr src/Vault.sol:Vault \
  --chain base --verifier sourcify --watch
```

For a CREATE2 deploy with `--salt`, Foundry verifies the runtime bytecode regardless of factory — pass the constructor args you used when deploying.

## cast — the Swiss Army knife

Read calls:

```bash
cast call 0xToken "balanceOf(address)(uint256)" 0xWallet --rpc-url base
cast call 0xVault "totalSupply()(uint256)" --rpc-url base --block 19000000
cast call 0xToken "decimals()(uint8)" --rpc-url base
cast storage 0xAddr 0 --rpc-url base       # raw slot
cast code 0xAddr --rpc-url base | head -c 80
cast nonce 0xWallet --rpc-url base
```

Write calls:

```bash
cast send 0xToken "transfer(address,uint256)" 0xTo 1000000 \
  --private-key $KEY --rpc-url base

cast send 0xRouter "swapExactTokensForTokens(uint256,uint256,address[],address,uint256)" \
  1e18 0 "[0xUSDC,0xWETH]" 0xWallet $(($(date +%s)+600)) \
  --private-key $KEY --rpc-url base
```

ABI helpers:

```bash
cast 4byte 0xa9059cbb                          # selector → signature
cast 4byte-decode 0xa9059cbb000...             # full calldata decode
cast abi-encode "transfer(address,uint256)" 0xTo 1000
cast abi-decode "balanceOf(address)(uint256)" 0x000...
cast sig "deposit(uint256,address)"            # → 0x6e553f65
cast keccak "EIP712Domain(...)"                # hash any string
cast interface 0xVerifiedOnEtherscan --rpc-url base   # generate ABI from verified contract
```

Wallet management (avoid raw private keys in shell history):

```bash
cast wallet new                                # ephemeral
cast wallet import deployer --interactive      # prompts for key, encrypts to keystore
cast wallet list
cast wallet address --account deployer
cast send 0xTo --value 0.1ether --account deployer --rpc-url base
```

Trace / debug:

```bash
cast run 0xTxHash --rpc-url $RPC --quick       # replay tx, print trace
cast run 0xTxHash --rpc-url $RPC --debug       # interactive debugger
cast tx 0xTxHash --rpc-url $RPC                # raw tx info
cast receipt 0xTxHash --rpc-url $RPC
cast access-list 0xAddr "fn()" --rpc-url $RPC  # EIP-2930 access list
cast estimate 0xAddr "fn(uint256)" 100 --rpc-url $RPC
```

ENS:

```bash
cast resolve-name vitalik.eth --rpc-url $MAINNET_RPC_URL
cast lookup-address 0x... --rpc-url $MAINNET_RPC_URL
```

Conversions:

```bash
cast --to-wei 1.5 ether
cast --from-wei 1500000000000000000
cast --to-unit 1e18 ether
cast --to-hex 1234
cast --to-dec 0x4d2
cast --to-bytes32 "hello"
cast pretty-calldata 0xa9059cbb...
```

## anvil

Local node — see `references/anvil-and-forking.md` for a fork cookbook. Quick reference:

```bash
anvil                                          # ephemeral 0xf39F... accounts
anvil --fork-url $RPC --fork-block-number N    # mainnet fork
anvil --auto-impersonate                       # any from-address works
anvil --block-time 2                           # 2-second blocks (vs on-demand)
anvil --no-mining                              # mine only via evm_mine RPC
anvil --port 8545 --host 0.0.0.0
anvil --chain-id 31337
anvil --state state.json                       # persist state between runs
anvil --code-size-limit 50000                  # bypass 24KiB EIP-170 in dev
```

State dump / load:

```bash
anvil --dump-state ./state.json
anvil --load-state ./state.json
```

Anvil exposes the `anvil_*` and `hardhat_*` namespaces — useful in tests but not on real chains:

```
anvil_setBalance, anvil_setCode, anvil_setStorageAt
anvil_impersonateAccount, anvil_stopImpersonatingAccount
anvil_mine, evm_mine, evm_increaseTime, evm_setNextBlockTimestamp
anvil_snapshot, anvil_revert
```

## Common pitfalls

- **`forge install` adds a submodule.** Cloning fresh requires `--recurse-submodules` or `git submodule update --init --recursive`.
- **`forge update` updates ALL submodules** unless you pass a path. Pin tags in `lib/<dep>` via `git -C lib/<dep> checkout <tag>` and commit.
- **Default sender in tests is `0x1804...DefaultSender`** (a forge-std constant). If a test fails with an unexpected access-control revert, pranks may have been missed.
- **`vm.prank` only affects the next call**, not internal subcalls. Use `vm.startPrank` for sequences.
- **`vm.expectRevert` consumes the next external call only** — including library calls compiled to delegatecall. If your error nests, pass the wrapping selector.
- **`vm.expectEmit(t1,t2,t3,data,addr)` defaults to NOT checking the address**; pass the emitter explicitly when multiple contracts emit similar events.
- **`forge coverage` recompiles without optimizer** — coverage numbers don't reflect production bytecode behavior.
- **Mainnet fork tests inherit live state** — pinning a block (`vm.createSelectFork(url, blockNum)`) is mandatory for reproducibility.
- **`forge test --gas-report`** reports gas in test context (no L1 calldata cost on rollups). For real deployment costs, deploy and replay via `cast estimate` against the actual chain.
- **Stack-too-deep** during compile: enable `via_ir = true` or break the function. Tests can hit this too — use intermediate structs.
- **Solidity version drift across libs**: pin `solc_version` in `foundry.toml`. `^0.8.28` lets a transitive dep pull a newer solc.
- **`forge fmt` rewrites comments and trailing commas**; configure `[fmt]` in `foundry.toml` per repo or set `--check` in CI.

## CI snippet (GitHub Actions)

```yaml
jobs:
  forge:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { submodules: recursive }
      - uses: foundry-rs/foundry-toolchain@v1
        with: { version: nightly-<sha> }    # pin
      - run: forge --version
      - run: forge build --sizes
      - run: FOUNDRY_PROFILE=ci forge test
        env:
          MAINNET_RPC_URL: ${{ secrets.MAINNET_RPC_URL }}
      - run: forge coverage --report summary --no-match-coverage "(test|script)/"
```

## What to read next

- `references/anvil-and-forking.md` — fork tests, time travel, multi-fork
- `references/viem-and-wagmi.md` — frontend + scripting in TypeScript
- `references/rpc-and-explorers.md` — provider tradeoffs and verification
- `references/agent-tooling.md` — MCP, abi.ninja, x402 from agents
- Foundry book: https://book.getfoundry.sh/ (canonical, updated continuously)
