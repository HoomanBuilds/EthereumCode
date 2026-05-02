# Agent Tooling for Ethereum

This is the playbook for letting an LLM agent read, write, and pay on Ethereum. Three primitives: MCP servers (structured tool access), abi.ninja (zero-config contract UI), and x402 (HTTP-native payments). Pinning down package names and endpoints — verify at each project's repo before relying on production behavior.

## Mental model

```
Agent (Claude / Cursor / Cline / custom)
   │
   ├── MCP servers ──── Blockscout MCP   → on-chain reads
   │                ├── eth-mcp / custom → tx submission, contract reads
   │                └── x402 facilitator → payments
   │
   ├── HTTP clients ─── x402-fetch       → 402-aware fetch
   │
   └── Browser automation ─ abi.ninja    → exploratory contract calls
```

The pattern: agents discover capabilities via MCP, perform reads through structured tools, and execute writes/payments through signed transactions or x402 paywalled HTTP.

## Blockscout MCP

URL: https://mcp.blockscout.com/mcp (verify availability and exact tool list at https://github.com/blockscout/mcp-server).

What it gives an agent (representative tool set; the canonical list lives in the repo):

- Address introspection: balance, transactions, token holdings, contract source
- Transaction details: traces, events, status
- Token info: ERC-20/721/1155 metadata, holders, transfers
- Multi-chain: many Blockscout-instrumented chains share the same MCP schema
- Address tagging from Blockscout's directory (CEXes, contracts, ENS)

