# Event Design and Log Queries

Events are the contract's API to the offchain world. A well-designed event suite makes indexing trivial; a bad one makes it impossible. This file is the contract-side discipline plus the RPC-level mechanics for raw `eth_getLogs` queries when you don't have an indexer.

For indexer-specific patterns, see `references/subgraph-recipes.md` and `references/ponder-and-alternatives.md`.

## Event-first contract design

Every state change emits an event. **Every** state change. If your contract has 10 mutating functions and 4 events, you've left 6 changes invisible to indexers and frontends.

### What "event-first" actually means

```solidity
// BAD — silent state change
function updateFee(uint256 newFee) external onlyOwner {
    fee = newFee;
}

// GOOD — same gas, fully indexable
event FeeUpdated(uint256 oldFee, uint256 newFee, address indexed by);

function updateFee(uint256 newFee) external onlyOwner {
    emit FeeUpdated(fee, newFee, msg.sender);
    fee = newFee;
}
```

Both `oldFee` and `newFee` is the lowest-effort pattern that lets the indexer compute "fee history" without reading prior state.

### Indexed parameters: pick filterable fields

Events allow up to **3 indexed (topic) parameters** — these are stored in the receipt's bloom filter so they can be filtered server-side via `eth_getLogs`. Non-indexed parameters live in `data`, which is only readable AFTER fetching the log.

| Use indexed for | Use non-indexed for |
|---|---|
| Addresses (sender, recipient, token) | Amounts (uint256 prices, balances) |
| IDs (tokenId, listingId, poolId) | Bytes/strings (URIs, metadata) |
| Status enums you'll filter on | Computed/snapshot values |

```solidity
// Anatomy
event Sold(
    uint256 indexed listingId,    // topic1: filter by listing
    address indexed buyer,        // topic2: filter by buyer
    address indexed seller,       // topic3: filter by seller
    uint256 price,                // data: amount (not filterable, but readable)
    uint256 timestamp             // data: extra context
);
```

### Standard event names

Match ERC standards exactly:

```solidity
event Transfer(address indexed from, address indexed to, uint256 value);          // ERC-20
event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);// ERC-721
event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value);  // ERC-1155
event Approval(address indexed owner, address indexed spender, uint256 value);
event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
```

Why exact: indexers, block explorers, wallets all auto-decode these. A custom `Transferred` event won't show up in Etherscan's "Token Transfers" tab.

### Don't index strings or bytes

```solidity
// BAD — string indexed = hash(string), unfilterable in practice
event Named(string indexed name);

// GOOD — emit both, hash for filter, raw for display
event Named(bytes32 indexed nameHash, string name);
```

When Solidity indexes a `string`, it stores `keccak256(string)` as the topic. You can filter exact matches if you compute the hash client-side, but you can't filter "starts with foo".

### Keep event signatures stable

The event topic0 = `keccak256(EventName(type1,type2,...))`. Changing names or types breaks every existing indexer. Once shipped, treat events like a public API:

- Add new events; never modify existing ones.
- If a parameter must change semantics, emit a new event (`SoldV2`) and deprecate the old.

### Patterns for upgradeable contracts

When using OZ upgradeable contracts:

- Emit version markers on upgrade: `event Upgraded(address indexed implementation)`.
- Keep storage gaps (`uint256[50] __gap`) so adding fields doesn't shift slots.
- Event ABIs in your indexer's config must include all historic + current versions.

## Gas cost of events

| Component | Gas |
|---|---|
| Base `LOG` opcode | 375 |
| Per topic | 375 |
| Per byte of data | 8 |

So a 4-topic event (anonymous events have 4 topics; non-anonymous have topic0=signature + 3 indexed) with 64 bytes of data: `375 + 4*375 + 64*8 = 2387` gas. Pennies on L2, still cheap on L1.

Events do NOT cost storage. They live in receipts, which are pruned by non-archive nodes after a while but always accessible via archive nodes and indexers.

**Don't over-index for "future-proofing"**: each indexed param costs 375 gas. If you're not going to filter on it, leave it in data.

## Reading events: eth_getLogs anatomy

Without an indexer, the only way to read historical events is `eth_getLogs`. Three filter dimensions:

```ts
const logs = await client.getLogs({
  address: CONTRACT,                          // optional, single or array
  fromBlock: 17_000_000n,
  toBlock: 17_001_000n,
  topics: [
    TRANSFER_TOPIC,                            // topic0: event signature
    null,                                      // topic1: any (no filter)
    [pad(alice), pad(bob)],                    // topic2: alice OR bob
  ],
});
```

`null` in a topic slot = no filter. An array = OR. Up to 4 topics (topic0 = event signature; topic1–3 = indexed params).

Topics are 32-byte left-padded values. For an address: `'0x' + '00'.repeat(12) + address.slice(2)`. Viem's `pad()` handles this.

### Provider limits

| Provider | `eth_getLogs` block range |
|---|---|
| Public free (cloudflare-eth, ankr) | 100–10,000 |
| Alchemy free tier | 10,000 |
| Alchemy pro | up to 50,000 with `limit` |
| Infura | 10,000 |
| QuickNode | 10,000 (configurable up) |
| Self-hosted Geth/Erigon | unlimited (memory permitting) |

