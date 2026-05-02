# Subgraph Recipes

Specific subgraph patterns that come up often: relations, aggregations, time-series, multi-chain, factory contracts, upgradeable proxies, and the gotchas that bite when you deploy to the decentralized network. For the basics (schema, mappings, deploy), see `SKILL.md`.

## Schema patterns

### One-to-many via @derivedFrom

The reverse side of a relation that doesn't write storage:

```graphql
type Pool @entity {
  id: ID!                                # pool address
  token0: Token!
  token1: Token!
  swaps: [Swap!]! @derivedFrom(field: "pool")   # virtual; no extra writes
}

type Swap @entity(immutable: true) {
  id: ID!                                # tx-hash + log-index
  pool: Pool!
  amountIn: BigInt!
  amountOut: BigInt!
  timestamp: BigInt!
}
```

`@derivedFrom` is read-only. The mapping handler only writes `Swap` with `swap.pool = poolId`; the `Pool.swaps` query field traverses backwards. No double-write, no consistency drift.

### Immutable entities

`@entity(immutable: true)` — entity is written once and never updated. Subgraph indexer optimizes storage and access. Use for transfer logs, swap logs, anything event-style.

`@entity` (default mutable) for things you update over time: positions, balances, owners.

### IDs that don't collide

Standard ID conventions:

| Entity | ID format |
|---|---|
| User | `event.params.user.toHex()` |
| Token | `tokenAddress.toHex()` |
| Position | `userAddress + '-' + poolId` |
| Transfer | `txHash + '-' + logIndex.toString()` |
| Day-bucket | `dayId.toString()` (Unix days) |
| Hour-bucket | `hourId.toString()` (Unix hours) |

Never use `event.transaction.hash` alone — multiple events per tx would collide.

### Composite IDs

```typescript
function getPositionId(user: Address, poolId: string): string {
  return user.toHex() + "-" + poolId;
}
```

Predictable IDs let you `.load(id)` deterministically without scanning.

## Aggregation patterns

### Day buckets (price + volume)

```graphql
type PoolDayData @entity {
  id: ID!                  # poolAddress + '-' + dayId
  pool: Pool!
  date: Int!               # unix timestamp at start of day (UTC)
  volumeUSD: BigDecimal!
  txCount: BigInt!
  open: BigDecimal!
  close: BigDecimal!
  high: BigDecimal!
  low: BigDecimal!
}
```

```typescript
function updatePoolDayData(event: SwapEvent, pool: Pool, volumeUSD: BigDecimal): void {
  let dayId = event.block.timestamp.toI32() / 86400;
  let id = pool.id + "-" + dayId.toString();
  let dayData = PoolDayData.load(id);
  if (dayData == null) {
    dayData = new PoolDayData(id);
    dayData.pool = pool.id;
    dayData.date = dayId * 86400;
    dayData.open = pool.tokenPriceUSD;
    dayData.high = pool.tokenPriceUSD;
    dayData.low = pool.tokenPriceUSD;
    dayData.volumeUSD = BigDecimal.zero();
    dayData.txCount = BigInt.zero();
  }
  if (pool.tokenPriceUSD.gt(dayData.high)) dayData.high = pool.tokenPriceUSD;
  if (pool.tokenPriceUSD.lt(dayData.low))  dayData.low  = pool.tokenPriceUSD;
  dayData.close = pool.tokenPriceUSD;
  dayData.volumeUSD = dayData.volumeUSD.plus(volumeUSD);
  dayData.txCount = dayData.txCount.plus(BigInt.fromI32(1));
  dayData.save();
}
```

Same pattern for hour buckets (3600s) or minute buckets — match your UI's resolution. Don't aggregate finer than your frontend uses; storage cost grows quickly.

### Running totals

For something like "all-time volume per user":

```graphql
type UserStats @entity {
  id: ID!                        # user address
  totalVolumeUSD: BigDecimal!
  totalSwaps: BigInt!
  firstSwapAt: BigInt!
  lastSwapAt: BigInt!
}
```