Setup in Claude Desktop / Claude Code (canonical config keys at https://docs.anthropic.com/en/docs/claude-code/mcp):

```jsonc
// Verify the exact key name (`type` vs `transport`) for HTTP MCP transports
// at https://docs.anthropic.com/en/docs/claude-code/mcp — current Claude Code
// uses `"type": "http"`; older configs may use `"transport": "http"`.
{
  "mcpServers": {
    "blockscout": {
      "type": "http",
      "url": "https://mcp.blockscout.com/mcp"
    }
  }
}
```

Setup in Cursor / Cline / Continue: each editor exposes MCP differently — verify at the editor's docs:

- Cursor: https://docs.cursor.com/context/model-context-protocol
- Cline: https://github.com/cline/cline (look for MCP servers section)
- Continue: https://docs.continue.dev/

Agent prompt example:

> "What ERC-20 tokens does 0xVitalik hold on Base, and which had the largest inflow in the last 7 days?"

The agent calls Blockscout MCP tools, composes results, returns an answer. No scraping.

## Building your own MCP server

Wrap a contract or service for agent consumption. Reference: https://modelcontextprotocol.io/

Minimal Node example (verify SDK at https://github.com/modelcontextprotocol/typescript-sdk):

```ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { erc20Abi } from "viem";

const client = createPublicClient({ chain: base, transport: http(process.env.RPC) });

const server = new Server(
  { name: "vault-tools", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{
    name: "vault_balance",
    description: "Get a user's Vault share balance",
    inputSchema: {
      type: "object",
      properties: { user: { type: "string", pattern: "^0x[0-9a-fA-F]{40}$" } },
      required: ["user"],
    },
  }],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  if (req.params.name === "vault_balance") {
    const user = req.params.arguments.user as `0x${string}`;
    const bal = await client.readContract({
      address: process.env.VAULT as `0x${string}`,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [user],
    });
    return { content: [{ type: "text", text: bal.toString() }] };
  }
  throw new Error("unknown tool");
});

await server.connect(new StdioServerTransport());
```

Run as `node index.js`; register in your agent's MCP config with `command: "node"` and `args: [...]`.

When wrapping a contract, expose:
- Read functions as MCP tools with strict input schemas (regex on addresses, integer ranges).
- Write functions only if the agent should be able to sign — and gate them with explicit confirmations.
- Helpful derived tools: "summarize position", "list active alerts", etc. Agents do better with intent-shaped tools than with raw method-shaped ones.

## abi.ninja

https://abi.ninja — paste a verified contract address, get a UI to call any function. Multi-chain. Zero setup. Useful for:

- Manual contract exploration during agent design
- Walking a user (or yourself) through an unfamiliar protocol's surface
- Generating example calls to feed an agent

For agents driving a browser, abi.ninja URLs follow the pattern:

```
https://abi.ninja/<address>/<chainId>
```

Verify URL pattern at https://abi.ninja. If the contract is not verified on Etherscan or Sourcify, abi.ninja cannot resolve it; deploy with `forge verify-contract --watch` to make this work.

## x402 — HTTP 402 payments for agents

https://www.x402.org and https://github.com/coinbase/x402.

The flow:

```
GET /resource
  ↓
402 Payment Required + paymentRequirements (token, amount, network)
  ↓
client signs EIP-3009 transferWithAuthorization
  ↓
GET /resource  (with PAYMENT-SIGNATURE header)
  ↓
server (or facilitator) verifies + settles
  ↓
200 OK + resource
```

This means agents can pay for API calls without API keys, subscriptions, or invoicing.

### Server (TypeScript / Express)

Verify package names and current shape at https://github.com/coinbase/x402:

```ts
import express from "express";
import { paymentMiddleware } from "@x402/express";

const app = express();

const config = {
  "GET /api/forecast": {
    accepts: [{
      network: "eip155:8453",
      token:   "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
      amount:  "500000",                                       // $0.50 (USDC has 6 decimals)
    }],
    description: "7-day forecast",
  },
};

app.use(paymentMiddleware(config));
app.get("/api/forecast", (req, res) => res.json({ days: [...] }));
app.listen(3000);
```

The middleware emits `402` with payment requirements when no signature is presented; verifies and settles when one is.

### Client (TypeScript)

```ts
import { x402Fetch } from "@x402/fetch";
import { createWallet } from "@x402/evm";

const wallet = createWallet(process.env.AGENT_PK);

const r = await x402Fetch("https://api.example.com/api/forecast", {
  wallet,
  preferredNetwork: "eip155:8453",
});
const data = await r.json();
```

`x402Fetch` is a drop-in `fetch` replacement that handles the 402 retry. Works with any agent that can issue HTTP requests.

### Python

```bash
pip install x402
```

```python
from x402 import Client
client = Client(private_key=os.environ["AGENT_PK"], network="eip155:8453")
response = client.fetch("https://api.example.com/api/forecast")
```

Verify package name at https://pypi.org/project/x402/ and https://github.com/coinbase/x402.

### Go

```bash
go get github.com/coinbase/x402/go
```

Verify import path at https://github.com/coinbase/x402.

### Schemes

- **`exact`** — fixed price known up front. Most common.
- **`upto`** — pay up to N, server settles for actual usage. Required for metered services (LLM tokens, GPU seconds, queries returned). Note: stock USDC EIP-3009 fixes the value at sign time, so `upto` requires either a wrapper contract or a two-signature flow. Verify scheme support per facilitator.

### Facilitators

The facilitator is the optional server that handles signature verification and settlement, so resource servers don't need an RPC connection or gas. Coinbase runs a public facilitator; anyone can run their own. Facilitator URL is part of the middleware config. Verify the public facilitator at https://github.com/coinbase/x402.

## Integrating x402 + ERC-8004

Agents combine ERC-8004 identity/reputation with x402 payments to transact autonomously without API keys:

```
1. Discover    Agent queries ERC-8004 IdentityRegistry on Base
2. Trust       Agent reads ReputationRegistry (filter by uptime/quality)
3. Call        HTTP GET to advertised endpoint
4. 402         Server returns payment requirements
5. Pay         Agent signs EIP-3009, retries with PAYMENT-SIGNATURE
6. Receive     200 OK + data
7. Rate        Agent posts feedback to ReputationRegistry
```

Contracts (verify against https://github.com/erc-8004/erc-8004-contracts):

- IdentityRegistry: `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
- ReputationRegistry: `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`

Both deployed at the same addresses on 20+ chains. See `build/standards` skill for full ABIs and EIP-712 verification code.

## Tool discovery pattern for agents

When an agent needs to "do X on Ethereum":

1. **Read state** → Blockscout MCP, custom MCP wrapping the protocol, viem from a Node tool.
2. **Find a contract** → abi.ninja URL, Etherscan v2 API, MCP `address_info`.
3. **Find a service** → ERC-8004 IdentityRegistry query, then ReputationRegistry filter.
4. **Pay** → x402-fetch (no key) or signed EIP-3009 directly.
5. **Submit a tx** → walletClient.writeContract via viem; never expose raw private keys to the agent's reasoning context (the agent should call a tool that signs internally).
6. **Verify** → publicClient.waitForTransactionReceipt, then read the resulting state.

Bad pattern: dumping a private key into the agent prompt. Good pattern: an MCP tool `signAndSend(to, data, value)` that signs server-side with a key the agent never sees.

## Sandboxing

Production agents should:

- Run signing keys in HSMs or signers (Turnkey, Privy, Coinbase Smart Wallet, Safe with session keys, custom KMS-backed signers).
- Cap per-tx and per-day spend at the signing layer, not in the agent prompt.
- Use ERC-4337 session keys or EIP-7702 delegations to express scoped policies on-chain (e.g. "this agent can only call `swap` on this router with up to N USDC/day").
- Log every tool call. Agents fabricate; only chain state is authoritative.

See `build/wallets` and `build/orchestration` skills for the signer-side details.

## Common pitfalls

- **MCP servers without input schemas** let agents pass garbage; the model retries with subtly-different garbage. Tighten schemas with patterns and bounds.
- **HTTP MCP servers** need TLS in production (the agent's runtime almost always blocks plain HTTP for remote MCPs).
- **Free RPCs in MCP backends** rate-limit hard; cache aggressively and use a paid provider for production.
- **x402 + L2 timing**: 402 settlement happens on L2; some facilitators wait for finality. Set client timeouts generously (30s+).
- **Facilitator trust**: a facilitator that misbehaves can drop payments. For high-value flows, verify settlement on-chain after each call.
- **Cross-chain payments**: x402 currently expects the resource server and the payment to be on the same chain. Cross-chain settlement (LayerZero, CCIP, Hyperlane) is a separate protocol layer.

## What to read next

- `references/viem-and-wagmi.md` — viem APIs the MCP server uses
- `references/rpc-and-explorers.md` — provider tradeoffs for MCP backends
- `build/standards` skill — ERC-8004 + x402 protocol details
- MCP spec: https://modelcontextprotocol.io/
- x402 docs: https://www.x402.org
- Blockscout MCP: https://github.com/blockscout/mcp-server