Always paginate. Walking 1M blocks at 5K-block windows = 200 requests; provider rate limits will throttle.

```ts
async function getAllLogs(client, params, fromBlock, toBlock, step = 5000n) {
  const all = [];
  for (let from = fromBlock; from <= toBlock; from += BigInt(step)) {
    const to = from + BigInt(step) - 1n > toBlock ? toBlock : from + BigInt(step) - 1n;
    try {
      const logs = await client.getLogs({ ...params, fromBlock: from, toBlock: to });
      all.push(...logs);
    } catch (e) {
      // halve the step on "too many results" or "exceeded range" errors
      step = step / 2n;
      if (step < 1n) throw e;
      from -= BigInt(step);   // retry this range
    }
  }
  return all;
}
```

### Block tags

| Tag | Meaning |
|---|---|
| `latest` | most recent block (may reorg) |
| `safe` | post-merge: 2-epoch attestation; rarely reorgs |
| `finalized` | post-merge: finalized; effectively never reorgs |
| `earliest` | block 0 |
| `pending` | mempool projection; provider-dependent |

For indexers, query with `toBlock: 'finalized'` to avoid handling reorgs (at the cost of ~12-minute lag).

### Filter creation pattern

For long-running services, create a filter and poll it:

```ts
const filter = await client.createEventFilter({
  address: CONTRACT,
  event: parseAbiItem("event Sold(uint256 indexed,address indexed,uint256)"),
  fromBlock: 'latest',
});

setInterval(async () => {
  const logs = await client.getFilterChanges({ filter });
  for (const log of logs) await handleSold(log);
}, 12_000);
```

Provider must support filter sessions; some don't (filters expire after ~5 minutes of no activity).

### WebSocket subscriptions

For real-time:

```ts
const wsClient = createPublicClient({ chain, transport: webSocket(WSS) });

const unsubscribe = wsClient.watchEvent({
  address: CONTRACT,
  event: parseAbiItem("event Sold(uint256 indexed,address indexed,uint256)"),
  onLogs: (logs) => handleLogs(logs),
});
```

Caveat: on reorgs, viem's watcher emits removed logs (with `removed: true`) — handle this. Many tutorials skip the reorg case.

## Decoding logs without ABIs

If you only have the event signature string:

```ts
import { keccak256, toBytes } from "viem";
const sig = "Transfer(address,address,uint256)";
const topic0 = keccak256(toBytes(sig));
// 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef
```

Etherscan and 4byte.directory have a database of event topics → signatures. Use to identify unknown events from a contract you don't have ABI for.

## Custom errors as "events"

Solidity custom errors are NOT emitted on revert; they're encoded in the revert reason. They don't show up in `eth_getLogs`. If you want a "soft failure" event:

```solidity
event TradeRejected(address indexed user, uint256 reason);
// emit before reverting? No — events emitted before a revert are dropped.

// Pattern: emit-and-don't-revert in non-critical paths
function tryBuy(...) external returns (bool) {
    if (!_canBuy(...)) {
        emit TradeRejected(msg.sender, REASON_INSUFFICIENT_FUNDS);
        return false;
    }
    _buy(...);
    return true;
}
```

If the contract reverts, ALL events emitted in that tx (from any contract called) are rolled back. Use try/catch in the caller if you want to keep events from a failed inner call.

## Event design checklist

- [ ] Every state-mutating function emits at least one event
- [ ] Events match ERC standards exactly where applicable
- [ ] 0–3 indexed params, chosen for filtering (addresses, IDs)
- [ ] Old + new value both emitted on parameter changes
- [ ] No `string indexed`; use `bytes32` hash + non-indexed string
- [ ] Event signatures stable across upgrades (or versioned)
- [ ] Critical state can be reconstructed by replaying events from genesis (no "secret" state changes)
- [ ] Event-only data (timestamps, message senders) emitted explicitly, not relying on `block.timestamp` from receipt

## Common pitfalls

- **Forgetting to emit on view → mutation transitions** (e.g., a function that sometimes mutates and sometimes doesn't) → indexers miss the state change.
- **Indexing high-cardinality strings** → topic is a hash; UI can't display the original value without a separate registry.
- **Emitting events in constructors → always works, but ABIs may not include them** if frameworks ignore constructor events. Check Foundry / Hardhat artifacts.
- **Anonymous events** (`event Foo(...) anonymous`) → no topic0, can't be filtered by signature. Don't use unless implementing a known protocol that requires them.
- **Re-emitting events on no-op state changes** → bloats logs. Skip emit if `oldValue == newValue`.
- **Using `block.timestamp` in the event when it's already in the block header** → wasted gas. Indexers read `block.timestamp` from the log's block. Only emit the timestamp if you compute a different one (deadline, delayed action).
- **Library-emitted events** → Solidity allows libraries to emit events but they appear under the calling contract's address in receipts. Confusing, but workable; document the source.
- **Forgotten `removed: true` log** during reorgs → indexer double-counts.

## What to read next

- `references/subgraph-recipes.md` — turning these events into queryable entities
- `references/ponder-and-alternatives.md` — TS-native indexers
- `building-blocks/SKILL.md` — what the standard contract events look like
- viem getLogs reference: https://viem.sh/docs/actions/public/getLogs.html
- 4byte for unknown event lookup: https://www.4byte.directory/
