# Oracles — Cookbook

A smart contract cannot read the world. It cannot fetch a price, look up a sports result, or call an API. If your contract needs external data, someone has to put it onchain. That someone is an oracle.

This file is the cookbook for getting external data into a contract without getting exploited. Read it before reading any price, status, or external value, especially if money depends on the value being accurate.

## The Core Problem

A contract that reads a price from anywhere needs four guarantees:

1. **The price is current** — not from yesterday, not from before a 50% crash.
2. **The price is honest** — not manipulated by the caller in the same transaction.
3. **The price is from a sane source** — not from a thinly-traded pool an attacker controls.
4. **The contract handles the source going down** — oracle failures should not freeze user funds permanently.

Most oracle exploits violate one of these. Read each section against your design and ask: which of the four did I forget?

## Pattern 1 — Chainlink Price Feeds (Push Oracle)

Chainlink Price Feeds publish aggregated prices for major asset pairs onchain, updated when price moves beyond a threshold or after a heartbeat period. The contract reads `latestRoundData()`. This is the default pattern for most DeFi.

```solidity
// Illustrative. Verify the canonical AggregatorV3Interface and feed addresses
// at https://docs.chain.link/data-feeds. Addresses are network-specific.
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

contract PriceConsumer {
    AggregatorV3Interface public immutable feed;
    uint256 public constant MAX_STALENESS = 1 hours;

    error StalePrice();
    error InvalidPrice();
    error IncompleteRound();

    constructor(address _feed) {
        feed = AggregatorV3Interface(_feed);
    }

    function getPrice() public view returns (uint256 price, uint8 decimals) {
        (
            uint80 roundId,
            int256 answer,
            ,
            uint256 updatedAt,
            uint80 answeredInRound
        ) = feed.latestRoundData();

        if (answer <= 0) revert InvalidPrice();
        if (answeredInRound < roundId) revert IncompleteRound();
        if (block.timestamp - updatedAt > MAX_STALENESS) revert StalePrice();

        return (uint256(answer), feed.decimals());
    }
}
```

### What every Chainlink read must check

| Check | Reason |
|---|---|
| `answer > 0` | Negative or zero price is a sentinel for failure on some feeds |
| `updatedAt + MAX_STALENESS >= block.timestamp` | Feed may be stuck; reject stale data |
| `answeredInRound >= roundId` | Defends against a known edge case where rounds are not finalized |
| Decimals via `feed.decimals()` not hardcoded | Decimals vary per feed; ETH/USD is 8, some feeds are 18 |

### Picking `MAX_STALENESS`

Each feed publishes a heartbeat (the maximum interval between updates) and a deviation threshold (the price move that triggers an update outside the heartbeat). Both are documented per feed at https://data.chain.link.

Rule of thumb: `MAX_STALENESS` should be the heartbeat plus a buffer (say, 1.5x). Some volatile feeds have heartbeats of 1 hour; some stable feeds have 24-hour heartbeats. Use the right value per feed; do not hardcode one value across all feeds.

### Sequencer uptime on L2

On L2s like Arbitrum, Optimism, Base, the sequencer can go down. If your L2 contract reads a Chainlink feed and the sequencer was offline for the past hour, prices the feed reports may be stale relative to mainnet, even though `updatedAt` looks fresh from the L2's perspective.

Chainlink publishes a sequencer-uptime feed per L2. Read it before trusting the price feed:

```solidity
// Illustrative. Verify sequencer-feed addresses per chain.
function checkSequencerUp() internal view {
    (, int256 answer, uint256 startedAt,,) = sequencerUptimeFeed.latestRoundData();
    if (answer != 0) revert SequencerDown();              // 0 = up, 1 = down
    if (block.timestamp - startedAt < GRACE_PERIOD) revert SequencerJustUp();
}
```

The grace period (typically 1 hour) gives the system time to catch up after the sequencer restarts before you trust prices again.

## Pattern 2 — TWAP from a DEX (Pull Oracle)

A Time-Weighted Average Price computed from on-chain DEX trades. Cheap, no external dependency, but only useful for assets with deep on-chain liquidity. Uniswap V3 has built-in TWAP via `observe()`.

```solidity
// Illustrative Uniswap V3 TWAP. Verify against the current
// @uniswap/v3-periphery library: signatures and helpers evolve.
import {OracleLibrary} from "@uniswap/v3-periphery/contracts/libraries/OracleLibrary.sol";

contract V3TWAP {
    address public immutable pool;
    uint32 public constant TWAP_WINDOW = 1800;  // 30 minutes

    constructor(address _pool) {
        pool = _pool;
    }

    function getTWAP(uint128 baseAmount, address baseToken, address quoteToken)
        external
        view
        returns (uint256 quoteAmount)
    {
        (int24 tick, ) = OracleLibrary.consult(pool, TWAP_WINDOW);
        quoteAmount = OracleLibrary.getQuoteAtTick(tick, baseAmount, baseToken, quoteToken);
    }
}
```

