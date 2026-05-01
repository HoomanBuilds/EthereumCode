# Agent Economy Cookbook: ERC-8004 + x402 in Practice

This file is the implementation playbook for autonomous agent commerce on Ethereum. Read when a founder or agent needs to actually build with ERC-8004 (identity), x402 (payments), or wire them together. The reader is an LLM building software — concrete addresses, code snippets, and decision tables only. No marketing language.

## Stack at a Glance

```
+--------------------------------------------------+
|  Agent (LLM + control loop)                      |
+--------------------------------------------------+
|  EIP-7702 delegation + session keys              |  <- Pectra (May 2025)
+--------------------------------------------------+
|  x402 client SDK (TypeScript / Python / Go)      |  <- Q1 2026
+--------------------------------------------------+
|  EIP-3009 transferWithAuthorization (USDC)       |  <- 2020+
+--------------------------------------------------+
|  ERC-8004 identity + reputation                  |  <- Jan 29, 2026
+--------------------------------------------------+
|  L2 settlement (Base, Arbitrum, Optimism)        |  <- Sub-cent post-Fusaka
+--------------------------------------------------+
|  Ethereum L1                                     |
+--------------------------------------------------+
```

Each layer is independent. You can adopt them piecemeal but the canonical agent-commerce loop uses all of them.

## ERC-8004: Onchain Agent Identity

**Deployed:** January 29, 2026 on Ethereum mainnet, with mirrors on 20+ chains.

**Mainnet contracts:**

| Contract | Address |
|---|---|
| IdentityRegistry | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| ReputationRegistry | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` |

These addresses are **the same on every supported chain** (CREATE2 with deterministic salt). Verify before using on a non-mainnet chain by reading the registry's `chainId()` view.

### Identity Registration

A registration ties an EOA (or smart account) to a service profile. The profile can include name, endpoint URL, capabilities, and a JSON metadata pointer (typically IPFS or HTTPS).

This interface is illustrative based on the EIP-8004 draft. Before deploying, verify against the canonical spec at https://eips.ethereum.org/EIPS/eip-8004 — struct field order and function names may differ in the production registry.

```solidity
interface IIdentityRegistry {
    struct Profile {
        address controller;     // who can update this entry
        string name;            // human-readable identifier
        string endpoint;        // HTTPS URL where the agent serves
        bytes32 capabilities;   // bitmask, see capability table
        string metadataURI;     // IPFS or HTTPS pointing to JSON
    }

    function register(Profile calldata p) external returns (uint256 agentId);
    function update(uint256 agentId, Profile calldata p) external;
    function deactivate(uint256 agentId) external;
    function profileOf(uint256 agentId) external view returns (Profile memory);
    function agentIdOf(address controller) external view returns (uint256);
}
```

A profile's `metadataURI` should resolve to a JSON document describing the agent's services in a machine-readable format (typically extending the OpenAPI spec or x402's manifest schema).

### Capability Bitmask

ERC-8004 reserves the lower 64 bits of the capability `bytes32` for standardized capabilities. Higher bits are app-specific.

| Bit | Capability |
|---|---|
| 0 | Accepts x402 payments |
| 1 | Provides oracle/data feeds |
| 2 | Acts as a marketplace seller |
| 3 | Acts as a marketplace buyer |
| 4 | Provides compute/inference |
| 5 | Provides storage |
| 6 | Holds delegated assets |
| 7 | Provides on-demand smart contract deployment |
| 8-63 | Reserved for future ERC amendments |

Filter discovery queries by capability bitmask to find agents offering a specific service.

### Reputation

Reputation is signed feedback recorded on-chain after an interaction.

```solidity
interface IReputationRegistry {
    struct Feedback {
        uint256 fromAgentId;
        uint256 toAgentId;
        uint8 rating;           // 1-5
        bytes32 dimension;      // e.g. keccak256("RELIABILITY")
        uint256 timestamp;
        bytes signature;        // EIP-712 from fromAgentId controller
    }

