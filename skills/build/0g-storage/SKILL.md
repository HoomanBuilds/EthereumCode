---
name: 0g-storage
description: 0G Storage SDK and patterns for decentralized file storage, KV store, and agent persistent memory. Use when building agents that need persistent state, file uploads/downloads, or onchain data storage on 0G.
---

# 0G Storage

0G Storage is a decentralized storage layer providing file upload/download and a KV store. The TypeScript SDK (`@0gfoundation/0g-storage-ts-sdk`) is the primary integration point for agents.

## Network Configuration

| Network | Chain ID | RPC | Indexer | Explorer | Faucet |
|---------|----------|-----|---------|----------|--------|
| Mainnet | 16661 | `https://evmrpc.0g.ai` | `https://indexer-storage-turbo.0g.ai` | `https://chainscan.0g.ai` | N/A |
| Testnet | 16602 | `https://evmrpc-testnet.0g.ai` | `https://indexer-storage-testnet-turbo.0g.ai` | `https://chainscan-galileo.0g.ai` | `https://faucet.0g.ai` |

Faucet provides 0.1 0G/day on testnet.

## Installation

```bash
npm install @0gfoundation/0g-storage-ts-sdk
```

## File Upload/Download

```typescript
import { StorageClient } from "@0gfoundation/0g-storage-ts-sdk";

const client = new StorageClient({
  indexerUrl: "https://indexer-storage-testnet-turbo.0g.ai",
  privateKey: process.env.PRIVATE_KEY,
});

// Upload a file
const { txHash, fileIds } = await client.upload({
  data: Buffer.from("Hello 0G"),
  // Optional: specify number of storage nodes for redundancy
  // replicas: 3,
});

// Download a file
const data = await client.download(fileId);
```

## KV Store (Agent Memory)

The KV layer is the recommended approach for agent persistent memory. It provides an append-only log pattern plus mutable key-value operations.

```typescript
import { KVClient } from "@0gfoundation/0g-storage-ts-sdk";

const kv = new KVClient({
  indexerUrl: "https://indexer-storage-testnet-turbo.0g.ai",
  privateKey: process.env.PRIVATE_KEY,
});

// Set a value
await kv.set("agent:session:123:context", JSON.stringify(conversationHistory));

// Get a value
const context = await kv.get("agent:session:123:context");
const parsed = JSON.parse(context as string);

// Delete a value
await kv.delete("agent:session:123:context");

// List keys with prefix
const keys = await kv.listKeys("agent:session:");
```

## Agent Memory Patterns

### Conversation History
```typescript
const SESSION_KEY = `agent:${agentId}:session:${sessionId}`;
await kv.set(`${SESSION_KEY}:history`, JSON.stringify(messages));
await kv.set(`${SESSION_KEY}:lastUpdate`, Date.now().toString());
```

### Tool Results Cache
```typescript
const CACHE_KEY = `agent:cache:${toolName}:${inputHash}`;
const cached = await kv.get(CACHE_KEY);
if (cached) return JSON.parse(cached as string);
// ... compute result ...
await kv.set(CACHE_KEY, JSON.stringify(result));
```

### State Persistence
```typescript
// Append-only log for audit trail
await kv.set(`agent:${id}:log:${sequenceNumber}`, JSON.stringify(event));
// Mutable current state
await kv.set(`agent:${id}:state`, JSON.stringify(currentState));
```

## Key Naming Conventions

Use hierarchical keys with colons:
- `agent:<id>:session:<id>:<data>` — per-session data
- `agent:<id>:state` — agent's current state
- `agent:<id>:log:<sequence>` — append-only audit log
- `agent:cache:<tool>:<hash>` — cached tool results
- `user:<address>:<key>` — user-specific data

## Error Handling

```typescript
try {
  const result = await kv.get(key);
  if (result === null) {
    // Key doesn't exist — handle gracefully
  }
} catch (err) {
  // Network or indexer error — retry with backoff
}
```

## Gas Considerations

0G Storage transactions use 0G tokens, not ETH. Gas costs are significantly lower than Ethereum mainnet. For testnet development, the faucet provides sufficient 0G for development and testing.

## Security

- Never store private keys or secrets in 0G Storage
- Data is stored on-chain — assume all data is public
- For sensitive data, encrypt before storing
- Validate all data retrieved from storage before use

## Common Pitfalls

- **Indexer lag:** writes may take a few seconds to appear in reads — implement retry logic
- **Size limits:** individual values have size limits — chunk large data
- **No transactions:** KV operations are individual transactions, not batched — use for individual operations, not bulk updates
- **Testnet reset:** testnet data may be reset — don't rely on testnet for persistent data
