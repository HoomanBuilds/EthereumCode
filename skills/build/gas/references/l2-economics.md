# L2 Economics Deep Dive

How L2 fees are actually computed, why your "cheap" L2 transaction sometimes costs $0.50 instead of $0.005, and how to optimize for the calldata-dominated fee model. Verify per-chain mechanics at the rollup's docs — gas formulas update with each hard fork.

## The two-component fee

Every L2 transaction pays:

1. **L2 execution fee** — gas × L2 gas price. Pays the sequencer for executing the transaction. Typically very cheap (sub-cent on idle L2s).
2. **L1 data fee** — pays Ethereum mainnet for posting the transaction's data so the rollup is verifiable. Post-EIP-4844, this is a per-blob cost shared across many L2 transactions.

Total fee = L2 execution + L1 data. On modern L2s, **L1 data is usually 70–95% of the total cost.**

## Pre-4844 vs post-4844

Before EIP-4844 (Dencun, March 2024), L2s posted transaction data as L1 calldata at ~16 gas per byte. A swap that costs 800 calldata bytes would pay 12,800 L1 gas — at 30 gwei mainnet, that's $0.77 just for the L1 data, regardless of how cheap L2 execution was.

After EIP-4844, L2s post data as **blob transactions**. Blobs have their own fee market (`blobBaseFee`) priced separately from regular gas. Blob data is ~100x cheaper than calldata under normal conditions. This is why L2 fees fell from $0.50 to $0.005 overnight in March 2024.

After Pectra (May 2025) and Fusaka (Dec 2025): blob target raised from 3 → 6 → higher, and PeerDAS lets nodes sample 1/8 of data — both push blob costs lower.

## Optimism / Base — the OP Stack formula

OP-Stack chains compute the L1 data fee via the `GasPriceOracle` precompile at `0x420000000000000000000000000000000000000F`. The post-Ecotone (March 2024) formula:

```
l1Fee = (txCompressedSize * 16) * (16 * baseFeeScalar * l1BaseFee + blobBaseFeeScalar * l1BlobBaseFee) / 16e6
```

Where:

- `txCompressedSize` — your transaction's size in bytes after compression estimation (zero bytes = 4, non-zero = 16, divided by 16). Roughly: shorter calldata = cheaper.
- `baseFeeScalar` and `blobBaseFeeScalar` — chain-configured constants set by the L2 governance.
- `l1BaseFee` — current L1 base fee in gwei.
- `l1BlobBaseFee` — current L1 blob base fee.

You can read the breakdown live:

```solidity
import {GasPriceOracle} from "@eth-optimism/contracts-bedrock/src/L2/GasPriceOracle.sol";

GasPriceOracle constant ORACLE = GasPriceOracle(0x420000000000000000000000000000000000000F);

uint256 l1Fee = ORACLE.getL1Fee(txData);              // total L1 portion
uint256 baseScalar = ORACLE.baseFeeScalar();
uint256 blobScalar = ORACLE.blobBaseFeeScalar();
uint256 l1Base     = ORACLE.l1BaseFee();
uint256 l1BlobBase = ORACLE.blobBaseFee();
```

For viem v2 with `viem/op-stack`:

```ts
import { publicActionsL2 } from "viem/op-stack";
const opClient = publicClient.extend(publicActionsL2());

const l1Fee = await opClient.estimateL1Fee({
  to: vault,
  data: encodeFunctionData({ abi, functionName: "deposit", args: [...] }),
});

const total = await opClient.estimateTotalFee({ ... });   // L1 + L2
```

### Key consequence: shorter calldata ≈ proportionally cheaper

A swap encoding with 1,200 bytes costs ~3x more L1 fee than one with 400 bytes — even if the L2 execution gas is identical.

Concrete optimizations for OP-Stack:

- **Minimize calldata size**: pack args, use `calldata` over `memory`, prefer fixed-width small types in external call signatures.
- **Avoid passing zeros**: zero bytes are 4 gas pre-encoding; non-zero are 16. Pre-truncate trailing zero padding where possible (rare since the EVM auto-aligns).
- **Compress when sender + receiver agree**: some protocols deploy a "compressor" contract that takes packed args and unpacks them on-chain; the L1 data fee drops, the L2 execution rises — usually wins.
- **Multicall** = one L2 tx instead of N. Pays the L1 base overhead (signature, RLP) once.

## Arbitrum — different formula

Arbitrum One/Nova use a different fee model. The L1 calldata fee is still the dominant cost, but the formula is per the Arbitrum Stylus / ArbOS gas oracle:

```solidity
ArbGasInfo constant ORACLE = ArbGasInfo(0x000000000000000000000000000000000000006C);
(uint256 perL2Tx, uint256 perL1CalldataByte, uint256 perStorageAlloc) = ORACLE.getPricesInWei();
```

`getPricesInWei` returns the current per-byte L1 cost. Multiply by your tx's calldata size (after compression estimation) for the L1 portion.

For viem:

```ts
import { arbitrum } from "viem/chains";
// arbitrum doesn't have built-in viem helpers like op-stack;
// estimate via the precompile or use a Stylus-aware client (verify at https://viem.sh/)
```

## zkSync Era — gas per pubdata

zkSync charges:

- L2 execution gas (cheaper than EVM because it uses a different VM with different opcode costs).
- A `gas_per_pubdata_byte` cost — every byte of state diff posted to L1 as calldata costs this many L2 gas units.

The L1 fee is bundled into the L2 gas price; you don't see two separate components in the receipt. But the same intuition applies: **state changes are dominated by the L1 cost of posting them**.

