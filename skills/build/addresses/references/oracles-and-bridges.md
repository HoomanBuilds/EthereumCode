# Oracles and Bridges Cookbook

Working snippets for Chainlink price feeds (with sequencer-uptime gating on L2s), Chainlink CCIP for cross-chain messaging, and Across SpokePool for fast bridging. Verify addresses against `SKILL.md` and the protocol docs before each integration — feed addresses migrate, sequencer-uptime feeds are mandatory on L2s, and Across versions periodically.

## Chainlink price feeds

A feed is an `AggregatorV3Interface` proxy that returns the latest answer plus metadata about how stale it might be.

### Read a feed (mainnet ETH/USD)

```solidity
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

AggregatorV3Interface constant ETH_USD =
    AggregatorV3Interface(0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419);

function getEthPrice() external view returns (int256 price, uint8 decimals) {
    (uint80 roundId, int256 answer, /*startedAt*/, uint256 updatedAt, uint80 answeredInRound)
        = ETH_USD.latestRoundData();
    require(answer > 0,                    "negative price");
    require(updatedAt != 0,                "round not complete");
    require(block.timestamp - updatedAt < 1 hours, "stale price");
    require(answeredInRound >= roundId,    "stale round");
    return (answer, ETH_USD.decimals());
}
```

`decimals()` is 8 for USD-quoted feeds, 18 for ETH-quoted. Read it once and cache — it never changes for a given proxy.

**Staleness threshold (`heartbeat`)**: each feed has a heartbeat (e.g. 1 hour for ETH/USD on mainnet) — Chainlink guarantees an update at least that often, plus deviation-triggered updates. Pick a threshold ≥ heartbeat for the feeds you depend on. Read the heartbeat from the Chainlink data-feeds page; it varies per feed and per chain.

### Sequencer-uptime gating (L2s — MANDATORY)

On Arbitrum, Optimism, Base, and other rollups, the sequencer can pause. While paused, oracle feeds keep their last value but no new updates land — protocols that don't gate on sequencer uptime can be liquidated against an artificially-stale price the moment the sequencer comes back.