### Why TWAP, not spot

Spot price (current pool reserves) is manipulable in a single transaction via flash loan: borrow huge, swap to skew the pool, read the price, swap back, repay. The price you read was the manipulated mid-trade price.

TWAP averages over time. Manipulating it requires keeping the pool skewed across multiple blocks, which costs more than a single-tx flash attack. Longer windows are safer but lag real prices.

| Window | Manipulation cost | Lag |
|---|---|---|
| 30 minutes | Moderate — needs sustained capital | Up to 30 min behind real price |
| 1 hour | Higher | Up to 1 hour behind |
| 24 hours | Very high | Up to 24 hours behind |

### When TWAP is appropriate

- The asset trades primarily on the DEX you are reading (deep liquidity, large daily volume).
- A multi-block lag is acceptable for your use case.
- You do not have a Chainlink feed for the asset.

### When TWAP fails

- Thin liquidity. A small pool can still be manipulated for a window if attacker capital exceeds the pool's depth times the window.
- New tokens with concentrated holders. They can sustain manipulation cheaply.
- Cross-chain prices. A TWAP on chain A says nothing about price on chain B.

For mainstream assets (ETH, BTC, major stables, major L1 tokens), a Chainlink feed is the safer default. Use TWAP for long-tail or for cases where Chainlink does not have a feed.

### Initializing the observation cardinality

Uniswap V3 pools have a small observation buffer by default. To compute a 30-minute TWAP, the buffer must contain at least 30 minutes of observations. Call `pool.increaseObservationCardinalityNext(N)` once at deployment to size the buffer. `N` is the number of observations; pick to cover your window with margin.

## Pattern 3 — Push from an Authorized Source (Trusted Updater)

For data that does not exist as a public feed (a custom index, a sports result, a measurement from a sensor), a designated address pushes values onchain. This is the lowest-friction pattern, but it places full trust in the updater.

```solidity
// Trust assumption: `updater` is honest and live. Document this.
contract TrustedFeed {
    address public immutable updater;
    int256 public latestValue;
    uint256 public latestUpdate;

    error NotUpdater();
    error StaleValue();

    constructor(address _updater) {
        updater = _updater;
    }

    function update(int256 value) external {
        if (msg.sender != updater) revert NotUpdater();
        latestValue = value;
        latestUpdate = block.timestamp;
    }

    function read(uint256 maxStaleness) external view returns (int256) {
        if (block.timestamp - latestUpdate > maxStaleness) revert StaleValue();
        return latestValue;
    }
}
```

Improve the trust profile by:

- Multisig as `updater` instead of EOA.
- Multiple updaters; require N-of-M signatures via aggregated EIP-712 signature verification.
- Onchain dispute window: anyone can challenge the value within X blocks by depositing a bond.

Once you reach "multiple updaters with a dispute window," you have rebuilt the basics of an optimistic oracle. UMA's Optimistic Oracle is the canonical version of this pattern.

## Pattern 4 — Pull-from-Off-chain (Pyth, RedStone)

Newer designs let users pull a signed price update from an off-chain feed and submit it inline with their transaction. The price is fresh by definition (the user fetches it just before sending) and the contract verifies the publisher's signature.

Trade-off: every transaction that needs a price pays for the update. For high-frequency reads (every block), the gas adds up. For occasional reads (large trade settlement, liquidations), it is competitive.

Verify the latest Pyth and RedStone contract addresses, fee schedules, and update flow at https://docs.pyth.network and https://docs.redstone.finance — both networks evolve quickly.

```solidity
// Illustrative pull-oracle pattern. Verify against the current Pyth/RedStone SDK.
import {IPyth} from "@pythnetwork/pyth-sdk-solidity/IPyth.sol";

contract PythConsumer {
    IPyth public immutable pyth;
    bytes32 public immutable priceId;

    constructor(address _pyth, bytes32 _priceId) {
        pyth = IPyth(_pyth);
        priceId = _priceId;
    }

    /// Caller fetches `priceUpdateData` off-chain, sends it inline.
    function settle(bytes[] calldata priceUpdateData) external payable {
        uint256 fee = pyth.getUpdateFee(priceUpdateData);
        pyth.updatePriceFeeds{value: fee}(priceUpdateData);

        IPyth.Price memory p = pyth.getPriceNoOlderThan(priceId, 60 /* seconds */);
        // ... use p.price (with p.expo for decimals) ...
    }
}
```

