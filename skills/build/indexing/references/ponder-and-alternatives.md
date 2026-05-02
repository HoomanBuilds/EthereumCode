# Ponder and Indexing Alternatives

The Graph isn't the only path. This file is the menu of alternatives, when each beats a subgraph, and concrete starter shapes for the most common ones (Ponder, Goldsky, Envio, custom indexer).

For The Graph specifics, see `references/subgraph-recipes.md`. For why you index at all, see `SKILL.md`.

## Choose-your-indexer cheatsheet

| Need | Best fit |
|---|---|
| Decentralized, censorship-resistant, multi-team | The Graph (decentralized network) |
| TypeScript-only stack, single team, full control | Ponder |
| Hosted with SLA, mirror to Postgres/BigQuery | Goldsky |
| Fastest sync (HyperSync) | Envio |
| Already have Postgres + want SQL queries | Custom Node + ethers/viem |
| Don't need history, only "what's owned now" | Alchemy/QuickNode enhanced APIs |
| Analytics + dashboards, not app backend | Dune Analytics |
| Cross-chain user activity | Covalent / Moralis (centralized) |

## Ponder

TypeScript indexer that runs on your infra (or hosted). Turns events into Postgres rows; ships a built-in API.

### When Ponder beats The Graph

- Your team is TypeScript-fluent; AssemblyScript is friction.
- You want to test indexer logic with the same tooling as your app.
- Cost predictability — runs on your VPS or theirs, no GRT signaling.
- You want to query SQL alongside GraphQL.
- Single-app use case, not multi-team or decentralized.

### Ponder skeleton

```bash
npm create ponder@latest my-indexer
cd my-indexer && npm install
```

Generated structure:
```
my-indexer/
├── ponder.config.ts        ← chain + contract sources
├── ponder.schema.ts        ← schema (TypeScript, not GraphQL)
├── src/
│   └── index.ts            ← event handlers
└── abis/
```

**ponder.config.ts:**
```ts
import { createConfig } from "@ponder/core";
import { http } from "viem";
import MarketplaceAbi from "./abis/Marketplace.json";

export default createConfig({
  networks: {
    base: { chainId: 8453, transport: http(process.env.BASE_RPC) },
  },
  contracts: {
    Marketplace: {
      network: "base",
      abi: MarketplaceAbi,
      address: "0x...",
      startBlock: 12345678,
    },
  },
});
```

**ponder.schema.ts:**
```ts
import { onchainTable, primaryKey } from "@ponder/core";

export const listing = onchainTable("listing", (t) => ({
  id: t.bigint().primaryKey(),
  seller: t.hex().notNull(),
  token: t.hex().notNull(),
  tokenId: t.bigint().notNull(),
  priceWei: t.bigint().notNull(),
  active: t.boolean().notNull().default(true),
  listedAt: t.bigint().notNull(),
}));

export const sale = onchainTable("sale", (t) => ({
  id: t.text().primaryKey(),       // tx-hash + log-index
  listingId: t.bigint().notNull(),
  buyer: t.hex().notNull(),
  priceWei: t.bigint().notNull(),
  timestamp: t.bigint().notNull(),
}));
```

**src/index.ts:**
```ts
import { ponder } from "@/generated";

ponder.on("Marketplace:Listed", async ({ event, context }) => {
  await context.db.insert(listing).values({
    id: event.args.listingId,
    seller: event.args.seller,
    token: event.args.tokenContract,
    tokenId: event.args.tokenId,
    priceWei: event.args.price,
    active: true,
    listedAt: event.block.timestamp,
  });
});

ponder.on("Marketplace:Sold", async ({ event, context }) => {
  await context.db.update(listing, { id: event.args.listingId }).set({ active: false });
  await context.db.insert(sale).values({
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    listingId: event.args.listingId,
    buyer: event.args.buyer,
    priceWei: event.args.price,
    timestamp: event.block.timestamp,
  });
});
```

Run `npm run dev` → indexer syncs + serves a GraphQL endpoint at `http://localhost:42069/graphql`. Tables also queryable via direct Postgres.

### Ponder gotchas

- **Single-process by default**: scaling to many chains or huge contracts may need horizontal sharding.
- **No on-chain decentralized story**: it's your infra. Cost is your problem; uptime is your problem.
- **Schema migrations**: changing `ponder.schema.ts` re-indexes from start. For huge contracts that's hours; plan downtime.
- **GraphQL is generated, not authored**: less flexible than a hand-rolled schema. If you need custom resolvers, write a thin layer on top of the Postgres tables.

## Goldsky

Hosted indexing. Two modes:

1. **Mirror**: Goldsky mirrors a subgraph or onchain data into your Postgres / BigQuery / Kafka. Use when you already have a subgraph but want SQL access at scale.
2. **Subgraph hosting**: deploy subgraphs to Goldsky's network instead of The Graph. SLA, faster sync, API key auth.

```bash
goldsky subgraph deploy my-subgraph/0.0.1 \
  --from-ipfs-hash QmYourSubgraphHash
```

