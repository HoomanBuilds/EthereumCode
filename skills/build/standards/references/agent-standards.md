# Agent Standards Cookbook

ERC-8004 (onchain agent identity + reputation) and x402 (HTTP 402 payments) at depth, for builders integrating agent commerce into production. ERC-8004 was deployed on Ethereum mainnet on January 29, 2026. x402 SDKs are young — pin versions and verify against https://eips.ethereum.org/EIPS/eip-8004 and https://github.com/coinbase/x402.

## ERC-8004 IdentityRegistry

ERC-8004 deploys at the same checksummed address on 20+ chains:

| Registry            | Address                                        |
| ------------------- | ---------------------------------------------- |
| IdentityRegistry    | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`   |
| ReputationRegistry  | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`   |

ValidationRegistry addresses vary per validator vendor and trust model — see the spec's appendix.

### Minimal ABI (verify against https://eips.ethereum.org/EIPS/eip-8004)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IIdentityRegistry {
    event Registered(uint256 indexed agentId, address indexed owner, string agentURI);
    event Updated(uint256 indexed agentId, string newURI);

    /// @notice Mint a new agent identity NFT and bind it to an off-chain registration JSON.
    /// @param agentURI ipfs://, https://, or ENS-resolved URL of the registration JSON.
    /// @param metadata Optional ABI-encoded metadata (often empty bytes).
    /// @return agentId The minted ERC-721 tokenId, globally unique on this chain.
    function register(string calldata agentURI, bytes calldata metadata) external returns (uint256 agentId);

    /// @notice Replace the agentURI / metadata for an agent you own.
    function update(uint256 agentId, string calldata newURI, bytes calldata newMetadata) external;

    /// @notice ERC-721 ownership semantics — owner of `agentId` controls the registration.
    function ownerOf(uint256 agentId) external view returns (address);

    /// @notice Standard ERC-721 transfer transfers control of the agent identity.
    function safeTransferFrom(address from, address to, uint256 agentId) external;

    function tokenURI(uint256 agentId) external view returns (string memory);
}
```

Identity is an ERC-721, so:
- The owner can transfer the agent to a new wallet.
- Marketplaces can list agent identities for sale.
- Multi-sigs can hold agents (treasury-owned services).

### agentURI Resolution

The string in `agentURI` is interpreted by clients in priority order:

| Prefix       | Resolution                                                              |
| ------------ | ----------------------------------------------------------------------- |
| `ipfs://`    | Fetch via any IPFS gateway (cloudflare-ipfs.com, ipfs.io, dweb.link).   |
| `ar://`      | Arweave gateway (arweave.net).                                          |
| `https://`   | Standard HTTPS GET. Server SHOULD return `application/json`.             |
| ENS name     | Resolve `contenthash` text record to IPFS/Arweave/HTTPS.                |

The fetched JSON conforms to the ERC-8004 registration shape — see the inlined example below. Clients SHOULD fail closed if the JSON's `type` field doesn't match `https://eips.ethereum.org/EIPS/eip-8004#registration-v1`.

```json
{
  "type": "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  "name": "WeatherBot",
  "description": "Provides real-time weather data via x402 micropayments",
  "services": [
    { "name": "A2A", "endpoint": "https://weather.example.com/.well-known/agent-card.json", "version": "0.3.0" }
  ],
  "x402Support": true,
  "active": true,
  "supportedTrust": ["reputation"]
}
```

### Domain Verification (.well-known)

To prove the domain that backs an agent endpoint really controls the onchain identity, place this file at the agent's domain root:

```jsonc
// https://weather.example.com/.well-known/agent-registration.json
{
  "agentId": 42,
  "agentRegistry": "eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
  "owner": "0xYourWalletAddress"
}
```

Clients SHOULD:
1. Resolve the agent's `agentURI` and read its endpoints.
2. For each endpoint, fetch `<endpoint-domain>/.well-known/agent-registration.json`.
3. Verify the file's `agentId`, `agentRegistry`, and `owner` match what's onchain.
4. Treat an endpoint that fails this check as untrusted (don't pay it, don't follow it).

This pins the off-chain ↔ on-chain link and prevents endpoint hijack.

