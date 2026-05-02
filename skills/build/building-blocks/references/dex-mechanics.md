# DEX Mechanics

How the major on-chain exchanges actually work — math, fee model, and integration shape. Pick one before you write swap code; "we'll route across DEXes" is how you ship a bug. For Solidity-level swap snippets see `addresses/references/uniswap-cookbook.md`.

## Constant-product (Uniswap V2 and clones)

Pool holds reserves `(x, y)`. Invariant `x * y = k` (modulo fees). For an input `dx` of token X (after fees), output `dy = y * dx / (x + dx)`.

- Price impact scales with `dx / x`. Trades >1% of pool reserves move the price meaningfully.
- LP fee: 30 bps default, taken from input. Reserves grow with each swap.
- LPs hold a single fungible LP token; share = `LP_owned / LP_total`.
- Pros: simplest integration, deepest L2 / long-tail liquidity.
- Cons: 100% of LP capital is "in range" but most isn't doing useful work — capital efficiency is poor relative to V3.

Forks: SushiSwap, PancakeSwap V2, Trader Joe V1, Camelot V2 (Arbitrum). Camelot V2 has a fee that splits between LPs and the protocol's xGRAIL stakers — drop-in compatible interface, different tokenomics.

## Concentrated liquidity (Uniswap V3)

LPs deposit into a price range `[Pa, Pb]`. Liquidity is only active when price is in range. Out-of-range positions earn nothing and become 100% one token.

```
L = sqrt(x * y)        # liquidity, scale-invariant
sqrtPrice = sqrt(P)    # tracked as Q64.96 fixed-point
```

- Range concentration: a 0.01-wide range around peg has ~100x the depth of a V2-equivalent capital deposit. **Capital efficiency = how much depth per dollar deposited; not the same as APR.**
- Fee tiers: 1, 5, 30, 100 bps. Pick by expected volatility — stables → 1 bps, ETH/USD → 5 bps, long-tail → 30 or 100 bps.
- LP positions are NFTs (ERC-721). No fungible LP token unless wrapped (Gamma, Arrakis, Steer).
- Active management is mandatory for fee earnings. "Just deposit at a wide range" mostly underperforms holding the assets.

Quoting V3 off-chain uses `QuoterV2.quoteExactInputSingle(...)` — but this is `view`-only via a state-changing call (it reverts with the answer). Use `eth_call` to consume.

## V4 (with hooks)

Same concentrated-liquidity math as V3, but:
- One singleton **PoolManager** holds all pool state. Pool creation is ~free.
- **Native ETH** as a pool token (no WETH wrap needed).
- **Hooks**: arbitrary contract called at lifecycle points — see `references/uniswap-v4-hooks.md`.
- **Dynamic fees**: hook decides fee per swap.
- **Flash accounting**: PoolManager defers token settlement until `unlock` returns. Inside one `unlock` callback you can do many swaps and only settle the net.

Universal Router is the canonical entry point — it batches V2 + V3 + V4 + Permit2 + payments in one tx.

## ve(3,3) and Aero

**Aero** (Base + Optimism, formerly Aerodrome + Velodrome, merged Nov 2025) is the dominant DEX on both chains. It's a Solidly fork — different incentive model from Uniswap.

```
        emissions ────►  voted-pool LPs
            ▲
            │
       veAERO voters ────►  100% of trading fees + bribes
            ▲
            │
       AERO lockers (1y–4y)
```

- **LPs earn AERO emissions, not fees.** Fees go to voters.
- **veAERO holders vote weekly** on which pools get next week's emissions.
- **Bribes**: protocols pay veAERO holders to vote for their pool — i.e., to direct emissions there.
- Two pool types per pair: **stable** (Curve-like xy(x²+y²) = k for tightly-pegged pairs) and **volatile** (xy = k).

Routing on Aero (mainnet-like router on Base):
```solidity
struct Route {
    address from;
    address to;
    bool    stable;     // true = stable invariant
    address factory;    // 0x420DD381b31aEf6683db6B902084cB0FFECe40Da on Base
}
function swapExactTokensForTokens(uint256, uint256, Route[] calldata, address, uint256)
    external returns (uint256[] memory);
```

Always set `stable` correctly — wrong invariant routes through a worse pool. The factory has a `getPool(tokenA, tokenB, stable)` view; check both legs exist.

## Curve (StableSwap)

