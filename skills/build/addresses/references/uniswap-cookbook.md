# Uniswap Cookbook

Working snippets for Uniswap V2, V3, V4, the Universal Router, Permit2, and Quoter — across mainnet, Base, Arbitrum, and Optimism. Verify addresses against `SKILL.md` and against https://docs.uniswap.org/contracts/v3/reference/deployments/ before using on a new chain.

## Pick the right surface

| Need | Use |
|---|---|
| Single hop swap, want simplest code | V2 router (mainnet/Base only — sparse on L2s) |
| Concentrated liquidity, V3 pools | V3 SwapRouter02 |
| Hooks, V4 pools (post Jan 2025) | PoolManager + Universal Router |
| Best execution across V2/V3/V4 + permit2 | **Universal Router** |
| Off-chain price quote | QuoterV2 (V3) or V4 Quoter |
| Anything that needs ERC-20 approval UX | Permit2 in front of any router |

For most production swaps in 2026: **Universal Router + Permit2**. It's what the Uniswap web app uses; it spans V2/V3/V4 and exposes batch + permit + pay/refund commands.

## Approvals: Permit2 instead of `approve`

Permit2 (`0x000000000022D473030F116dDEE9F6B43aC78BA3`) is the universal approval contract. Pattern:

1. User signs an ERC-20 `approve(Permit2, max)` once per token (lifetime).
2. For each swap, user signs an off-chain Permit2 message granting an allowance + deadline + nonce.
3. Router pulls tokens via `Permit2.permitTransferFrom(permit, details, owner, signature)`.

Solidity types:

```solidity
import {ISignatureTransfer} from "@uniswap/permit2/src/interfaces/ISignatureTransfer.sol";

// PermitSingle / PermitTransferFrom struct
struct PermitTransferFrom {
    TokenPermissions permitted;     // (token, amount)
    uint256 nonce;
    uint256 deadline;
}
struct SignatureTransferDetails {
    address to;
    uint256 requestedAmount;
}
```

The third argument to `permitTransferFrom(permit, details, owner, signature)` is the **owner that signed**. Permit2 recovers the signer from `signature` and matches it against `owner`. It does **not** enforce `owner == msg.sender` — anyone holding the signature can submit; the spender is implicit (the contract calling Permit2 receives the tokens at `details.to`).

EIP-712 domain for Permit2:

```
name:                "Permit2"
version:             not present (Permit2 omits version per its EIP-712 domain)
chainId:             current chain
verifyingContract:   0x000000000022D473030F116dDEE9F6B43aC78BA3
```

Verify the domain encoding at https://github.com/Uniswap/permit2 — Permit2 omits `version` from its domain separator, which differs from most ERC-2612 tokens.

## V2 swap (mainnet)

```solidity
// Mainnet only; on L2s prefer Aerodrome (Base) or Velodrome (OP) or V3
import {IUniswapV2Router02} from "lib/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";

IUniswapV2Router02 constant ROUTER =
    IUniswapV2Router02(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D);

function swapExactTokensForTokens(
    address tokenIn, address tokenOut, uint256 amountIn, uint256 minOut
) external returns (uint256[] memory amounts) {
    IERC20(tokenIn).safeIncreaseAllowance(address(ROUTER), amountIn);
    address[] memory path = new address[](2);
    path[0] = tokenIn; path[1] = tokenOut;
    amounts = ROUTER.swapExactTokensForTokens(
        amountIn, minOut, path, msg.sender, block.timestamp
    );
}
```

V2 has no slippage protection beyond `minOut` and no fee tier — every pair is 0.30%. Use V3 or Universal Router for tighter quotes.

## V3 swap via SwapRouter02

```solidity
import {ISwapRouter02} from "lib/v3-periphery/contracts/interfaces/ISwapRouter02.sol";

ISwapRouter02 constant ROUTER =
    ISwapRouter02(0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45); // mainnet/arb/op
// On Base: 0x2626664c2603336E57B271c5C0b26F421741e481

function swapV3Exact(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint256 minOut)
    external returns (uint256 amountOut)
{
    IERC20(tokenIn).safeIncreaseAllowance(address(ROUTER), amountIn);
    ISwapRouter02.ExactInputSingleParams memory p = ISwapRouter02.ExactInputSingleParams({
        tokenIn: tokenIn,
        tokenOut: tokenOut,
        fee: fee,                    // 100, 500, 3000, or 10000 (1bp, 5bp, 30bp, 100bp)
        recipient: msg.sender,
        amountIn: amountIn,
        amountOutMinimum: minOut,
        sqrtPriceLimitX96: 0
    });
    amountOut = ROUTER.exactInputSingle(p);
}
```

