# MEV and Frontrunning Defenses

A cookbook for protecting users and protocols from value extraction in mempools and at the sequencer. Solidity `^0.8.20`, viem v2 for offchain. Verify all RPC endpoints and addresses against the operator's docs before relying on them.

## Mempool Basics

Two kinds of mempools matter:

| | Public mempool | Private mempool / OFA |
|---|---|---|
| Visibility | All nodes see your tx | Only the operator (and downstream builders) sees it |
| Use case | Default behaviour for most wallets | Sandwich-resistant submission |
| Operators | Geth, Reth, Erigon nodes everywhere | Flashbots Protect, MEV Blocker, Beaverbuild RPC, Titan |
| Trust | None required (it's broadcast) | Must trust the operator not to peek |
| Inclusion latency | Fast | Slightly slower (next bundle window) |

OFA = "order flow auction". The user's transaction is auctioned to builders who compete to include it; some routes return MEV refunds to the user.

L1 mainnet has both. L2s with centralized sequencers (Arbitrum One, Optimism, Base today) have neither in the L1 sense — the sequencer accepts transactions privately and orders them itself, so there is no public mempool to sandwich from but there is a single trust anchor.

## Sandwich Attacks

The canonical user-side MEV attack on AMMs.

```
1. User submits: swap 10 WETH for USDC on Uniswap V3, amountOutMinimum = (current quote) * (1 - slippage)
2. Searcher sees user tx in public mempool
3. Searcher submits frontrun: buy USDC for WETH, pushing USDC price up against WETH
4. User tx executes: gets fewer USDC than the pre-attack quote, but still above amountOutMinimum
5. Searcher submits backrun: sell USDC for WETH at the now-higher price
6. Searcher pockets the spread minus fees and gas
```

The user's slippage parameter caps the loss but does not prevent the attack — it sets the searcher's ceiling. Setting slippage to 0 or `type(uint256).max` are both extreme: 0 means the swap reverts under any front-run, max means there is no protection at all.

### JIT liquidity on V3

On Uniswap V3, a more sophisticated variant is "just-in-time" liquidity: a searcher mints a tight liquidity range right before the user swap, captures the fees, then burns the position immediately after. It is not strictly extraction from the user (the user still gets their quoted price), but it dilutes returns for honest LPs in the same range.

Defenses (mostly LP-side): wider ranges, fee-tier differentiation, V4 hooks to penalize same-block adds/removes.

## Frontrunning Beyond Sandwiches

- **Liquidation races.** A position becomes liquidatable; multiple liquidators race to submit. Whoever pays the highest priority fee wins. Not extraction from the user (the borrower's collateral is liquidated by definition), but a tax on liquidators.
- **NFT mint snipers.** A high-demand mint goes live. Bots watching the mempool replicate the call with higher gas to mint first. Allowlists and Dutch auctions mitigate.
- **Dutch auction races.** Whoever submits the cheapest valid bid wins. A bot watching can always undercut a human by epsilon.
- **Sandwiched mints.** Bonding-curve token launches are vulnerable: a searcher buys before the user pushes the curve, sells after.
- **Replicated approvals.** A user submits an approve + swap as a script; a searcher copies the swap with higher priority before the user's executes. Permit2 helps because the signature is single-use.

## User-Side Defenses

### Private mempool RPC

The simplest defense: submit through an endpoint that does not broadcast publicly.

| Endpoint | URL (verify) | Notes |
|---|---|---|
| Flashbots Protect | `https://rpc.flashbots.net` | Free; supports MEV refunds via OFA; Ethereum mainnet |
| MEV Blocker | `https://rpc.mevblocker.io` | Free; OFA with refunds; mainnet |
| Beaverbuild | published on their site | Direct-to-builder; no auction |
| Titan | published on their site | Direct-to-builder |
| BloxRoute Protect | published on their site | Subscription tiers |

Always verify the current URL on the operator's homepage before adding to a wallet config. Endpoints occasionally change.

```ts
// viem v2 example
import { createWalletClient, http } from 'viem';
import { mainnet } from 'viem/chains';

const client = createWalletClient({
  chain: mainnet,
  transport: http('https://rpc.flashbots.net'),
});
```

### Aggregators with intent-based settlement

Instead of pushing a swap to the public mempool, the user signs an intent (e.g., "I want at least X USDC for my Y WETH within Z minutes") and a network of solvers competes to fill it. The protocol settles the winning fill; the public mempool never sees the swap.

| Aggregator | Mechanism | Notes |
|---|---|---|
| CoW Swap | Batch auctions with uniform clearing price; CoW = coincidence of wants | No sandwich possible by construction; some latency (one batch ~30s) |
| 1inch Fusion | Resolver-based intents | Fast inclusion; resolvers compete |
| UniswapX | RFQ-style with fillers | Mainnet and several L2s |
| Across | Bridging intents | Cross-chain swap+bridge |

For users moving size, these typically beat going to a router on the public mempool.

## Protocol-Side Defenses

### Slippage parameter design

Every external-facing swap needs an explicit minimum-output parameter (or maximum-input for exact-out). Never default to 0 or `type(uint256).max`.

```solidity
import {ISwapRouter} from "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";

function swap(uint256 amountIn, uint256 minOut, uint256 deadline) external {
    require(deadline >= block.timestamp, "expired");

    ISwapRouter.ExactInputSingleParams memory p = ISwapRouter.ExactInputSingleParams({
        tokenIn: WETH,
        tokenOut: USDC,
        fee: 500,
        recipient: msg.sender,
        deadline: deadline,
        amountIn: amountIn,
        amountOutMinimum: minOut,         // user-supplied, never 0
        sqrtPriceLimitX96: 0
    });

    router.exactInputSingle(p);
}
```

Three knobs matter:

- `amountOutMinimum` (or `amountInMaximum` for exact-out): cap the slippage in token units.
- `sqrtPriceLimitX96`: cap the post-trade price the swap is willing to push the pool to. Useful for bounded swaps in a hook context; rarely user-facing.
- `deadline`: refuse late inclusion. Otherwise a stuck transaction may execute hours later at a now-stale quote.

### Frontend slippage UX

The contract enforces what the frontend computes. Bad frontend UX leads to bad on-chain parameters.

| Pattern | Verdict |
|---|---|
| Default slippage 0.5%; user can override | Good for major pairs |
| Default slippage 0; user can override | Bad — many users keep the default and the swap reverts on every public-mempool submission |
| Default slippage 50% silently | Bad — invites sandwiches large enough to extract real value |
| Warn when slippage > 5% | Good |
| Disable submit when slippage > 30% | Good for retail; aggregators may need higher for thin pairs |
| Always show the user-readable "min received" before they sign | Required |
| Auto-switch to private RPC for large swaps | Good if disclosed |

### Batch auctions and uniform clearing price

CoW Swap's design: settle a window of orders at a single uniform clearing price chosen so no order is filled worse than its limit. By construction, the searcher cannot insert "before" or "after" any individual user — every user in the batch gets the same price. Builders that want to settle the batch must include all-or-nothing, which removes the sandwich attack surface.

If you're building a DEX, this is the strongest user-MEV defense available, at the cost of inclusion latency (one batch period) and increased complexity.

### Commit-reveal

For auctions, sealed-bid sales, or any operation where front-running the input destroys the mechanism: split into two transactions.

1. Commit: user submits `keccak256(input || salt)` on chain.
2. Reveal: after a delay (or after the commit window closes), user submits `input, salt`. Contract verifies the hash matches.

```solidity
mapping(address => bytes32) public commitments;
uint256 public revealStart;
uint256 public revealEnd;

function commit(bytes32 hash) external {
    require(block.timestamp < revealStart, "commit closed");
    commitments[msg.sender] = hash;
}

function reveal(uint256 bid, bytes32 salt) external {
    require(block.timestamp >= revealStart && block.timestamp < revealEnd, "not in reveal");
    require(keccak256(abi.encode(bid, salt)) == commitments[msg.sender], "bad reveal");
    _processBid(msg.sender, bid);
}
```

Searchers cannot extract from a commitment because they cannot read the bid. They can still re-order reveals, but with a uniform-clearing-price auction inside the reveal phase, that does not leak value.

Limitations: two transactions doubles UX friction; users must remember to reveal (or lose deposit). Use only when the front-running risk is severe enough to justify it.

### Permit2 and signature replay

Uniswap's Permit2 is now the standard cross-protocol allowance manager. Users sign permits offchain; protocols pull tokens via the Permit2 contract. Risks:

- **Stolen signature.** A leaked Permit2 signature with broad scope can be used by anyone to drain the signer's tokens up to the permitted amount, until expiry. Always sign with tight `amount`, tight `expiration`, and a specific `spender`.
- **UI deception.** Phishing sites trick users into signing a Permit2 envelope with `type(uint256).max` and far-future expiration. Wallets should warn on broad scopes; protocols should request only what they need.
- **Sequence-of-signatures replay across forks.** Permit2 signatures are domain-separated by chain; cross-chain replay is not the issue. Cross-protocol replay within a chain is bounded by the spender field — verify your protocol checks it.

Pattern for a protocol pulling tokens via Permit2:

```solidity
// Illustrative — assume permit2 is set in a constructor.
import {ISignatureTransfer} from "permit2/src/interfaces/ISignatureTransfer.sol";

ISignatureTransfer immutable public permit2;

function deposit(
    ISignatureTransfer.PermitTransferFrom calldata permit,
    bytes calldata signature
) external {
    permit2.permitTransferFrom(
        permit,
        ISignatureTransfer.SignatureTransferDetails({
            to: address(this),
            requestedAmount: permit.permitted.amount
        }),
        msg.sender,
        signature
    );
    // ... business logic
}
```

Notes:

- The third argument is the `owner` (signer) of the permit. Permit2 recovers the signer from `signature` and reverts unless it equals `owner`. Pass `msg.sender` only when your protocol's design requires the caller to also be the signer; in relayer/meta-tx flows the `owner` may differ from `msg.sender`.
- Use `SignatureTransfer` (single-shot) over `AllowanceTransfer` for one-off deposits — eliminates the standing-allowance footgun.

## L2 vs L1 MEV

Centralized sequencers today (Arbitrum One, Optimism, Base) order transactions FIFO with no public mempool. Consequences:

| Property | Public mempool L1 | Centralized-sequencer L2 |
|---|---|---|
| Sandwich risk | High | None from public mempool; possible if sequencer is malicious |
| Frontrun risk | High | None for users; possible for the sequencer operator |
| Liquidation races | Priority-fee auctions | FIFO; first to arrive wins |
| Trust assumption | Trust ~no one | Trust the sequencer not to insert / reorder |
| Roadmap | OFA-based protections | Decentralized sequencers, based rollups, shared sequencers |

Decentralization roadmap is real but research-stage. **Based rollups** (sequenced by L1 proposers, e.g., Taiko) inherit L1's MEV economics. **Shared sequencers** (Espresso, Astria) coordinate ordering across multiple rollups but introduce their own trust assumptions. **SUAVE** (Flashbots) aims to be a privacy-preserving cross-domain MEV-aware sequencer; deployments exist, mass adoption does not. Treat all of these as research/early production for the next 1-2 years and re-verify before relying on them.

## Real Exploits and Aggregate Extraction

| Year | Subject | Class | Magnitude | Lesson |
|---|---|---|---|---|
| 2020 onwards | Sandwich economy on Uniswap | User extraction | Hundreds of millions cumulative | Default to private mempool routing for retail |
| 2022 onwards | "JaredFromSubway" address aggregate | Sandwich + arbitrage | Tens of millions per quarter at peak | Single searcher can dominate; user defenses needed at the wallet layer |
| 2022 | Polter Finance | Spot-price oracle frontrun via flash loan | ~12M USD | Combination of oracle weakness + MEV extraction |
| 2023 | Curve LP price reentrancy events (Conic, others) | Read-only reentrancy + MEV-aware extraction | Tens of millions | Searchers also exploit non-MEV bugs as soon as they are public |
| 2024 | UniswapX fillers and aggregator integrations | Resolver gaming | Smaller, ongoing | Even auction-based systems leak value if rules are loose |

Magnitudes are aggregates and rough; verify against current data sources (e.g., libmev, eigenphi) before quoting.

## Decision Matrix: Submission Path

| Situation | Recommended path |
|---|---|
| Retail swap, small size, on L1 | Public mempool with tight slippage (0.5%) and short deadline |
| Retail swap, larger size, on L1 | Private mempool RPC (Flashbots Protect or MEV Blocker) |
| Institutional / large swap | CoW Swap, UniswapX, or 1inch Fusion intent settlement |
| Sealed-bid auction or NFT mint | Commit-reveal on chain |
| Bridging | Intent-based bridge (Across, etc.) over standard public-mempool wormhole/canonical |
| Liquidation as a searcher | Private mempool with priority fee, or builder-direct |
| L2 swap, retail | Sequencer (no public mempool); slippage still required |
| L2 swap, large | Same as above, plus CoW Swap if available on the L2 |

## Quick Checklist

- Every external swap entry point takes an explicit `amountOutMinimum` (or `amountInMaximum`) and a `deadline`. Neither has a permissive default.
- Frontend defaults slippage to a tight value, warns above 5%, and shows "min received" before signing.
- For high-value users, the wallet or app routes through a private mempool RPC by default; the URL is verified against the operator's docs.
- Auctions and sealed-bid mechanisms use commit-reveal or batch auctions, not raw public-mempool order books.
- Permit2 integrations request the tightest scope possible — bounded amount, near-term expiry, specific spender.
- For L2 deployments, the team has read the sequencer trust assumptions and is prepared to migrate when decentralized sequencing is production-ready.
- The pre-deploy checklist explicitly asks about MEV exposure for every state-changing user path that touches a market price.