Update in the swap handler. For top-N queries, sort and limit at query time:

```graphql
{ userStats(first: 10, orderBy: totalVolumeUSD, orderDirection: desc) {
    id totalVolumeUSD totalSwaps
}}
```

## Factory pattern (dynamic data sources)

When a factory deploys child contracts (Uniswap V2 pools, Aave markets):

**subgraph.yaml:**
```yaml
dataSources:
  - kind: ethereum/contract
    name: Factory
    network: mainnet
    source:
      address: "0xFactory..."
      abi: Factory
      startBlock: 1234567
    mapping:
      kind: ethereum/events
      apiVersion: 0.0.8
      language: wasm/assemblyscript
      entities: [Pool]
      abis:
        - name: Factory
          file: ./abis/Factory.json
        - name: Pool
          file: ./abis/Pool.json
      eventHandlers:
        - event: PoolCreated(indexed address,indexed address,indexed address)
          handler: handlePoolCreated
      file: ./src/factory.ts

templates:
  - kind: ethereum/contract
    name: Pool
    network: mainnet
    source:
      abi: Pool
    mapping:
      kind: ethereum/events
      apiVersion: 0.0.8
      language: wasm/assemblyscript
      entities: [Swap]
      abis:
        - name: Pool
          file: ./abis/Pool.json
      eventHandlers:
        - event: Swap(indexed address,uint256,uint256,uint256,uint256,indexed address)
          handler: handleSwap
      file: ./src/pool.ts
```

**factory handler:**
```typescript
import { PoolCreated } from "../generated/Factory/Factory";
import { Pool as PoolTemplate } from "../generated/templates";

export function handlePoolCreated(event: PoolCreated): void {
  let pool = new Pool(event.params.pool.toHex());
  pool.token0 = event.params.token0;
  pool.token1 = event.params.token1;
  pool.createdAt = event.block.timestamp;
  pool.save();

  // Spawn a new template instance — the indexer now watches the new pool's events
  PoolTemplate.create(event.params.pool);
}
```

The graph node creates a new "child" data source for each pool, indexing only events from that pool's address. This scales to millions of children without indexing irrelevant events.

## Multi-chain subgraphs

A subgraph deploys to one chain. For multi-chain:

1. Keep the same `schema.graphql` and mapping logic.
2. Maintain one `subgraph.<chain>.yaml` per chain (or use a build script to template).
3. Deploy as separate subgraphs: `myapp-base`, `myapp-arbitrum`, etc.
4. Frontend queries multiple subgraphs and unions client-side.

```typescript
// frontend
const queries = await Promise.all([
  graphqlClient.request(SUBGRAPH_BASE, query),
  graphqlClient.request(SUBGRAPH_ARBITRUM, query),
  graphqlClient.request(SUBGRAPH_OPTIMISM, query),
]);
const combined = mergeAndSort(queries);
```

## Upgradeable proxy patterns

When the proxy address stays the same but implementation changes:

- Use the proxy's address as the data source `source.address`.
- ABI in `subgraph.yaml` must include events from EVERY implementation version that ever existed.
- If new events were added in v2, add them to the ABI; the graph node ignores events that don't have a handler.
- For storage reads (`contract.someView()`), the call hits the proxy → current implementation. So if the storage layout changed, your read returns the new shape. Test fork-style.

## Call handlers vs event handlers

Event handlers (default) — fire when the contract emits an event.

Call handlers — fire when a function on the contract is called. **Slow** (graph-node has to trace every block) and not supported on every chain. Avoid unless events are insufficient.

Block handlers — fire on every block (or filter). Use for time-based aggregation only.

## Performance

### Don't read state from a handler unless you must

```typescript
// SLOW — eth_call on every event
let contract = ERC20.bind(event.address);
let totalSupply = contract.totalSupply();

// FAST — keep the cached value in an entity
let token = Token.load(event.address.toHex())!;
let totalSupply = token.totalSupply;       // updated on Transfer events to/from zero
```