## Decision Matrix

| Need | Use |
|---|---|
| Price of a major asset (ETH, BTC, major stables) | Chainlink Price Feed |
| Price of a long-tail token with on-chain liquidity | Uniswap V3 TWAP, 30+ min window |
| Frequent price updates per-tx (perps, options) | Pyth or RedStone pull oracle |
| Custom data (game outcome, KPI, off-chain measurement) | Authorized updater + dispute window, or UMA Optimistic Oracle |
| Cross-chain price | Chainlink Price Feed on the target chain (do not bridge prices) |
| L2 price feed | Chainlink + sequencer uptime feed |
| Randomness (not a price) | See `randomness.md` |

## Anti-Patterns

| Anti-pattern | Why it breaks | Fix |
|---|---|---|
| Reading `pool.slot0()` for price | Spot manipulable via flash loan in one tx | Use TWAP `observe()` over 30+ min |
| Hardcoding 18 decimals for a feed | Many Chainlink feeds use 8 decimals | Read `decimals()` |
| Skipping staleness check | Frozen feed gives last-good price forever | Always enforce a max age |
| `require(answer > 0)` only | Misses incomplete rounds | Add `answeredInRound >= roundId` |
| Single Chainlink feed as sole input | Outlier or feed bug propagates | Cross-check with TWAP for sanity, or use multiple feeds |
| No fallback when oracle is down | Liquidations frozen, peg breaks | Define a circuit breaker; pause new actions, allow withdrawals |
| Reading from a custom 1-source updater for $100M+ TVL | Single point of failure | Multisig + dispute window + redundancy |

## Cross-Checking and Sanity Bounds

For high-value contracts, defense in depth: read two independent oracles and reject the trade if they disagree by more than X%.

```solidity
function safePrice() public view returns (uint256) {
    uint256 chainlinkPrice = _readChainlink();
    uint256 twapPrice = _readTWAP();
    uint256 diff = chainlinkPrice > twapPrice
        ? chainlinkPrice - twapPrice
        : twapPrice - chainlinkPrice;
    if (diff * 10_000 / chainlinkPrice > MAX_DEVIATION_BPS) revert OraclesDisagree();
    return chainlinkPrice;
}
```

This is not free: gas cost rises, and you need both feeds available. Use for the highest-value reads (large liquidations, mint/redeem of stablecoins, big-ticket settlements).

## Handling Oracle Failure

Plan for the oracle going down before it does. Three strategies:

1. **Halt new risk, allow exit.** Liquidations and new borrows pause; existing users can withdraw or repay. Compound and Aave both have versions of this.
2. **Fallback to stale-but-bounded.** If the primary oracle is stale, use the last good value, but only for a limited time and only for read-only operations.
3. **Fall back to a secondary oracle.** Try Chainlink first; if stale, use TWAP.

In all cases, document the failure mode in the contract and surface it to the UI so users know what is happening.

```solidity
function getPriceWithFallback() public view returns (uint256, bool fromFallback) {
    try this.getChainlinkPrice() returns (uint256 p) {
        return (p, false);
    } catch {
        return (_getTWAP(), true);
    }
}
```

External calls inside `try/catch` add gas overhead; the pattern is for last-resort fallback, not common path.

## Costs You Should Estimate Before Deploying

- Chainlink push feed reads: pure read, low gas — but each consuming protocol pays nothing while Chainlink's node operators pay to publish updates. Subsidized by ecosystem grants, LINK rewards, or the protocols that sponsor specific feeds.
- TWAP reads: fixed gas per `observe`, plus a one-time cost to grow the observation buffer at deployment.
- Pull oracles: per-transaction fee paid in native token (ETH on L1) or in the oracle's token. Verify current fee schedule before launch.
- VRF requests: per-request LINK or native fee. See `randomness.md`.

Do not assert specific gas figures in your design docs — gas costs vary by network and over time. Profile on the target network with `forge test --gas-report`.

## Further Reading

- Chainlink Data Feeds: https://docs.chain.link/data-feeds
- Uniswap V3 oracle library: https://docs.uniswap.org/contracts/v3/reference/periphery/libraries/OracleLibrary
- Pyth Network: https://docs.pyth.network
- RedStone: https://docs.redstone.finance
- UMA Optimistic Oracle: https://docs.uma.xyz

Treat all addresses, ABIs, fee schedules, and parameter values in this file as illustrative. Verify against the canonical documentation before deployment. Oracle integrations are version-sensitive and chain-specific.
