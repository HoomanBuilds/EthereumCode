# Oracle Attacks and Defenses

Pricing is the most exploited surface in DeFi. This is a cookbook for reading external prices safely. Solidity `^0.8.20`, OpenZeppelin v5, viem v2 examples for offchain.

## The Canonical Attack: Spot-Price Manipulation

A protocol prices collateral or shares using a DEX pool's instantaneous reserves. An attacker takes a flash loan, swaps into the pool to skew reserves, calls the victim function while the price is wrong, then swaps back. All in one transaction.

```solidity
// VULNERABLE — anyone with a flash loan can move this price
function collateralValue() public view returns (uint256) {
    (uint112 r0, uint112 r1,) = pair.getReserves();
    return (r1 * 1e18) / r0;
}
```

Mitigations, in increasing order of safety:

1. Use a TWAP over a window long enough that manipulation requires holding the imbalance across blocks.
2. Use a Chainlink push feed with a staleness check.
3. Combine both and require they agree within a band.

## Chainlink Push Feeds

Chainlink aggregators publish a price onchain when it deviates by more than a threshold (the "deviation threshold") or when the heartbeat expires (typically 1 hour for ETH/USD on mainnet, varies by feed). Always read with a staleness check.

```solidity
pragma solidity ^0.8.20;

import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

contract ChainlinkReader {
    AggregatorV3Interface public immutable feed;
    uint256 public immutable maxStaleness; // seconds

    error StalePrice();
    error NegativePrice();
    error IncompleteRound();

    constructor(address _feed, uint256 _maxStaleness) {
        feed = AggregatorV3Interface(_feed);
        maxStaleness = _maxStaleness;
    }

    function price() public view returns (uint256) {
        (uint80 roundId, int256 answer,, uint256 updatedAt, uint80 answeredInRound) = feed.latestRoundData();
        if (updatedAt == 0) revert IncompleteRound();
        if (answeredInRound < roundId) revert IncompleteRound();
        if (block.timestamp - updatedAt > maxStaleness) revert StalePrice();
        if (answer <= 0) revert NegativePrice();
        return uint256(answer); // scaled by feed.decimals(), usually 8
    }
}
```

Pick `maxStaleness` per feed. Rule of thumb: `1.5 * heartbeat`. ETH/USD on mainnet has a 1-hour heartbeat, so 5400 seconds. Verify the heartbeat for the specific feed at https://data.chain.link/ before deploying — it varies by chain and asset.

### Common mistakes

- Reading `answer` without checking `updatedAt`. A frozen feed returns the same value forever.
- Assuming all feeds use 8 decimals. ETH/USD does, but some L2 feeds and cross-rate feeds do not. Always read `feed.decimals()` or hard-code per-feed.
- Hard-coding addresses without re-checking. Chainlink occasionally migrates feeds. Pin via your config and re-verify on chain.

## L2 Sequencer Uptime Feed

On Arbitrum, Optimism, Base, and other OP-stack / Arbitrum-stack L2s, the sequencer can go down. Chainlink price feeds keep the last value but the price may have moved on L1. Reading the stale L2 price during downtime can be exploited.

Chainlink publishes a sequencer uptime feed per L2. Check it before reading any other price.

```solidity
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

contract L2PriceReader {
    AggregatorV3Interface public immutable sequencerUptime;
    AggregatorV3Interface public immutable priceFeed;
    uint256 public constant GRACE_PERIOD = 3600; // 1h after sequencer comes back

    error SequencerDown();
    error GracePeriodNotOver();

    function price() external view returns (uint256) {
        (, int256 answer, uint256 startedAt,,) = sequencerUptime.latestRoundData();
        // 0 = up, 1 = down
        if (answer == 1) revert SequencerDown();
        if (block.timestamp - startedAt < GRACE_PERIOD) revert GracePeriodNotOver();

        (, int256 p,, uint256 updatedAt,) = priceFeed.latestRoundData();
        require(p > 0 && block.timestamp - updatedAt < 3600, "stale");
        return uint256(p);
    }
}
```

Sequencer-uptime feed addresses (verify before using):

| Chain | Source | Notes |
|---|---|---|
| Arbitrum One | Chainlink Data Feeds page for Arbitrum | `0xFdB631F5EE196F0ed6FAa767959853A9F217697D` published historically; re-verify |
| Optimism | Chainlink Data Feeds page for Optimism | re-verify |
| Base | Chainlink Data Feeds page for Base | re-verify |