## ERC-8004 ReputationRegistry

```solidity
interface IReputationRegistry {
    event FeedbackGiven(
        uint256 indexed agentId,
        address indexed client,
        int128 value,
        uint8 valueDecimals,
        string tag1,
        string tag2,
        bytes32 dataHash
    );

    /// @notice Post a signed rating about an agent.
    /// @param agentId The ERC-8004 agent being rated.
    /// @param value Signed fixed-point rating; interpret as `value / 10**valueDecimals`.
    /// @param valueDecimals 0..18.
    /// @param tag1 First-axis tag (e.g. "uptime", "quality").
    /// @param tag2 Second-axis tag (e.g. "30days", "weather").
    /// @param endpoint The endpoint URI the rating refers to (if multi-endpoint agent).
    /// @param ipfsHash Optional CID with detailed rationale.
    /// @param dataHash keccak256 of the off-chain interaction record.
    function giveFeedback(
        uint256 agentId,
        int128 value,
        uint8 valueDecimals,
        string calldata tag1,
        string calldata tag2,
        string calldata endpoint,
        string calldata ipfsHash,
        bytes32 dataHash
    ) external;

    /// @notice Aggregated summary across a set of trusted clients only.
    /// @param trustedClients Whitelist of client addresses whose feedback counts.
    /// @return count Number of feedbacks aggregated.
    /// @return value Aggregated value (mean by default — verify against canonical spec).
    /// @return decimals Decimals applied to `value`.
    function getSummary(
        uint256 agentId,
        address[] calldata trustedClients,
        string calldata tag1,
        string calldata tag2
    ) external view returns (uint64 count, int128 value, uint8 decimals);
}
```

### Reading: examples

| Metric          | `value` | `decimals` | Reads as |
| --------------- | ------- | ---------- | -------- |
| Quality 87/100  | 87      | 0          | 87       |
| Uptime 99.77%   | 9977    | 2          | 99.77    |
| Latency 1.5ms   | 15      | 1          | 1.5      |
| Penalty -42     | -42     | 0          | -42      |

### Anti-Sybil via Trusted-Client Filtering

Anyone can post feedback. Without filtering, an agent could spin up 1000 wallets and self-rate. The mitigation is *consumer-side*: callers of `getSummary` pass a `trustedClients[]` whitelist that they curate. Common policies:

- Whitelist agents with >= N successful x402 payments to >= K distinct services.
- Whitelist accounts older than 90 days.
- Whitelist a known set of "judge" agents run by reputable parties.
- Use The Graph subgraph to compute set membership offchain, pass the result on each call.

The registry stays neutral; reputation aggregation is opinionated by the consumer.

### Multi-Dimensional Aggregation

`tag1` and `tag2` let you slice. A single agent can carry many ratings:

```text
agentId 42:
  ("uptime",  "30days") -> 99.7%
  ("quality", "weather") -> 92/100
  ("latency", "p99")     -> 180ms
```

A consumer queries each axis independently. Filtering by tag in `getSummary` is the canonical way to compose dimensions.

## ValidationRegistry

The third leg of ERC-8004 — independent verification of agent work output. Three trust models:

| Model              | Mechanism                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------ |
| Crypto-economic    | Validator stakes on EigenLayer (or similar AVS); slashed if misvalidates.                  |
| zkML               | Validator runs the model and produces a zero-knowledge proof of correct execution.         |
| TEE attestation    | Validator runs in a trusted enclave (SGX, AWS Nitro) and posts a signed attestation report.|

Validators score on a 0-100 scale. The exact registry interface and validator vendors evolve — verify against https://github.com/erc-8004/erc-8004-contracts and the validator's own docs (EigenLayer AVS registry, etc.).

## x402 Wire Format

x402 transports payment metadata in HTTP headers. All headers are JSON-encoded.

### `PAYMENT-REQUIRED` (server -> client, in 402 response)

```json
{
  "version": "1",
  "accepts": [
    {
      "scheme": "exact",
      "network": "eip155:8453",
      "token": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "amount": "100000",
      "to": "0xResourceServerWallet",
      "deadlineWindow": 300
    }
  ],
  "facilitator": "https://facilitator.x402.org",
  "_facilitatorNote": "example only — get the live Coinbase facilitator URL from https://www.x402.org",
  "description": "Current weather data"
}
```