    function postFeedback(Feedback calldata f) external;
    function score(uint256 agentId, bytes32 dimension)
        external view returns (uint256 weighted, uint256 count);
}
```

The registry returns a stake-weighted score (recent feedback weighted more, feedback from high-rep agents weighted more). Treat this as a signal, not a guarantee. Always verify recent (<7 day) feedback exists; old reputation is brittle.

**Standard dimensions:**
- `keccak256("RELIABILITY")` — does the agent fulfill orders?
- `keccak256("ACCURACY")` — is the data/output correct?
- `keccak256("LATENCY")` — does it respond in promised time?
- `keccak256("PRICE")` — fair pricing relative to market?

### Registering and Reading from TypeScript

```typescript
import { createWalletClient, createPublicClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";

const IDENTITY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" as const;
const account = privateKeyToAccount(process.env.AGENT_KEY as `0x${string}`);
const wallet = createWalletClient({ account, chain: mainnet, transport: http() });

const abi = parseAbi([
  "function register((address controller,string name,string endpoint,bytes32 capabilities,string metadataURI)) returns (uint256)",
  "function profileOf(uint256) view returns ((address,string,string,bytes32,string))",
]);

const CAP_X402 = 1n;
const CAP_INFERENCE = 1n << 4n;

await wallet.writeContract({
  address: IDENTITY, abi, functionName: "register",
  args: [{
    controller: account.address,
    name: "weather-oracle-sf",
    endpoint: "https://api.weather-oracle.example/v1",
    capabilities: `0x${(CAP_X402 | CAP_INFERENCE).toString(16).padStart(64, "0")}` as `0x${string}`,
    metadataURI: "ipfs://QmYourManifestHashHere",
  }],
});
```

Registration cost: typically $0.50-2 in gas on L1, ~$0.005 on Base.

## x402: HTTP 402 Payment Required

**Status:** Production Q1 2026. SDKs in TypeScript, Python, Go.

**SDK packages:**

| Language | Package |
|---|---|
| TypeScript | `@x402/fetch` |
| Python | `x402` |
| Go | `github.com/coinbase/x402/go` |

### The Protocol Wire Format

Request without payment:

```http
GET /v1/forecast/SF HTTP/1.1
Host: api.weather-oracle.example
```

Server response:

```http
HTTP/1.1 402 Payment Required
Accept-Payment: usdc-base/0.05
Payment-Address: 0xMerchantAddress
Payment-Network: base
Payment-Asset: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
Payment-Nonce: 0xabc123def456...
Payment-Expires: 2026-05-01T12:34:56Z
Content-Type: application/json

{
  "amount": "0.05",
  "asset": "USDC",
  "network": "base",
  "manifest": "https://api.weather-oracle.example/.well-known/x402.json"
}
```

Client signs an EIP-3009 `transferWithAuthorization` and retries:

```http
GET /v1/forecast/SF HTTP/1.1
Host: api.weather-oracle.example
X-Payment: eyJ2IjoxYjI4ZDc...   <- base64-encoded signed authorization
```

Server validates signature, submits the authorization on-chain (or batches it), and serves the response:

```http
HTTP/1.1 200 OK
X-Payment-Receipt: 0xTxHash...
Content-Type: application/json

{ "forecast": { "temp_c": 18, "conditions": "fog" } }
```

### Client-Side TypeScript

```typescript
import { x402Fetch } from "@x402/fetch";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(process.env.AGENT_KEY as `0x${string}`);

const fetchWithPayments = x402Fetch({
  account,
  network: "base",
  maxPaymentPerRequest: "0.10",   // refuse anything over $0.10
  maxTotalSpend: "5.00",          // session-wide cap
});

const res = await fetchWithPayments("https://api.weather-oracle.example/v1/forecast/SF");
const forecast = await res.json();
```

The SDK handles:
- 402 detection and retry.
- EIP-3009 signing using the supplied account.
- Spend caps (always set them; an unbounded agent will drain a wallet to a malicious server).
- Receipt verification.

### Server-Side TypeScript

```typescript
import { x402Middleware } from "@x402/fetch/server";
import express from "express";

const app = express();

app.use("/v1", x402Middleware({
  network: "base",
  recipient: "0xMerchantAddress",
  pricing: {
    "/v1/forecast/:city": "0.05",
    "/v1/historical/:city": "0.50",
  },
  asset: "USDC",
}));

app.get("/v1/forecast/:city", (req, res) => {
  res.json({ forecast: getForecast(req.params.city) });
});
```

The middleware:
- Returns 402 on missing payment.
- Verifies the EIP-3009 signature against the request URL and amount.
- Submits the authorization on-chain (configurable: immediate, batched, or async).
- Caches valid payments per nonce to prevent replay.

### EIP-3009 Under the Hood

x402 doesn't invent payment rails — it uses EIP-3009 (`transferWithAuthorization`), supported by USDC since 2020. The signed authorization includes:

| Field | Description |
|---|---|
| `from` | Payer address (the agent) |
| `to` | Merchant address |
| `value` | Amount in token units (USDC = 6 decimals) |
| `validAfter` | Unix timestamp; auth invalid before this |
| `validBefore` | Unix timestamp; auth expires after this |
| `nonce` | 32-byte random; prevents replay |

The merchant submits this signed payload via USDC's `transferWithAuthorization` function. Gas is paid by the merchant, not the agent — the agent only signs.

This means **agents do not need ETH on the buyer side**. They only hold USDC. Operationally enormous.

### Common Pitfalls

| Pitfall | Why it matters | Fix |
|---|---|---|
| No spend cap on the client | One malicious server can drain wallet | Always set `maxPaymentPerRequest` and `maxTotalSpend` |
| Ignoring `Payment-Expires` | Late-submitted auths revert; user double-charged in retry | Reject auths within 30s of expiry |
| Reusing nonces | Replay-attack vector if merchant cache fails | Use cryptographically random nonces, never sequential |
| Not pinning to a specific chain | Cross-chain replay if merchant deployed same address on multiple chains | Include `chainId` in the EIP-3009 domain (USDC does this; verify) |

## EIP-7702: Smart EOAs for Agents

**Activated:** Pectra, May 7, 2025.

**What it gives agents:** the ability for an EOA to temporarily delegate its execution to a contract for one or more transactions, without ever migrating to a contract account.

### Use Case 1: Batched Operations

Without EIP-7702, an agent doing 5 actions submits 5 transactions, each with its own gas overhead and confirmation latency.

With EIP-7702, the agent signs one authorization to delegate to a `BatchExecutor` contract for one transaction:

```solidity
contract BatchExecutor {
    function execute(Call[] calldata calls) external {
        for (uint i = 0; i < calls.length; i++) {
            (bool ok,) = calls[i].target.call{value: calls[i].value}(calls[i].data);
            require(ok, "call failed");
        }
    }
}
```

The agent signs an EIP-7702 authorization with the `BatchExecutor` address, then sends one transaction containing the batch.

Gas savings: typically 30-60% vs N separate transactions.

### Use Case 2: Session Keys

The user's EOA delegates once to a `SessionKeyDelegate` contract that enforces: a specific session-key address, a `validUntil` timestamp, a `maxSpendUSDC` cap, and an allow-list of target contracts. The agent's short-lived session key signs subsequent operations. Even if the session key is stolen, damage is bounded by spend cap, time, and contract allow-list.

### Use Case 3: Sponsored Gas

Agent has USDC, no ETH. Delegate to a paymaster contract that pulls USDC, pays gas in ETH from a sponsor pool, and executes the agent's intended call. Collapses what previously required ERC-4337 infrastructure into a single EIP-7702 delegation.

## End-to-End: An Agent Buys Data

The canonical flow combining all the pieces:

```
1. Agent A wants weather data for SF.
2. Agent A queries ERC-8004 IdentityRegistry on Base for agents with capability bit 1
   (accepts x402) and bit 4 (compute/inference).
3. Registry returns 17 candidates. Agent A queries ReputationRegistry for each;
   filters to top 3 by RELIABILITY score.
4. Agent A picks weather-oracle-sf based on price (in metadata) and reputation.
5. Agent A: GET https://api.weather-oracle.example/v1/forecast/SF
6. Server: 402 Payment Required, asks for 0.05 USDC on Base.
7. Agent A signs EIP-3009 transferWithAuthorization. (Optionally via session key
   delegated through EIP-7702.)
8. Agent A retries with X-Payment header.
9. Server validates signature, submits authorization on Base (gas: ~$0.001).
10. Server responds 200 OK with forecast data.
11. Agent A optionally posts feedback to ReputationRegistry:
    "weather-oracle-sf, dimension RELIABILITY, rating 5".
```

Total wall-clock: typically 2-5 seconds (one onchain submission on Base ~2s).
Total cost: $0.05 service + $0.001 gas = $0.051.
Trust assumption: zero shared identity, zero accounts, zero API keys.

## Reference: Critical Addresses

| Contract | Network | Address |
|---|---|---|
| ERC-8004 IdentityRegistry | Mainnet, Base, Arbitrum, Optimism, +17 | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| ERC-8004 ReputationRegistry | Mainnet, Base, Arbitrum, Optimism, +17 | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` |
| USDC | Mainnet | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` |
| USDC | Base | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| USDC | Arbitrum | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` |
| USDC | Optimism | `0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85` |

Verify via Circle's official addresses page before sending real value.

## Resources

- ERC-8004 spec: https://eips.ethereum.org/EIPS/eip-8004
- ERC-8004 portal: https://www.8004.org
- x402 spec: https://www.x402.org
- x402 reference impls: https://github.com/coinbase/x402
- EIP-3009: https://eips.ethereum.org/EIPS/eip-3009
- EIP-7702: https://eips.ethereum.org/EIPS/eip-7702
- Blockscout MCP (for agent queries against block data): https://mcp.blockscout.com/mcp

## When To Reach For This Stack

Use ERC-8004 + x402 when:
- The product involves machine-to-machine commerce.
- Service consumers and providers don't have a pre-existing relationship.
- Per-call values are small ($0.001-$10) and frequent.
- Settlement must be cryptographic (no chargebacks, no account freezes).

Don't use it when:
- Counterparties have a stable relationship and are willing to maintain accounts/API keys (Stripe is cheaper and faster).
- Per-call values are large enough to justify human review (>$1000).
- The settlement asset is not USDC/USDT (these are the only well-supported tokens for x402 today).
- Latency requirements are sub-second (onchain confirmation adds 1-2s on L2s).

For everything in between, this stack is the cheapest, most permissionless, most composable option in 2026.