Always verify the current address at https://docs.chain.link/data-feeds/l2-sequencer-feeds before deploying. Addresses are pinned per chain but Chainlink may add new feeds.

## Uniswap V3 TWAP

Uniswap V3 stores price observations onchain. Reading a 30-minute TWAP is the standard onchain alternative when no Chainlink feed exists or when you want a defense-in-depth check.

```solidity
import {IUniswapV3Pool} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import {OracleLibrary} from "@uniswap/v3-periphery/contracts/libraries/OracleLibrary.sol";

contract V3TWAP {
    IUniswapV3Pool public immutable pool;
    uint32 public immutable window;

    constructor(address _pool, uint32 _window) {
        require(_window >= 1800, "window too short"); // 30 min minimum
        pool = IUniswapV3Pool(_pool);
        window = _window;
    }

    function twap() external view returns (uint256 priceX96) {
        (int24 arithmeticMeanTick,) = OracleLibrary.consult(address(pool), window);
        return OracleLibrary.getQuoteAtTick(
            arithmeticMeanTick,
            uint128(1e18),
            pool.token0(),
            pool.token1()
        );
    }
}
```

Two requirements before relying on a V3 TWAP:

1. **Cardinality must be initialized**. The pool must have enough observation slots to span the window. New pools start at cardinality 1. Call `pool.increaseObservationCardinalityNext(N)` and pay the gas before relying on a window of length N.
2. **Liquidity must be deep enough** that single-block manipulation across the entire window is uneconomical. Tiny pools are still cheap to manipulate even with a TWAP.

Recommended minimum windows:

| Use | Window |
|---|---|
| Defense-in-depth alongside Chainlink | 30 min |
| Primary onchain price for high-value asset | 60-120 min |
| Long-tail asset, small liquidity | TWAP is not safe; do not price |

## Multi-Oracle Cross-Check

For high-value protocols, do not rely on a single source. Cross-check and bound.

```solidity
contract DualOracle {
    AggregatorV3Interface public immutable chainlink;
    V3TWAP public immutable twap;
    uint256 public constant MAX_DEVIATION_BPS = 200; // 2%

    error PriceDisagreement();

    function safePrice() external view returns (uint256) {
        uint256 cl = _readChainlink();
        uint256 tw = twap.twap();

        uint256 diff = cl > tw ? cl - tw : tw - cl;
        uint256 base = cl < tw ? cl : tw;
        if ((diff * 10_000) / base > MAX_DEVIATION_BPS) revert PriceDisagreement();

        return cl; // prefer the push feed once both agree
    }
}
```

Trade-off: tighter band reduces manipulation surface but increases the chance the protocol bricks during legitimate market dislocations (e.g., a real depeg). Pick a band that matches the volatility of the underlying.

## Pull Oracles: Pyth and RedStone

Pull oracles do not push every update onchain. The publisher signs a price offchain; the user submits the signed update at the moment they need it. The contract verifies the signature and reads the embedded price.

When to use pull oracles:

- Long-tail assets with no Chainlink push feed.
- Need for sub-second freshness on chains with cheap calldata.
- Want to push the gas cost of updates to the user.

Sketch of a Pyth read on EVM:

```solidity
import {IPyth} from "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import {PythStructs} from "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

contract PythReader {
    IPyth public immutable pyth;
    bytes32 public immutable priceId; // e.g., ETH/USD

    function settle(bytes[] calldata updateData) external payable {
        uint256 fee = pyth.getUpdateFee(updateData);
        pyth.updatePriceFeeds{value: fee}(updateData);

        PythStructs.Price memory p = pyth.getPriceNoOlderThan(priceId, 60); // 60s freshness
        // p.price is int64, p.expo is int32 — normalize before use
        require(p.price > 0, "bad price");
    }
}
```

Gotchas:

- **Verify signature freshness.** `getPriceNoOlderThan` enforces the publish-time bound; never use `getPriceUnsafe`.
- **Pay the fee.** Pyth charges per update; users must include `msg.value`.
- **Cache the update.** Multiple reads in the same transaction share the freshly-pushed value; do not call `updatePriceFeeds` twice.
- **Replay risk.** A signed update can be submitted by anyone — that is fine because it is a price, not a transfer — but watch for griefers who submit slightly-stale updates to lock in worse prices for users; combine with a max-age check at the consumer.