Multiple entries in `accepts` let the client pick its preferred network. `deadlineWindow` is seconds the server will honor; client computes `validBefore = now + deadlineWindow` when signing.

### `PAYMENT-SIGNATURE` (client -> server, on retry)

```json
{
  "scheme": "exact",
  "network": "eip155:8453",
  "token": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "from": "0xClient",
  "to": "0xResourceServerWallet",
  "amount": "100000",
  "validAfter": 0,
  "validBefore": 1735000000,
  "nonce": "0x...32-bytes...",
  "signature": "0x...65-bytes..."
}
```

The `signature` is the EIP-3009 `transferWithAuthorization` typed-data signature.

### `PAYMENT-RESPONSE` (server -> client, in 200)

```json
{
  "txHash": "0xabc...",
  "network": "eip155:8453",
  "settledAt": 1735000123,
  "facilitator": "https://facilitator.x402.org"
}
```

Client can verify the tx hash against an explorer or its own RPC if it doesn't trust the server.

## EIP-3009 Deep Dive

EIP-3009 lets a token holder sign an authorization off-chain that *anyone* can submit on-chain to move the holder's funds. USDC implements it on Ethereum, Base, Arbitrum, Optimism, Polygon, Avalanche, and most major chains. Verify each chain's USDC implementation against the official Centre repo.

### Function Signatures

```solidity
function transferWithAuthorization(address from, address to, uint256 value,
    uint256 validAfter, uint256 validBefore, bytes32 nonce,
    uint8 v, bytes32 r, bytes32 s) external;

function receiveWithAuthorization(address from, address to, uint256 value,
    uint256 validAfter, uint256 validBefore, bytes32 nonce,
    uint8 v, bytes32 r, bytes32 s) external; // adds require(msg.sender == to)

function cancelAuthorization(address authorizer, bytes32 nonce,
    uint8 v, bytes32 r, bytes32 s) external;
```

`receiveWithAuthorization` only the recipient can submit — use to gate redemption.

### EIP-712 Domain & TypeHash

```solidity
DOMAIN_SEPARATOR = keccak256(abi.encode(
    keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
    keccak256(bytes("USD Coin")),    // USDC's name
    keccak256(bytes("2")),           // USDC's version on Base/most chains; verify
    block.chainid,
    USDC_ADDRESS
));

TRANSFER_WITH_AUTHORIZATION_TYPEHASH = keccak256(
    "TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)"
);
```

The exact `name` and `version` strings *vary by chain* — bridged USDC is sometimes `"USDC"` v1, native USDC is `"USD Coin"` v2. Read `name()` and `version()` from the token (or its `eip712Domain()`) instead of hard-coding.

### Nonce Semantics

The `nonce` is a *32-byte arbitrary value*, not a sequential counter. Clients pick any unique value; the contract tracks `(authorizer, nonce) -> used` and reverts on reuse. This means:

- No order dependency — out-of-order submission is fine.
- A single signer can have many open authorizations in flight simultaneously.
- Nonces should be cryptographically random to prevent collision (use `crypto.randomBytes(32)` or viem's `generatePrivateKey()` style helpers).
- A canceled authorization (via `cancelAuthorization`) marks the nonce used.

### Replay Protection

Achieved by the `(authorizer, nonce)` mapping plus the `validBefore` deadline. EIP-712 leaves `chainId` optional in the domain (per EIP-5267's fields bitmap), but USDC's domain DOES include it, so cross-chain replay is blocked for USDC. Verify per token.

## Client: Signing an EIP-3009 Authorization with viem v2

```typescript
// SPDX-License-Identifier: MIT
import { createWalletClient, http, parseUnits } from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { base } from "viem/chains";

const account = privateKeyToAccount(process.env.CLIENT_PK as `0x${string}`);
const wallet  = createWalletClient({ account, chain: base, transport: http() });

const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;

// 1. Random 32-byte nonce.
import { toHex } from "viem";
const nonce = toHex(crypto.getRandomValues(new Uint8Array(32))) as `0x${string}`;

// 2. Build the typed data.
const validAfter  = 0n;
const validBefore = BigInt(Math.floor(Date.now() / 1000) + 300);
const value       = parseUnits("0.10", 6); // 0.10 USDC, 6 decimals

const signature = await wallet.signTypedData({
  domain: {
    name: "USD Coin",         // verify with usdc.read.eip712Domain()
    version: "2",             // ditto
    chainId: base.id,
    verifyingContract: USDC,
  },
  types: {
    TransferWithAuthorization: [
      { name: "from",        type: "address" },
      { name: "to",          type: "address" },
      { name: "value",       type: "uint256" },
      { name: "validAfter",  type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce",       type: "bytes32" },
    ],
  },
  primaryType: "TransferWithAuthorization",
  message: {
    from: account.address,
    to: "0xResourceServerWallet",
    value,
    validAfter,
    validBefore,
    nonce,
  },
});

// 3. Send to the resource server in PAYMENT-SIGNATURE header.
const response = await fetch("https://weather.example.com/api/weather", {
  headers: {
    "PAYMENT-SIGNATURE": JSON.stringify({
      scheme: "exact",
      network: "eip155:8453",
      token: USDC,
      from: account.address,
      to: "0xResourceServerWallet",
      amount: value.toString(),
      validAfter: validAfter.toString(),
      validBefore: validBefore.toString(),
      nonce,
      signature,
    }),
  },
});
```

For real apps, use `@x402/fetch` which handles the 402 retry loop automatically. The above is the manual fallback for debugging or when running outside the SDK.

## Server: Verifying an EIP-3009 Authorization with viem

```typescript
import { recoverTypedDataAddress, isAddressEqual, type Hex } from "viem";

// ILLUSTRATIVE — production verifiers MUST resolve name/version via eip712Domain() at startup, see permit-and-meta-tx.md.
const USDC_DOMAIN = { name: "USD Coin", version: "2", chainId: 8453,
  verifyingContract: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Hex };

const TRANSFER_TYPES = { TransferWithAuthorization: [
  { name: "from", type: "address" }, { name: "to", type: "address" },
  { name: "value", type: "uint256" }, { name: "validAfter", type: "uint256" },
  { name: "validBefore", type: "uint256" }, { name: "nonce", type: "bytes32" },
]} as const;

export async function verifyPayment(sig: any, expectedRecipient: Hex, expectedAmount: bigint) {
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (now < BigInt(sig.validAfter))  throw new Error("not yet valid");
  if (now >= BigInt(sig.validBefore)) throw new Error("expired");
  if (!isAddressEqual(sig.to, expectedRecipient)) throw new Error("wrong recipient");
  if (BigInt(sig.amount) < expectedAmount) throw new Error("insufficient amount");

  const recovered = await recoverTypedDataAddress({
    domain: USDC_DOMAIN, types: TRANSFER_TYPES,
    primaryType: "TransferWithAuthorization",
    message: { from: sig.from, to: sig.to, value: BigInt(sig.amount),
      validAfter: BigInt(sig.validAfter), validBefore: BigInt(sig.validBefore),
      nonce: sig.nonce },
    signature: sig.signature,
  });
  if (!isAddressEqual(recovered, sig.from)) throw new Error("bad signature");
  // Then: balance check via RPC, nonce-uniqueness check, settle via /settle endpoint.
}
```

For production, hand off verify+settle to a facilitator — the above is what it runs internally.

## Facilitator Architecture

```
Client ─signs─▶ Resource Server ──/verify──▶ Facilitator ──RPC──▶ Chain
                                  ◀─ ok / fail ─┤
                Resource Server ──/settle──▶ Facilitator ──tx──▶ Chain
                                  ◀─ tx hash ───┤
```

| Endpoint   | Job                                                                                          |
| ---------- | -------------------------------------------------------------------------------------------- |
| `/verify`  | Recover signer, check window, balance, nonce-not-used, return `{ valid: true, reason? }`.    |
| `/settle`  | Build and broadcast `transferWithAuthorization`, manage gas, wait for confirmation, return hash. |

### Failure Modes

| Failure              | Where      | Behavior                                              |
| -------------------- | ---------- | ----------------------------------------------------- |
| Signature reuse      | `/verify`  | Return 400 `nonce_used` or `bad_signature`.           |
| Insufficient balance | `/verify`  | Return 400 `insufficient_funds`.                      |
| Expired deadline     | `/verify`  | Return 400 `expired`.                                 |
| Wrong recipient      | `/verify`  | Return 400 `wrong_recipient`.                         |
| Underpriced gas      | `/settle`  | Retry with bumped fees, configurable max.             |
| Token paused/blocked | `/settle`  | Return 502 `chain_revert`.                            |
| Wrong token domain   | `/verify`  | Catch on `eip712Domain()` mismatch.                   |

### Run Your Own vs Use Coinbase's

| Axis           | Coinbase                  | Self-hosted               |
| -------------- | ------------------------- | ------------------------- |
| Speed to ship  | Minutes                   | Days (RPC + gas + monitor) |
| Trust          | Their uptime + non-censor | Self-sovereign            |
| Cost           | Their fee + gas           | Just gas                  |
| Censorship     | They can refuse           | You decide                |
| Multi-chain    | Their list                | Whatever you connect      |

Default to Coinbase's for early stages; self-host once volume justifies the engineering.

## Cookbook: Pay-Per-LLM-Token with `upto`

LLM cost depends on output token count, unknown until generation completes. The `upto` scheme makes this work:

```text
1. Client GETs /chat?prompt=...
2. Server responds 402 with PAYMENT-REQUIRED:
     scheme: "upto"
     amount: "10000000"          // up to $10 USDC max
     unit: "tokens"
     pricePerUnit: "1000"        // $0.001 per output token
3. Client signs an EIP-3009 authorization for the MAX (10 USDC).
4. Server runs the model, counts output tokens (say 4321).
5. Server settles only `pricePerUnit * count` = 4_321_000 micro-USDC = $4.321.
6. Server returns 200 with stream + PAYMENT-RESPONSE listing actual settled amount.
```

Implementation notes:
- The signed authorization is for the max; the on-chain `transferWithAuthorization` is called with a `value` <= max. (USDC's EIP-3009 fixes `value` at sign time, so `upto` schemes need either two signatures or a wrapper contract that pulls the partial amount and refunds the difference. The x402 spec details this — verify against https://github.com/coinbase/x402.)
- Client SHOULD verify the actual settled amount against its expected token count from the response.

## Cookbook: Reputation-Gated API

```typescript
import { createPublicClient, http, type Hex } from "viem";
import { base } from "viem/chains";

const REPUTATION = "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63" as const;
const client = createPublicClient({ chain: base, transport: http() });

async function isReputable(agentId: bigint): Promise<boolean> {
  const trustedClients = ["0xJudgeA", "0xJudgeB"] as Hex[];
  const [count, value, decimals] = await client.readContract({
    address: REPUTATION, abi: repAbi, functionName: "getSummary",
    args: [agentId, trustedClients, "quality", "30days"],
  });
  if (count < 5n) return false;
  return BigInt(value) >= 80n * 10n ** BigInt(decimals);
}
```

Pair with x402 middleware: reject `PAYMENT-SIGNATURE` from clients whose `from` resolves to an agent that doesn't pass `isReputable`. This builds a reputation-gated marketplace where agents earn access by performing.

## Pre-Flight Checklist

- [ ] Pin the chain explicitly (chainId in domain) for every sig + verify.
- [ ] Read `eip712Domain()` from the token at startup; do not hard-code `name`/`version`.
- [ ] Use random 32-byte nonces; persist used nonces if you self-facilitate.
- [ ] `validBefore` set to now + small window (5 min default); reject longer-lived sigs at the server.
- [ ] Domain verification (`.well-known/agent-registration.json`) on every endpoint you call.
- [ ] Log txHashes returned by facilitator; reconcile against your accounting nightly.
- [ ] Reputation queries scope to a curated `trustedClients[]` — never trust raw aggregate.
- [ ] x402 SDK version pinned in `package.json`; the SDK is young (Q1 2026) and APIs may shift.