Fee tiers are exact: 100, 500, 3000, 10000 (parts per million). Use the fee tier that matches the pool with the deepest liquidity for the pair — query `IUniswapV3Factory.getPool(tokenA, tokenB, fee)` and check returned address vs `address(0)`.

## V3 quoting (off-chain, no state change)

QuoterV2 simulates a swap and returns `amountOut` plus gas estimate. **Do not call the quoter on-chain** for production — it's expensive and not gas-bounded. Use it via `eth_call` from your frontend.

```ts
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import { parseAbi } from "viem";

const QUOTER_V2 = "0x61fFE014bA17989E743c5F6cB21bF9697530B21e";  // mainnet
const quoterAbi = parseAbi([
  "function quoteExactInputSingle((address tokenIn,address tokenOut,uint256 amountIn,uint24 fee,uint160 sqrtPriceLimitX96)) external returns (uint256 amountOut,uint160 sqrtPriceAfter,uint32 ticksCrossed,uint256 gasEstimate)",
] as const);

const client = createPublicClient({ chain: mainnet, transport: http(process.env.RPC) });
// Use simulateContract since the function is non-view in QuoterV2
const { result } = await client.simulateContract({
  address: QUOTER_V2,
  abi: quoterAbi,
  functionName: "quoteExactInputSingle",
  args: [{ tokenIn, tokenOut, amountIn, fee: 500, sqrtPriceLimitX96: 0n }],
});
const amountOut = result[0];
```

QuoterV2 is non-view by design (it executes the swap and reverts to capture state). viem's `simulateContract` handles the revert path.

## V4 PoolManager + Hooks (Mainnet)

V4 changed the model: pools live inside a single `PoolManager` contract, identified by a `PoolKey`. Hooks are external contracts that run on `beforeSwap`, `afterSwap`, etc.

PoolManager addresses (verify per chain — V4 is NOT deterministic CREATE2):

| Chain | PoolManager |
|---|---|
| Mainnet | `0x000000000004444c5dc75cB358380D2e3dE08A90` |
| Base | `0x498581ff718922c3f8e6a244956af099b2652b2b` |
| Arbitrum | `0x360e68faccca8ca495c1b759fd9eee466db9fb32` |
| Optimism | `0x9a13f98cb987694c9f086b1f5eb990eea8264ec3` |

PoolKey:

```solidity
struct PoolKey {
    Currency currency0;     // type Currency = address; sorted ascending
    Currency currency1;
    uint24 fee;             // dynamic fee allowed via flag
    int24 tickSpacing;
    IHooks hooks;           // address(0) for no hooks
}
```

