# RPC Providers and Block Explorers

This is a working reference for choosing an RPC provider, picking the right node tier, and verifying contracts across mainnet and L2s. Free-tier limits and SLAs change — verify at each provider's pricing page before committing production traffic.

## Node tiers

| Tier | What it stores | What you can do |
|---|---|---|
| Light | Block headers + small recent state | Verify proofs; almost no `eth_call` |
| Full | Last ~128 blocks of state, all blocks/receipts | Read recent state, send tx, run apps against head |
| Archive | Every historical state root | `eth_call` and `eth_getLogs` at any past block, `debug_trace*` |

Most "free RPCs" are full nodes. Archive is required for:

- Pinned-block fork tests against blocks older than ~128 from head
- Subgraph indexing from genesis
- `debug_traceTransaction`, `debug_traceCall`, `trace_*` (Parity/Erigon namespace)
- `eth_getProof` against historical roots

If your fork tests pin block 19_000_000 and chain head is 22_000_000, you need archive.

## Provider comparison (verify limits at each provider's pricing page)

### Alchemy — https://www.alchemy.com/

- Free tier: ~300M compute units / month (verify current cap at https://www.alchemy.com/pricing).
- Compute units weight calls: `eth_call` is cheaper than `debug_traceTransaction` (which can be 50–500× more). Plan around that.
- Strong: archive on most chains, `alchemy_*` enhanced APIs (token balances, NFT metadata, transfers), webhook + notify service.
- Endpoint shape: `https://<chain>-mainnet.g.alchemy.com/v2/<key>` (e.g. `eth-mainnet`, `base-mainnet`, `arb-mainnet`, `opt-mainnet`).

### Infura — https://www.infura.io/

- Free tier limits in daily request count (verify current at https://www.infura.io/pricing).
- Owned by Consensys; MetaMask default endpoint backend.
- Endpoint shape: `https://<chain>.infura.io/v3/<key>`.
- Some namespaces (`debug_*`, `trace_*`) require paid plans.

### QuickNode — https://www.quicknode.com/

- Per-endpoint pricing (each endpoint is its own quota, not a shared pool).
- Strong on niche chains and "marketplace" add-ons (token API, NFT API, Solana-side, etc.).
- Verify current pricing at https://www.quicknode.com/pricing.

### dRPC — https://drpc.org/

- Aggregator across multiple back-end providers; routes per-method to the cheapest healthy upstream.
- Has a free tier and a "pay-as-you-go" model. Verify at https://drpc.org/pricing.
- Useful as a fallback transport in `viem.fallback([...])`.

### Ankr — https://www.ankr.com/

- Free public RPCs at `https://rpc.ankr.com/<chain>` (rate-limited; not for production).
- Paid premium endpoints with higher limits and archive.

### LlamaNodes — https://llamarpc.com/

- Free public RPCs at `https://eth.llamarpc.com`, `https://base.llamarpc.com`, etc.
- No key required, no auth. Rate-limited; ideal for read-only dashboards and demos.
- Archive availability varies; verify at https://llamarpc.com/.

### Public Node — https://www.publicnode.com/

- Free public RPCs at `https://ethereum-rpc.publicnode.com`, `https://base-rpc.publicnode.com`, etc.
- Operated by Allnodes; no key required.

### Tenderly — https://tenderly.co/

- Not a general-purpose RPC; specialized in simulation, debugging, and gas profiling.
- Web Tx Simulator, Forks (private testnets), Alerts. The debugger UI is the killer feature.
- Free tier exists; production usage is paid. Verify at https://tenderly.co/pricing.

### Self-hosted (Reth, Erigon, Geth)

- **Reth** (https://reth.rs/) — Rust client, fast, modern.
- **Erigon** (https://github.com/erigontech/erigon) — Go client, optimized for archive (efficient storage layout).
- **Geth** (https://geth.ethereum.org/) — reference client.
- Disk requirement for full archive on mainnet is large (multi-TB and growing). Verify current sizes at the client's docs before provisioning.

## Compute unit pricing (Alchemy as example)

Method weights vary across providers. Patterns:

- `eth_blockNumber` / `eth_chainId` ≈ 10 CU
- `eth_call`, `eth_getBalance` ≈ 26 CU
- `eth_getLogs` ≈ 75–600+ CU depending on range/filters
- `eth_getTransactionReceipt` ≈ 15 CU
- `debug_traceTransaction` ≈ 309–500+ CU
- `debug_traceCall` similar

Always verify current weights at https://docs.alchemy.com/reference/compute-unit-costs. Comparable mappings exist for QuickNode (https://www.quicknode.com/docs) and Infura.

Implications:
- Indexers should batch via Multicall3 / `eth_getLogs` over wide ranges, not one-by-one.
- Tracing APIs are the most expensive; gate them behind admin endpoints, not user-facing UIs.
- Prefer subgraphs (The Graph, Goldsky, Envio) for high-volume read workloads — see `build/indexing` skill.

## Rate limit handling

Symptoms: `429 Too Many Requests`, `-32005 limit exceeded`, or partial responses with missing logs.

Mitigations:

- viem `fallback([primary, secondary])` — automatic failover
- viem `http(url, { batch: { batchSize: 1024, wait: 16 } })` — coalesce reads
- Backoff with jitter; do not retry-storm
- Stop calling `eth_blockNumber` in tight loops; subscribe via WebSocket or use `watchBlockNumber`
- Cap historical `eth_getLogs` ranges; iterate windows of 10k blocks (verify your provider's cap)

## eth_getLogs limits

Provider caps vary:

| Provider | Typical max range | Notes |
|---|---|---|
| Alchemy | 10k blocks (free), 50k+ (paid) | Verify at https://docs.alchemy.com/reference/eth-getlogs |
| Infura | Often capped by response size, not range | Verify at https://docs.metamask.io/services/ |
| QuickNode | Endpoint-dependent | Verify at https://www.quicknode.com/docs |
| Public RPCs | Often very small (~1k) | |

Pattern for resilient indexing:

```ts
async function getLogsChunked(client, filter, fromBlock, toBlock, step = 10_000n) {
  const all = [];
  for (let from = fromBlock; from <= toBlock; from += step) {
    const to = from + step - 1n > toBlock ? toBlock : from + step - 1n;
    const logs = await client.getLogs({ ...filter, fromBlock: from, toBlock: to });
    all.push(...logs);
  }
  return all;
}
```

## Block explorers

### Etherscan family

Etherscan and family explorers (https://etherscan.io, https://basescan.org, https://arbiscan.io, https://optimistic.etherscan.io, https://polygonscan.com, https://lineascan.build, https://snowtrace.io, etc.) share a unified v2 API.

Etherscan v2 unified API key: a single API key works across all v2-supported chains, with the chain selected via the `chainid` query parameter. Verify the supported-chain list at https://docs.etherscan.io/.

```bash
# Etherscan v2: same key, chainid selects the chain
curl "https://api.etherscan.io/v2/api?chainid=8453&module=account&action=balance&address=0x...&apikey=$KEY"
```

For pre-v2 endpoints (legacy `https://api.basescan.org/api`) you may still need per-chain keys; migrate to v2 if you have it.

### Blockscout

Open-source explorer (https://www.blockscout.com/). Many L2s ship Blockscout instances:

- Optimism: https://optimism.blockscout.com/
- Base: https://base.blockscout.com/
- Arbitrum One: https://arbitrum.blockscout.com/
- Linea, Scroll, Polygon zkEVM, etc.

Blockscout has its own API (`/api`) and exposes a Model Context Protocol server at https://mcp.blockscout.com/mcp — see `references/agent-tooling.md`.

### Sourcify

https://sourcify.dev/ — open-source verification, no API key. Good fallback when Etherscan fails. Sourcify matches by metadata hash; "perfect match" requires the exact source the deployer compiled, "partial match" allows comment/whitespace differences.

```bash
forge verify-contract 0xAddr src/Vault.sol:Vault \
  --chain base --verifier sourcify --watch
```

### Tenderly

https://tenderly.co/ — debugger, simulator, fork testnets. Not a substitute for Etherscan but invaluable for "what did this tx do". Their `tenderly_simulateTransaction` and bundle simulator catch failures before signing.

### Chainlist

https://chainlist.org/ — community-maintained registry of EVM chain configs (chain id, currency, RPC URLs, explorers). Source the canonical chain id from here when you don't know it.

## Multi-chain explorer mapping

| Chain | Chain ID | Explorer | Verifier name in `forge verify-contract` |
|---|---|---|---|
| Mainnet | 1 | https://etherscan.io | etherscan (v2) |
| Sepolia | 11155111 | https://sepolia.etherscan.io | etherscan (v2) |
| Base | 8453 | https://basescan.org | etherscan (v2) |
| Base Sepolia | 84532 | https://sepolia.basescan.org | etherscan (v2) |
| Arbitrum One | 42161 | https://arbiscan.io | etherscan (v2) |
| Optimism | 10 | https://optimistic.etherscan.io | etherscan (v2) |
| Polygon | 137 | https://polygonscan.com | etherscan (v2) |
| zkSync Era | 324 | https://explorer.zksync.io | zksync (foundry-zksync) |
| Linea | 59144 | https://lineascan.build | etherscan (v2) |
| Scroll | 534352 | https://scrollscan.com | etherscan (v2) |

Chain IDs verified via Chainlist; verifier name verified via `forge verify-contract --help`. Verify both at https://chainlist.org/ and https://book.getfoundry.sh/reference/forge/forge-verify-contract.

## Verification commands

Etherscan v2 (most chains):

```bash
forge verify-contract 0xAddr src/Vault.sol:Vault \
  --chain base \
  --etherscan-api-key $ETHERSCAN_API_KEY \
  --constructor-args $(cast abi-encode "constructor(address)" 0xAsset) \
  --watch
```

Blockscout:

```bash
forge verify-contract 0xAddr src/Vault.sol:Vault \
  --chain optimism \
  --verifier blockscout \
  --verifier-url https://optimism.blockscout.com/api/ \
  --constructor-args $(cast abi-encode "constructor(address)" 0xAsset) \
  --watch
```

Sourcify (no key):

```bash
forge verify-contract 0xAddr src/Vault.sol:Vault \
  --chain base --verifier sourcify --watch
```

If verification fails:
1. Confirm the deployed runtime bytecode matches your local build:
   ```bash
   cast code 0xAddr --rpc-url base | head -c 200
   forge inspect src/Vault.sol:Vault deployedBytecode | head -c 200
   ```
2. Confirm `solc_version`, `optimizer_runs`, `evm_version`, `via_ir` match what you actually deployed with.
3. For CREATE2 deploys, constructor args still need to match; the deployer doesn't change verification.
4. For libraries, pass `--libraries src/Lib.sol:Lib:0xLibAddr`.

## RPC URL hygiene

Never bake API keys into client-side bundles unless the provider supports allowlisting by referrer. Pattern:

- Public RPC for read-only client UI (Llama, PublicNode) — accept rate limits
- Authenticated server-side proxy for writes and sensitive reads
- Provider's referrer/allowlist if you must expose a key (Alchemy and Infura both support this; verify configuration at each provider's dashboard)

Rotate keys quarterly; revoke compromised keys immediately. Most providers expose per-key usage analytics.

## Choosing a provider — decision tree

1. Just demoing? Llama / PublicNode / Ankr public — free, no key.
2. Single-chain production with steady reads? Alchemy or Infura free tier; upgrade as you grow.
3. Multi-chain production? Alchemy (broad coverage) or QuickNode (custom marketplace add-ons).
4. Need archive + traces? Alchemy paid, self-hosted Erigon, or Tenderly for occasional traces.
5. Need failover? viem `fallback([primary, dRPC, secondary])`.
6. Need indexing? Don't poll RPCs — use The Graph, Goldsky, Envio, Ponder. See `build/indexing` skill.

## What to read next

- `references/foundry-deep-dive.md` — `forge verify-contract`, `cast` against any RPC
- `references/anvil-and-forking.md` — when archive is required
- `references/agent-tooling.md` — Blockscout MCP and abi.ninja
- Chainlist: https://chainlist.org/