When Goldsky beats The Graph: you need an SLA (Goldsky's enterprise tier), you want to mirror onchain data into your data warehouse, or you've hit limits on the decentralized network.

## Envio

HyperSync-backed indexer. Sells "10–100× faster sync" by reading a parallelized log stream instead of replaying blocks. TypeScript-friendly.

```bash
pnpm create envio
# Pick contract + network
```

Generates a config + handlers similar to Ponder. The differentiator is sync speed — full Uniswap V3 history in minutes vs hours.

When Envio beats Ponder/The Graph: you index a high-volume contract (DEX, perps protocol) and re-syncs are frequent. The HyperSync architecture is a real win for that workload.

## Custom Node indexer

For full control, write your own with ethers/viem + a queue + Postgres:

```ts
import { createPublicClient, webSocket, parseAbiItem } from "viem";
import { base } from "viem/chains";

const client = createPublicClient({ chain: base, transport: webSocket(WSS) });

// Backfill
const fromBlock = 12345678n;
const latest = await client.getBlockNumber();
for (let from = fromBlock; from < latest; from += 1000n) {
  const to = from + 999n > latest ? latest : from + 999n;
  const logs = await client.getLogs({
    address: MARKETPLACE,
    event: parseAbiItem("event Sold(uint256 indexed listingId, address indexed buyer, uint256 price)"),
    fromBlock: from, toBlock: to,
  });
  await db.insertSales(logs);
}

// Live tail
client.watchEvent({
  address: MARKETPLACE,
  event: parseAbiItem("event Sold(uint256 indexed listingId, address indexed buyer, uint256 price)"),
  onLogs: (logs) => db.insertSales(logs),
});
```

When custom beats everything else:
- You need bespoke logic that no indexer expresses well (cross-protocol joins at index time).
- You're already running infra (a microservice; another worker is cheap).
- You don't need historical replays often.

When NOT to roll your own:
- You're a small team. Indexer ops is a real job.
- Reorgs are not optional. Robust reorg handling alone is weeks of work.
- You're rolling forward through chain upgrades. Hard forks change RPC behavior.

### Reorg handling (the hardest part)

Every indexer has to handle reorgs. The pattern:

1. Track the last `N` blocks indexed in detail (block hash + entity diffs).
2. On every new block, check `block.parentHash === lastIndexedBlock.hash`. If mismatch, walk back until a common ancestor.
3. Roll back entities: undo writes from the now-orphaned blocks.
4. Re-apply from the new chain.

The Graph and Ponder do this for you. A custom indexer must implement it; otherwise it'll silently include data from orphaned blocks.

## Provider enhanced APIs (Alchemy, QuickNode, Moralis)

For "current state of an address" queries, hosted APIs are dramatically faster than building a subgraph:

```ts
// Alchemy
const balances = await alchemy.core.getTokenBalances(address);
const nfts     = await alchemy.nft.getNftsForOwner(address);
const txs      = await alchemy.core.getAssetTransfers({
  fromAddress: address, category: ["external", "erc20", "erc721"],
});
```

When provider APIs beat custom indexing:
- Wallet apps: "show this user's tokens, NFTs, recent activity".
- One-off lookups: "did this address ever interact with that contract?"
- You don't care about decentralization for the read path.

When they don't:
- Need historical state at a point in time (most APIs only give "now" + recent).
- Cross-protocol queries ("all positions across Aave, Compound, Morpho").
- Complex aggregations (subgraph or warehouse, not API).

## Dune Analytics

SQL over decoded onchain data. Use for dashboards, ad-hoc analysis, never as an app backend (no SLA, no realtime).

```sql
WITH daily AS (
  SELECT
    DATE_TRUNC('day', evt_block_time) AS day,
    SUM(price / 1e18) AS volume_eth
  FROM mycontract_ethereum.Marketplace_evt_Sold
  WHERE evt_block_time > NOW() - INTERVAL '30' DAY
  GROUP BY 1
)
SELECT day, volume_eth,
  AVG(volume_eth) OVER (ORDER BY day ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) AS volume_7d_avg
FROM daily
ORDER BY day;
```

Dashboards embed in Notion, Twitter, your own site. For investor decks and protocol health pages, Dune is the right tool.

## Decision tree

```
Question: do I need history?
  no → Provider API (Alchemy / QuickNode)
  yes ↓

Question: am I a TS team and does centralization matter?
  yes-and-not-centralized-ok → Ponder
  yes-and-need-decentralized → The Graph
  no (any stack ok) → The Graph

Question: is sync speed the bottleneck?
  yes → Envio (HyperSync)

Question: do I need SLA + warehouse mirror?
  yes → Goldsky

Question: is this for a public dashboard, not an app?
  yes → Dune

Question: do I have unusual cross-protocol logic and a team to maintain it?
  yes → Custom Node indexer with reorg handling
```

## Cost rough ranges (early 2026)

| Service | Cost shape |
|---|---|
| The Graph studio | Free for development |
| The Graph network | $50–500 GRT signal + ~$0.0001/query |
| Ponder self-hosted | $20–100/mo VPS + Postgres |
| Ponder Cloud | $30–500/mo depending on volume |
| Goldsky | $200–2k/mo enterprise |
| Envio | $0–500/mo, scales with usage |
| Alchemy enhanced | Included with RPC plan |
| Custom Node + Postgres | $50–500/mo + your time |
| Dune | Free tier; $390+/mo for private + API |

## Pitfalls across all options

- **Indexer doesn't handle reorgs** → silently includes orphaned data. The Graph/Ponder do; custom indexers often don't.
- **No backfill plan** → an indexer that crashes loses minutes of data; reset to last good block + replay.
- **Trust in a centralized indexer** for trust-critical reads → the indexer is then part of your security perimeter. Either decentralize (The Graph) or only use indexer reads for non-trust-critical UX.
- **Forgot to track block hashes** → can't detect reorgs.
- **Hard-coded contract address per chain** → multi-chain rewrite is painful. Parametrize from start.
- **Fork doesn't preserve indexer state** → for local dev with a fork, run a local indexer pointed at the fork. Don't try to use a mainnet indexer from a forked chain.

## What to read next

- `references/subgraph-recipes.md` — Graph-specific patterns
- `references/event-design.md` — making any indexer's life easier
- Ponder docs: https://ponder.sh/docs/
- Goldsky docs: https://docs.goldsky.com/
- Envio docs: https://docs.envio.dev/
- Dune docs: https://docs.dune.com/