`bind().fn()` does an `eth_call` against the archive node. Each call adds ~10–100ms × the number of events. Cache derivable values as entities.

### `try_` calls for non-reverts

If the contract MIGHT revert (e.g., calling `decimals()` on a non-standard token):

```typescript
let contract = ERC20.bind(event.address);
let decimalsResult = contract.try_decimals();
let decimals = decimalsResult.reverted ? 18 : decimalsResult.value;
```

Without `try_`, a revert crashes the indexer.

### Indexer-side full-text search

```graphql
type Token @entity {
  id: ID!
  name: String!
  symbol: String!
}

type _Schema_
  @fulltext(
    name: "tokenSearch"
    language: en
    algorithm: rank
    include: [{ entity: "Token", fields: [{ name: "name" }, { name: "symbol" }] }]
  )
```

Then query: `{ tokenSearch(text: "uni") { id name symbol } }`. Faster than `where: { name_contains: "uni" }`.

## Subgraph deployment

### Studio (development)

```bash
graph auth --studio <DEPLOY_KEY>
graph deploy --studio my-subgraph
# → query at https://api.studio.thegraph.com/query/<id>/<name>/version/latest
```

Free, rate-limited, fine for prototypes.

### Decentralized network (production)

1. Deploy to studio first as v0.0.1.
2. From Studio, "Publish" → on-chain tx (Arbitrum One) signs the publish.
3. Curators signal GRT on the subgraph; indexers pick it up.
4. Query via the gateway: `https://gateway.thegraph.com/api/<API_KEY>/subgraphs/id/<SUBGRAPH_ID>`.

Cost: GRT signal (variable; ~$10–500 for typical subgraphs to attract indexers). Per-query cost (sub-cent at typical volumes).

### Self-hosted

If you want to run your own indexer (predictable cost, no GRT, custom features), run `graph-node` locally with a Postgres + Ethereum RPC. The decentralized network is an alternative, not a replacement, to self-hosting.

## Subgraph studio quirks

- **Pause syncing**: Studio doesn't auto-pause when you push a buggy mapping; it'll happily index garbage. Always test in a local `graph-node` first for non-trivial logic.
- **Max startBlock**: Set it to the deploy block of the contract (or a reasonable starting point). Setting `0` re-indexes from genesis = days for chains with millions of blocks.
- **Block range queries**: GraphQL queries with `block: { number: 12345 }` return state AS OF that block. Useful for snapshot tools.

## Common pitfalls

- **Events not indexed because `startBlock` is too high**: subgraph misses everything before that block. Use the contract's actual deploy block.
- **`entity.save()` forgotten**: silent data loss; entity exists in memory only.
- **Mapping reads `event.params.X` for a non-indexed param expecting it as topic**: indexed params are topics, non-indexed are decoded from data. Both are accessible via `event.params`, but only indexed ones are filterable in `where:`.
- **Float math in mappings**: AssemblyScript has no `f64.toString()` precision guarantee. Always use `BigInt`/`BigDecimal` from graph-ts.
- **Race in dynamic data source**: `PoolTemplate.create(addr)` only takes effect for FUTURE blocks. Events emitted in the SAME tx as factory creation may be missed. Solution: handle the factory event AND read the same data the pool would have emitted.
- **Schema change without redeploy from scratch**: changing entity types requires a fresh sync. Test schema changes in studio before publishing.
- **Subgraph fails on a single block**: indexer halts. Add `try_` calls and null guards; one bad token's `decimals()` revert shouldn't kill the whole subgraph.
- **No version pinning of graph-cli**: `graph build` output changes between versions. Pin in `package.json`.

## What to read next

- `references/ponder-and-alternatives.md` — when you don't want a subgraph
- `references/event-design.md` — designing contracts so subgraphs are easy
- The Graph docs: https://thegraph.com/docs/
- AssemblyScript reference: https://www.assemblyscript.org/