RedStone Classic / Core is similar in shape; the price is delivered as calldata appended to user transactions and parsed by the contract. Use the official SDK and pin to a documented mainnet entry point.

## Frozen Oracle and Deprecation

Chainlink occasionally deprecates feeds. The old aggregator contract continues to exist but stops receiving updates. `latestRoundData()` returns the last value forever.

The staleness check is your safety net. Without it, a deprecated feed silently freezes your protocol's view of the world.

Operational checklist:

- Subscribe to Chainlink's deprecation announcements.
- Monitor `updatedAt` lag offchain; alert on staleness > 2 * heartbeat.
- Have a governance path to swap aggregator addresses without redeploying.

## Stablecoin Depeg Detection

A stablecoin is not always $1. USDC dropped to ~0.87 in March 2023 (SVB). UST went to zero. DAI briefly traded below peg multiple times.

Do not hard-code `1e18` as the value of one USDC. Read its actual feed.

```solidity
// WRONG — assumes USDC == $1
uint256 collateralUsd = usdcAmount * 1e12; // also wrong: decimal handling

// RIGHT — read the actual market price of USDC/USD
uint256 usdcPrice = chainlinkUsdcUsd.price(); // scaled by 1e8
uint256 collateralUsd = (usdcAmount * usdcPrice * 1e10) / 1e6; // 6 decimals * 1e10 = 1e16, / 1e6 base, scale to 18 as needed
```

Add depeg circuit breakers: if the stablecoin price drops below a threshold (e.g., 0.97), pause new borrows or refuse to mark it as $1 collateral.

## Real Exploits

| Year | Protocol | Bug class | Loss | Lesson |
|---|---|---|---|---|
| 2020 | bZx | Spot price on Kyber, flash loan | ~954k USD | Never use spot AMM prices |
| 2021 | Cream Finance | Spot price on yUSD via Yearn | ~130M USD | Wrapper tokens with manipulable underlying are oracles too |
| 2022 | Mango Markets | Self-listed token, manipulated own price oracle | ~117M USD | Permissionless listing without TWAP / external feeds is fatal |
| 2022 | Inverse Finance | Curve LP price, no read-only reentrancy guard, brief AMM-derived price spike | ~5.8M and ~15.6M in two incidents | Curve LP pricing requires reentrancy probe; never fall back to spot |
| 2022 | Fei Rari | Cross-protocol read-only reentrancy via cTokens | ~80M USD | View functions are not safe by default |
| 2023 | BonqDAO | Spot price oracle on a thin Tellor feed | ~88M USD | Long-tail oracles need redundancy and bounds |

Pattern: every entry above failed at the same step — trusting a single, manipulable price source. The fix is always the same: bound, cross-check, and stale-check.

## Decision Matrix

| Situation | Recommendation |
|---|---|
| ETH/USD or major asset on a chain Chainlink supports | Chainlink + staleness check. Add sequencer-uptime check on L2. |
| Major asset, defense-in-depth | Chainlink primary, V3 TWAP secondary, deviation band ~2-5% |
| Asset with no Chainlink feed but liquid V3 pool | V3 TWAP, 60+ min, cardinality verified, deep liquidity required |
| Asset with no liquid pool | Do not price onchain; do not list |
| Need sub-second freshness | Pyth or RedStone, with `getPriceNoOlderThan` |
| Reading another protocol's view (e.g., Curve `get_virtual_price`) | Probe their reentrancy lock first; treat as untrusted otherwise |
| Stablecoin valuation in collateral math | Read its feed; depeg circuit breaker at 0.97/1.03 |

## Quick Checklist

- Every external price read has a staleness check.
- Every L2 deployment has a sequencer-uptime check before reading prices.
- TWAP windows are at least 30 minutes; cardinality has been increased to cover the window.
- Multi-oracle deviation bands match the underlying volatility.
- Stablecoins are priced from a feed, never assumed equal to $1.
- Pull oracles use the safe getter (`getPriceNoOlderThan`), not the unsafe one.
- Aggregator addresses are governance-swappable, not immutable, in case of deprecation.
- No code path falls back to a DEX spot price when the primary oracle is stale.