The pattern (Chainlink's example, used by Aave V3 on L2s):

```solidity
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

// Sequencer uptime feed addresses (verify at https://docs.chain.link/data-feeds/l2-sequencer-feeds):
//   Arbitrum One : 0xFdB631F5EE196F0ed6FAa767959853A9F217697D
//   Base         : 0xBCF85224fc0756B9Fa45aA7892530B47e10b6433
//   Optimism     : 0x371EAD81c9102C9BF4874A9075FFFf170F2Ee389
AggregatorV3Interface constant SEQUENCER =
    AggregatorV3Interface(0xFdB631F5EE196F0ed6FAa767959853A9F217697D);

uint256 constant GRACE_PERIOD = 1 hours;

function getPriceL2(AggregatorV3Interface feed) external view returns (int256) {
    (, int256 seqAnswer, uint256 startedAt, ,) = SEQUENCER.latestRoundData();
    // 0 = up, 1 = down. startedAt is when the current up/down state began.
    require(seqAnswer == 0,                            "sequencer down");
    require(block.timestamp - startedAt > GRACE_PERIOD, "grace period");

    (, int256 price, , uint256 updatedAt, ) = feed.latestRoundData();
    require(price > 0 && block.timestamp - updatedAt < 1 hours, "stale");
    return price;
}
```

**Grace period**: 1 hour after the sequencer comes back is the conservative default. Within the grace period, even though the sequencer is up, recent price-feed updates may still reflect stale state — reject.

### Reading from off-chain (viem)

```ts
import { parseAbi } from "viem";

const feedAbi = parseAbi([
  "function decimals() view returns (uint8)",
  "function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)",
] as const);

const [decimals, [, answer, , updatedAt]] = await Promise.all([
  publicClient.readContract({ address: ETH_USD, abi: feedAbi, functionName: "decimals" }),
  publicClient.readContract({ address: ETH_USD, abi: feedAbi, functionName: "latestRoundData" }),
]);

const priceUsd = Number(answer) / 10 ** decimals;       // ~$1988
const ageSec   = Math.floor(Date.now() / 1000) - Number(updatedAt);
```

## Chainlink CCIP — cross-chain messaging

CCIP lets you send tokens + arbitrary message data from one chain to another with finality and a programmable receiver. The `Router` is the entry point on each chain.

Confirm a CCIP Router on a new chain: `cast call <router> "typeAndVersion()(string)"` — current version returns `"Router 1.2.0"`.

### Send tokens + data (sender side)

```solidity
import {IRouterClient} from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/IRouterClient.sol";
import {Client}        from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";

IRouterClient constant ROUTER = IRouterClient(0x80226fc0Ee2b096224EeAc085Bb9a8cba1146f7D); // mainnet
uint64 constant DEST_BASE = 15971525489660198786; // CCIP chain selector for Base

function sendUsdc(address receiver, uint256 amount) external payable {
    Client.EVMTokenAmount[] memory tokenAmounts = new Client.EVMTokenAmount[](1);
    tokenAmounts[0] = Client.EVMTokenAmount({ token: USDC, amount: amount });

    IERC20(USDC).safeIncreaseAllowance(address(ROUTER), amount);

    Client.EVM2AnyMessage memory message = Client.EVM2AnyMessage({
        receiver:    abi.encode(receiver),
        data:        abi.encode("hello"),
        tokenAmounts: tokenAmounts,
        extraArgs:   Client._argsToBytes(Client.EVMExtraArgsV2({
            gasLimit: 200_000,
            allowOutOfOrderExecution: true
        })),
        feeToken: address(0) // pay native; pass LINK address to pay LINK
    });

    uint256 fee = ROUTER.getFee(DEST_BASE, message);
    require(msg.value >= fee, "insufficient fee");

    bytes32 messageId = ROUTER.ccipSend{value: fee}(DEST_BASE, message);
    if (msg.value > fee) payable(msg.sender).transfer(msg.value - fee);
}
```

**Chain selectors are CCIP-specific 64-bit IDs**, NOT EVM chainIds. Look them up at https://docs.chain.link/ccip/directory/mainnet/chain/.

### Receive on the destination

```solidity
import {CCIPReceiver} from "@chainlink/contracts-ccip/src/v0.8/ccip/applications/CCIPReceiver.sol";

contract MyReceiver is CCIPReceiver {
    constructor(address router) CCIPReceiver(router) {}

    function _ccipReceive(Client.Any2EVMMessage memory msg_) internal override {
        // msg_.sourceChainSelector / msg_.sender / msg_.data / msg_.destTokenAmounts
        // tokens have already been transferred to address(this) before this call
        // restrict trusted senders to prevent spoofed cross-chain calls
        require(_isAllowed(msg_.sourceChainSelector, msg_.sender), "untrusted");
        // ... handle ...
    }
}
```

The router calls `ccipReceive` on your contract; the inherited `CCIPReceiver` enforces `msg.sender == router`. **You must additionally check `sourceChainSelector` and `abi.decode(msg_.sender, (address))` against an allowlist** — anyone on any source chain can pay the fee to call your contract otherwise.

### Pay in LINK

Pass `feeToken: LINK_ON_THIS_CHAIN` and `safeApprove(router, fee)` first; the router pulls LINK and `ccipSend` is non-payable in that path.

## Across — fast bridge

Across is an optimistic intent-based bridge — relayers fill on the destination immediately, then are reimbursed via UMA's optimistic oracle. Most bridges complete in 1–30 minutes for major routes; reverts return funds.

### Deposit (source side)

The mainnet `SpokePool` is `0x5c7BCd6E7De5423a257D81B442095A1a6ced35C5`. Use `depositV3` (current API):

```solidity
interface ISpokePool {
    function depositV3(
        address depositor,
        address recipient,
        address inputToken,
        address outputToken,
        uint256 inputAmount,
        uint256 outputAmount,
        uint256 destinationChainId,
        address exclusiveRelayer,
        uint32  quoteTimestamp,
        uint32  fillDeadline,
        uint32  exclusivityDeadline,
        bytes calldata message
    ) external payable;
}

ISpokePool constant SPOKE = ISpokePool(0x5c7BCd6E7De5423a257D81B442095A1a6ced35C5);

IERC20(USDC).safeIncreaseAllowance(address(SPOKE), inputAmount);
SPOKE.depositV3({
    depositor: msg.sender,
    recipient: msg.sender,
    inputToken: USDC,
    outputToken: USDC_ON_BASE,
    inputAmount: inputAmount,
    outputAmount: inputAmount - relayerFee, // = received on destination
    destinationChainId: 8453,
    exclusiveRelayer: address(0),
    quoteTimestamp: uint32(block.timestamp),
    fillDeadline: uint32(block.timestamp + 6 hours),
    exclusivityDeadline: 0,
    message: ""
});
```

`outputAmount` is what the recipient gets — the relayer fee is the difference. Get a quote off-chain via Across API:

```bash
curl "https://app.across.to/api/suggested-fees?inputToken=$USDC&outputToken=$USDC_BASE&originChainId=1&destinationChainId=8453&amount=1000000000"
```

Returns `totalRelayFee.total` — subtract from input to get a valid `outputAmount`.

### Filling on destination (handlers)

For most apps you don't run a relayer — Across's competitive relayer network fills. If your protocol wants atomic cross-chain composability (e.g. "bridge USDC and immediately deposit into Aave on Base"), pass `message` as ABI-encoded calldata + use `AcrossPlus` handlers; verify pattern at https://docs.across.to/.

## Off-chain price queries (viem)

For frontends, hit the same feed via `eth_call`:

```ts
import { parseAbi } from "viem";

const feedAbi = parseAbi([
  "function latestRoundData() view returns (uint80 roundId,int256 answer,uint256 startedAt,uint256 updatedAt,uint80 answeredInRound)",
  "function decimals() view returns (uint8)",
] as const);

const ETH_USD = "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419";

const data = await publicClient.multicall({
  contracts: [
    { address: ETH_USD, abi: feedAbi, functionName: "latestRoundData" },
    { address: ETH_USD, abi: feedAbi, functionName: "decimals" },
  ],
  allowFailure: false,
});
const [, answer, , updatedAt] = data[0];
const decimals = data[1];
const price = Number(answer) / 10 ** decimals;
```

For high-frequency UIs prefer Chainlink Data Streams (low-latency, pull-based) over the on-chain feed — verify availability at https://docs.chain.link/data-streams.

## Common pitfalls

- **No staleness check** = your protocol uses last-known price forever after the feed dies. Always check `block.timestamp - updatedAt < heartbeat`.
- **Heartbeat differs per chain.** ETH/USD is 1 hour on mainnet, 24 hours on Optimism. Hardcoding 1 hour underestimates staleness on some L2s.
- **No sequencer-uptime gate on L2.** Aave V3 was famously hardened around this; new protocols often miss it. Always include the gate on Arbitrum/Optimism/Base.
- **Trusting `latestAnswer()`** (the deprecated function) — it omits round metadata. Always use `latestRoundData()`.
- **CCIP chain selectors ≠ chainIds.** Hardcoding `1` instead of `5009297550715157269` (mainnet) sends to a chain that doesn't exist; the call reverts.
- **CCIP receivers without sender allowlist** can be called by anyone willing to pay the fee on any source chain. Always check `sourceChainSelector` + `sender`.
- **Across `outputAmount` too low** (more fee than needed) — funds left on the table for relayers. Too high — no relayer fills, deposit is refunded after `fillDeadline`.
- **Native ETH bridges via Across** require depositing the WETH-equivalent token on chains where ETH isn't the gas token — verify token contract per route.

## What to read next

- `references/lending-and-staking.md` — using oracle prices for Aave/Compound health calculations
- `references/uniswap-cookbook.md` — TWAP oracles vs Chainlink for slippage decisions
- `references/safe-and-aa.md` — running CCIP/Across flows from a Safe or 4337 account
- Chainlink data feeds: https://docs.chain.link/data-feeds/price-feeds/addresses
- Chainlink CCIP: https://docs.chain.link/ccip
- Across: https://docs.across.to/