zkSync exposes a `gas_per_pubdata_byte_limit` field on transactions — you tell the network "I'm willing to pay up to N L2 gas per byte of pubdata posted." Standard tooling (zksync-ethers, viem zksync extension) sets reasonable defaults.

## Why your transaction sometimes costs 100x more

L1 base fees and blob base fees spike during congestion. A transaction that costs $0.005 on a calm day can cost $0.50 during an L1 gas spike — because the L2's L1-data component is multiplied by the live L1 base fee at the moment your tx is posted (sequencers post data periodically; you pay the rate at posting time, not submission time, depending on chain).

Spikes typically come from:

- A major NFT mint or token launch on mainnet driving up L1 base fee.
- Multiple L2s posting blobs simultaneously, blowing past the blob target and into the exponential blob fee curve.

Best practices:

- Don't promise fixed fees in your UX — quote a range or refresh quotes every few seconds.
- For automated systems, sanity-check the quoted fee against an alert threshold; refuse to submit if fees are 10x normal.

## Choosing an L2 by cost

Order-of-magnitude on idle days:

| Chain | Swap fee | NFT mint | Notes |
|---|---|---|---|
| Base | ~$0.002 | ~$0.002 | OP Stack, blob-priced |
| Arbitrum One | ~$0.003 | ~$0.002 | Custom formula, generally cheap |
| Optimism | ~$0.002 | ~$0.002 | OP Stack |
| zkSync Era | ~$0.005 | ~$0.004 | ZK proofs add some cost vs optimistic |
| Scroll | ~$0.004 | ~$0.003 | ZK |
| Linea | ~$0.005 | ~$0.004 | ZK |
| Polygon zkEVM | ~$0.005 | ~$0.004 | ZK |
| Mainnet | ~$0.04 | ~$0.03 | Post-Fusaka, base fee usually <1 gwei |

Verify live with `cast gas-price --rpc-url <chain>` and benchmark a real transaction; static tables go stale fast.

## Estimating fees in your app

### viem (OP Stack)

```ts
import { publicActionsL2 } from "viem/op-stack";

const client = publicClient.extend(publicActionsL2());
const tx = { to, data, value: 0n };

const [l1Fee, l2Gas, feeData] = await Promise.all([
  client.estimateL1Fee(tx),
  client.estimateContractGas({ ...tx, abi, functionName, args }),
  client.estimateFeesPerGas(),
]);

const totalWei = l1Fee + l2Gas * feeData.maxFeePerGas;
```

### viem (any chain) — heuristic

When chain-specific helpers don't exist, fall back to estimating gas and reading the L2's gas oracle:

```ts
const gas = await client.estimateContractGas({ ... });
const fees = await client.estimateFeesPerGas();
const l2Cost = gas * fees.maxFeePerGas;
// l1Cost: read the relevant gas-price-oracle precompile manually (formula differs per chain)
```

For production, use a chain-specific SDK (zksync-ethers, op-stack helpers, Stylus tooling) — they encode the exact formula.

## Sequencer downtime — UX implications

When an L2's sequencer pauses (rare but happens — Arbitrum Aug 2024, Base several times), users can't submit transactions through the normal RPC. Two recovery paths:

1. **Force inclusion**: submit directly to L1 via the rollup's force-inclusion contract (delays ~1 hour). Most users won't do this; protocols may want a fallback flow that exposes it.
2. **Wait**: sequencer comes back, queue drains.

Your gas-fee UI should display "sequencer status" pulled from the chain's status feed (some chains expose this, some don't). For oracles, see the sequencer-uptime feed pattern in `oracles-and-bridges.md` — it's the same gating logic.

## Common pitfalls

- **Static fee constants in code**: if you hardcode `gasPrice = 0.001 gwei` your tx will silently underpay during a spike and stick in the mempool. Always estimate live.
- **Confusing "L2 gas" with "total fee"**: the L2 gas price you see in MetaMask is just the execution component. The L1 portion is added at submission time and is invisible until you see the receipt.
- **Estimating only `gas`**: if you don't account for the L1 data fee in your sponsorship calculation (paymasters, gasless flows), you under-fund and the bundler rejects.
- **Calldata-heavy designs on OP Stack**: a swap that uses 50 hops costs 5x more in L1 fees than one with 5 hops; users see this as "this app is expensive on Base."
- **Wrong oracle address per chain**: every OP Stack chain has the GasPriceOracle at the same precompile address; non-OP-Stack chains do not. Don't generalize.
- **Double-counting blob cost**: some libraries return the L1 component already multiplied into the L2 gas price; others return them separately. Read the SDK's docs.
- **Treating idle-day costs as worst-case**: pricing your protocol's fees against $0.005 leaves you broken-looking on a $0.50 day. Always design for variability.

## Live data sources

- L1 base fee + blob base fee: https://etherscan.io/blockchart/blobgasused-overall + https://blob.0xfoobar.com/
- OP Stack scalars: read from each chain's GasPriceOracle precompile
- Arbitrum prices: `ArbGasInfo.getPricesInWei()` precompile
- Cross-chain dashboard: https://l2fees.info, https://growthepie.xyz

## What to read next

- `references/optimization-patterns.md` — minimize calldata size, the dominant lever on L2
- `references/profiling-and-tooling.md` — `forge snapshot`, gas reports, EVM debugger
- OP Stack fees: https://docs.optimism.io/stack/transactions/fees
- Arbitrum fees: https://docs.arbitrum.io/how-arbitrum-works/gas-fees
- Blob market: https://eips.ethereum.org/EIPS/eip-4844