Initialize and swap (illustrative — verify against https://docs.uniswap.org/contracts/v4/overview):

```solidity
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";

IPoolManager constant POOL_MANAGER =
    IPoolManager(0x000000000004444c5dc75cB358380D2e3dE08A90);

POOL_MANAGER.initialize(poolKey, sqrtPriceX96);
// Swaps go through PoolManager.unlock() callback or via a Universal Router command
```

Hooks must encode their permissions in the lower bits of their address (BEFORE_SWAP_FLAG, AFTER_SWAP_FLAG, etc.). Mining a hook address that satisfies the right bit pattern is part of the deployment process — see Uniswap's HookMiner.

## Universal Router (the recommended swap surface)

The Universal Router accepts a sequence of commands (`bytes` array of opcodes) and parameters (`bytes[]`). Each command is a 1-byte op:

```
0x00  V3_SWAP_EXACT_IN
0x01  V3_SWAP_EXACT_OUT
0x06  PAY_PORTION
0x08  V2_SWAP_EXACT_IN
0x09  V2_SWAP_EXACT_OUT
0x0a  PERMIT2_PERMIT
0x0b  WRAP_ETH
0x0c  UNWRAP_WETH
0x0d  PERMIT2_TRANSFER_FROM
...
0x10  V4_SWAP   (post-V4 release; verify in https://docs.uniswap.org/contracts/universal-router/overview)
```

Sequence flow: `WRAP_ETH` → `PERMIT2_PERMIT` (one-time per swap) → `V4_SWAP` (or V3/V2) → `PAY_PORTION` (fees) → `UNWRAP_WETH`.

Calling pattern:

```solidity
IUniversalRouter(ROUTER).execute(commands, inputs, deadline);
```

For most apps, generate the `commands`/`inputs` from `@uniswap/universal-router-sdk` (TypeScript) — verify the package at https://github.com/Uniswap/universal-router-sdk.

```ts
import { SwapRouter, UNIVERSAL_ROUTER_ADDRESS } from "@uniswap/universal-router-sdk";
import { Trade } from "@uniswap/router-sdk";
// build a Trade from V2/V3/V4 routes via @uniswap/smart-order-router
const { calldata, value } = SwapRouter.swapCallParameters(trade, {
  slippageTolerance: new Percent(50, 10_000),     // 0.50%
  recipient: account.address,
  deadlineOrPreviousBlockhash: Math.floor(Date.now() / 1000) + 60 * 20,
  inputTokenPermit: permit2Sig,                   // optional
});
```

Universal Router addresses (V4 era — verify in `SKILL.md`):

| Chain | Address |
|---|---|
| Mainnet | `0x66a9893cc07d91d95644aedd05d03f95e1dba8af` |
| Base | `0x6ff5693b99212da76ad316178a184ab56d299b43` |
| Arbitrum | `0xa51afafe0263b40edaef0df8781ea9aa03e381a3` |
| Optimism | `0x851116d9223fabed8e56c0e6b8ad0c31d98b3507` |

## viem snippets

V3 quote (off-chain):

```ts
import { encodeFunctionData } from "viem";

const quote = await publicClient.simulateContract({
  address: QUOTER_V2,
  abi: quoterAbi,
  functionName: "quoteExactInputSingle",
  args: [{ tokenIn: USDC, tokenOut: WETH, amountIn: 1_000_000n, fee: 500, sqrtPriceLimitX96: 0n }],
});
```

V3 swap via SwapRouter02 (TypeScript):

```ts
import { parseAbi } from "viem";

const swapRouterAbi = parseAbi([
  "function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)",
] as const);

const { request } = await publicClient.simulateContract({
  address: SWAP_ROUTER,
  abi: swapRouterAbi,
  functionName: "exactInputSingle",
  args: [{ tokenIn, tokenOut, fee: 500, recipient: account.address, amountIn, amountOutMinimum, sqrtPriceLimitX96: 0n }],
  account: account.address,
});
const hash = await walletClient.writeContract(request);
```

## Common pitfalls

- **Approving the router directly** still works on V3, but for V4/Universal Router prefer Permit2 — fewer signatures over a wallet's lifetime.
- **Permit2 owner semantics**: the third arg is the signer; Permit2 doesn't enforce that `msg.sender == owner`. Anyone with the signature can submit it (sandwich-resistant by deadline + amount cap).
- **V3 fee tier mismatch**: passing `fee=3000` against a pair that only has a 500-tier pool returns `address(0)` from the factory and the swap reverts on `getPool() == address(0)`.
- **V4 hook address bit pattern**: a hook deployed to a non-conforming address will revert on pool init. Use HookMiner.
- **Universal Router commands array length must equal inputs length**; mismatched encoding is the most common bug. Use the SDK.
- **Deadline must be in the future**: `block.timestamp + 60*20` (20 min) is standard. With Sequencer-paused L2s, set longer.
- **Slippage tolerance** in basis points: `new Percent(50, 10_000)` = 0.50%. The SDK applies this to `amountOutMinimum`.
- **WETH vs ETH**: V3/V4 work in WETH; pass ETH and use `WRAP_ETH` command in Universal Router or `multicall(wrap, swap)` on SwapRouter02.

## What to read next

- `references/lending-and-staking.md` — Aave, Compound V3, Lido, Rocket Pool patterns
- `references/oracles-and-bridges.md` — Chainlink feeds, CCIP, Across patterns
- `references/safe-and-aa.md` — Safe and ERC-4337 against these routers
- Uniswap docs: https://docs.uniswap.org/
- Permit2 source: https://github.com/Uniswap/permit2