Hybrid invariant `An·sum(x_i) + prod(x_i) = An·D + (D^(n+1)) / (n^n · prod(x_i))` where `A` is the amplification coefficient. Tunes between constant-sum (low slippage near peg) and constant-product (smooth depeg behavior).

- Designed for assets that should trade ~1:1 (USDC/USDT/DAI, stETH/ETH, frxETH/ETH).
- LP token is fungible. Multi-asset pools (3pool, tricrypto).
- **Critical**: read pool from the **registry** (`0x90E00ACe148ca3b23Ac1bC8C240C2a7Dd9c2d7f5` for stable on mainnet) — the registry is the source of truth for which assets belong to which pool. Hardcoded pool addresses are how integrations break when Curve replaces a pool.

Use Curve when:
- Routing stables (cheaper than Uniswap for >$10k size).
- Working with LSTs (deepest stETH, frxETH, rETH liquidity).

## GMX V2 (perps, not AMM)

Not a swap DEX in the AMM sense, but you'll route through it for ETH/BTC perps on Arbitrum + Avalanche.

- **GM pools**: each market (e.g. ETH/USD) has a dedicated pool with backing tokens. Liquidity providers earn fees + bear trader PnL.
- **Fully-backed markets**: ETH/USD market backed by ETH + USDC. Real assets.
- **Synthetic markets**: DOGE/USD backed by ETH + USDC. ADL kicks in if traders win too much vs pool.
- Oracle: Chainlink + Pyth low-latency feeds. Trades execute against oracle, not against AMM curve — no slippage on small size, OI caps on large size.

Integration: rare to swap *through* GMX (their swap fees are not designed for routing). You'd integrate to:
- LP into GM pools (yield strategy).
- Open/close perps programmatically.
- Hedge another position (delta-neutral vault).

## Liquidity aggregators

Don't build your own router. Use:
- **1inch** Pathfinder — dominant aggregator on mainnet + L2s.
- **0x API** — better for token launches, supports limit orders.
- **OpenOcean / KyberSwap** — comprehensive on long-tail chains.
- **CoWSwap** — batch auctions, MEV-protected.

Their APIs return calldata you can submit directly. For DeFi-vault-style strategies that need to swap programmatically, a 1inch v6 quote is ~10–50 ms and saves you from picking the wrong pool.

## Picking by chain

| Chain | Default DEX(es) |
|---|---|
| Mainnet | Uniswap V3/V4, Curve (stables), CoWSwap (large size) |
| Base | **Aero** (was Aerodrome), Uniswap V3/V4 |
| Optimism | **Aero** (was Velodrome), Uniswap V3/V4 |
| Arbitrum | Uniswap V3/V4, Camelot V3, Curve, GMX (perps) |
| zkSync Era | SyncSwap, Maverick |
| Polygon | Uniswap V3, Quickswap, Balancer |

Default to Uniswap V3/V4 when you need integration breadth. Use the chain-native DEX when you need depth on chain-native tokens (AERO/VELO, GMX/GLP, GRAIL, CAKE).

## Common pitfalls

- **Quoting on-chain via `view` Quoter**: V3 QuoterV2 reverts with the answer encoded in the revert. Decode it; don't catch and ignore.
- **Stable vs volatile flag wrong on Aero/Velodrome**: routes through nonexistent or shallow pool. Always check via factory.
- **Hardcoded V2 pair address**: V2 pair addresses are deterministic from the factory + tokens (CREATE2), but V3 and V4 pool addresses depend on fee tier and hook contract. Use the factory's `getPool` view.
- **Slippage protection of 0**: front-runners will sandwich. Always set `amountOutMinimum` from a recent quote, with a buffer.
- **Routing on Curve to the wrong pool**: same asset pair often has multiple pools (3pool vs FRAXBP vs crvUSD). Pick by depth, not by name.
- **Assuming Uniswap V4 deployed on every chain V3 was**: V4 rolled out chain-by-chain through 2025. Verify on https://docs.uniswap.org/contracts/v4/deployments.
- **Treating GMX swap fees like Uniswap fees**: GMX swap fees are designed to discourage routing through GM pools. Don't aggregator-route through GMX.

## What to read next

- `references/uniswap-v4-hooks.md` — hooks deep dive
- `references/aave-and-lending-flows.md` — leverage and refinance via swaps
- `references/pendle-and-yield-tokens.md` — yield-bearing asset DEX mechanics
- `addresses/references/uniswap-cookbook.md` — concrete swap calls
