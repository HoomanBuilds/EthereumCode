# viem and wagmi

viem v2 is the default TypeScript Ethereum client in 2026. wagmi v2 is the React layer on top. Both are tree-shakeable, type-safe by default, and replace ethers.js for new code. Verify package versions at https://viem.sh/ and https://wagmi.sh/.

## Install

```bash
npm install viem                # v2.x
npm install wagmi @tanstack/react-query   # wagmi v2 requires react-query v5
```

Optional connectors:

```bash
npm install @rainbow-me/rainbowkit
npm install connectkit
npm install @web3modal/wagmi    # WalletConnect / Reown
```

Pin majors in `package.json` — viem and wagmi ship breaking changes between minors occasionally.

## viem clients

Three client types:

```ts
import { createPublicClient, createWalletClient, createTestClient, http, webSocket } from "viem";
import { mainnet, base, arbitrum } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

// Read-only: eth_call, eth_getLogs, eth_chainId, ...
export const publicClient = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_RPC_URL),
  // multicall batching across same-block reads
  batch: { multicall: { batchSize: 1024, wait: 16 } },
});

// Wallet: eth_sendTransaction, signTypedData, ...
const account = privateKeyToAccount(`0x${process.env.PK}`);
export const walletClient = createWalletClient({
  account,
  chain: base,
  transport: http(process.env.BASE_RPC_URL),
});

// Test: anvil/hardhat namespaces
export const testClient = createTestClient({
  chain: base,
  mode: "anvil",
  transport: http("http://localhost:8545"),
});
```

Transport choice:
- `http(url)` — standard JSON-RPC; supports `batch: { batchSize, wait }` for `eth_call` batching.
- `webSocket(url)` — required for `watch*` event/log subscriptions without polling fallback.
- `fallback([t1, t2])` — automatic failover with health checks.
- `custom(provider)` — bring your own (EIP-1193, MetaMask, Frame).

Multi-transport with failover:

```ts
import { fallback, http } from "viem";

const transport = fallback([
  http(process.env.PRIMARY_RPC),
  http(process.env.SECONDARY_RPC),
], { rank: false, retryCount: 3 });
```

## Type-safe ABIs

Use `as const` so viem can infer return and arg types:

```ts
import { parseAbi } from "viem";

export const erc20Abi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
] as const);
```

Or import a JSON ABI directly with `as const` — TypeScript needs the literal type:

```ts
import vaultAbi from "./Vault.abi.json" with { type: "json" };
const abi = vaultAbi as const;
```

`with { type: "json" }` is the current TC39 import attributes syntax (Node 22+, TypeScript 5.3+). The older `assert { type: "json" }` is deprecated.

For a one-shot ABI from a verified contract:

```bash
cast interface 0xVerifiedAddr --rpc-url base > Vault.sol
# or pull JSON ABI:
cast interface 0xVerifiedAddr --rpc-url base --json > Vault.abi.json
```

## Read calls

```ts
import { erc20Abi } from "./abi";

const balance = await publicClient.readContract({
  address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  abi: erc20Abi,
  functionName: "balanceOf",
  args: ["0xWallet"],
});
// balance: bigint
```

Multicall (batched in one RPC call):

```ts
const [bal, sym, dec] = await publicClient.multicall({
  contracts: [
    { address: token, abi: erc20Abi, functionName: "balanceOf", args: [user] },
    { address: token, abi: erc20Abi, functionName: "symbol" },
    { address: token, abi: erc20Abi, functionName: "decimals" },
  ],
  allowFailure: false,    // throws on any inner revert
});
```

`allowFailure: true` returns `{ status: "success" | "failure", result?, error? }` per call. viem auto-uses Multicall3 (`0xcA11bde05977b3631167028862bE2a173976CA11`) on supported chains; verify presence at https://www.multicall3.com/.

Batch over time windows (the `batch` option on `http`):

```ts
http(url, { batch: { batchSize: 1024, wait: 16 } })
```

This silently coalesces same-block `eth_call` reads issued within `wait` ms into a single multicall. Useful for table/list components.

## Simulate then write

```ts
const { request } = await publicClient.simulateContract({
  address: vault,
  abi: vaultAbi,
  functionName: "deposit",
  args: [amount, account.address],
  account: account.address,
});

const hash = await walletClient.writeContract(request);
const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
```

`simulateContract` is what surfaces real revert reasons before signing. Skipping it leads to opaque "transaction failed" errors after the user pays gas.

`waitForTransactionReceipt` resolves when the tx is included; `confirmations: N` waits N additional blocks. Set `timeout` to bound the wait; default is provider-dependent.

## Estimating gas

```ts
const gas = await publicClient.estimateContractGas({
  address: vault,
  abi: vaultAbi,
  functionName: "deposit",
  args: [amount, account.address],
  account: account.address,
});

// or for a raw tx
const fees = await publicClient.estimateFeesPerGas({ chain: base });
// { maxFeePerGas, maxPriorityFeePerGas }   on EIP-1559 chains
```

For L2s with L1 calldata cost, the chain SDKs provide gas oracles (`viem/op-stack`, `viem/zksync`):

```ts
import { publicActionsL2 } from "viem/op-stack";

const opClient = publicClient.extend(publicActionsL2());
const l1Fee = await opClient.estimateL1Fee({
  to: vault,
  data: encodeFunctionData({ abi: vaultAbi, functionName: "deposit", args: [...] }),
});
```

Verify chain-specific actions at https://viem.sh/op-stack and https://viem.sh/zksync.

## Watching events

```ts
import { parseAbiItem } from "viem";

const unwatch = publicClient.watchContractEvent({
  address: vault,
  abi: vaultAbi,
  eventName: "Deposit",
  onLogs: (logs) => {
    for (const log of logs) console.log(log.args);
  },
});

// later
unwatch();
```

`http` transport uses `eth_getLogs` polling under the hood (default `pollingInterval: 4_000`). For low-latency feeds, switch to `webSocket(url)`.

For historical logs only:

```ts
const logs = await publicClient.getContractEvents({
  address: vault,
  abi: vaultAbi,
  eventName: "Deposit",
  fromBlock: 19_000_000n,
  toBlock: "latest",
});
```

Many providers cap `eth_getLogs` to a 10k-block range or fewer. Iterate windows; verify at your provider's docs.

## EIP-712 typed data

```ts
import { signTypedData } from "viem/actions";

const domain = {
  name: "USD Coin",
  version: "2",
  chainId: 8453,
  verifyingContract: usdc,   // ILLUSTRATIVE: verify per-chain at https://developers.circle.com/
} as const;

const types = {
  Permit: [
    { name: "owner",    type: "address" },
    { name: "spender",  type: "address" },
    { name: "value",    type: "uint256" },
    { name: "nonce",    type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

const signature = await walletClient.signTypedData({
  domain, types, primaryType: "Permit",
  message: { owner: account.address, spender, value, nonce, deadline },
});

// Split for Solidity v,r,s:
import { parseSignature } from "viem";
const { r, s, v, yParity } = parseSignature(signature);
const sigV = v ?? (yParity === 0 ? 27n : 28n);    // viem v2: prefer v if present
```

`parseSignature` is the v2 API; older code uses `hexToSignature` which has been removed. Verify at https://viem.sh/docs/utilities/parseSignature.

## Reading EIP-712 domain from a contract (EIP-5267)

```ts
const [fields, name, version, chainId, verifyingContract, salt, extensions] =
  await publicClient.readContract({
    address: token,
    abi: parseAbi(["function eip712Domain() view returns (bytes1,string,string,uint256,address,bytes32,uint256[])"] as const),
    functionName: "eip712Domain",
  });
```

Use this rather than hardcoding domain values — token contracts upgrade names/versions and chain id changes per network.

## Signing an EIP-7702 authorization (Pectra-era)

```ts
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(`0x${process.env.PK}`);
const auth = await account.signAuthorization({
  contractAddress: delegateContract,    // code to delegate to
  chainId: 8453,                        // 0 for any-chain (per EIP-7702)
  nonce: await publicClient.getTransactionCount({ address: account.address }),
});

const hash = await walletClient.sendTransaction({
  type: "eip7702",
  authorizationList: [auth],
  to: account.address,                  // self-call after delegation
  data: "0x...",
});
```

Verify viem's 7702 status at https://viem.sh/eip7702. Some L2s have not enabled SET_CODE_TX_TYPE 0x04 yet — check the chain's hard-fork status before relying on it.

## wagmi v2 hooks (React)

```tsx
import { WagmiProvider, createConfig, http } from "wagmi";
import { base, mainnet } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const config = createConfig({
  chains: [base, mainnet],
  transports: {
    [base.id]:    http(process.env.NEXT_PUBLIC_BASE_RPC),
    [mainnet.id]: http(process.env.NEXT_PUBLIC_MAINNET_RPC),
  },
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

Read pattern:

```tsx
import { useReadContract, useAccount } from "wagmi";

export function Balance() {
  const { address } = useAccount();
  const { data, isPending, error } = useReadContract({
    address: token,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 8_000 },
  });
  if (error) return <span>error</span>;
  if (isPending) return <span>...</span>;
  return <span>{data?.toString()}</span>;
}
```

Write pattern (simulate-then-write):

```tsx
import { useSimulateContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";

export function Deposit({ amount }: { amount: bigint }) {
  const { data: sim, error: simErr } = useSimulateContract({
    address: vault, abi: vaultAbi, functionName: "deposit", args: [amount],
  });
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading, isSuccess } = useWaitForTransactionReceipt({ hash });

  return (
    <button
      disabled={!sim?.request || isPending}
      onClick={() => sim && writeContract(sim.request)}
    >
      {isPending ? "confirm in wallet" : isLoading ? "mining" : isSuccess ? "done" : "deposit"}
    </button>
  );
}
```

Always disable the button until `sim?.request` exists and `simErr` is undefined — that catches reverts before the user signs.

Multicall in wagmi:

```tsx
import { useReadContracts } from "wagmi";

const { data } = useReadContracts({
  contracts: [
    { address: token, abi: erc20Abi, functionName: "balanceOf", args: [user] },
    { address: token, abi: erc20Abi, functionName: "symbol" },
  ],
});
```

## Connectors (wallet UX)

Pick one — they own the connect-modal UI:

| Lib | Strength |
|---|---|
| RainbowKit | Polished, opinionated, good defaults |
| ConnectKit | Themable, lighter weight |
| Reown AppKit (formerly Web3Modal) | Multi-chain, WalletConnect-first |

RainbowKit example:

```tsx
import { getDefaultConfig, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";

const config = getDefaultConfig({
  appName: "MyApp",
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID!,    // WalletConnect cloud projectId
  chains: [base, mainnet],
  transports: { [base.id]: http(), [mainnet.id]: http() },
});

// wrap with WagmiProvider + QueryClientProvider + RainbowKitProvider
```

Verify current API at https://www.rainbowkit.com/.

## Migrating from ethers.js v6

Mental mapping:

| ethers v6 | viem v2 |
|---|---|
| `JsonRpcProvider` | `publicClient` |
| `Wallet`, `Signer` | `walletClient` + `Account` |
| `Contract.method(args)` | `readContract` / `writeContract` |
| `provider.getBalance(addr)` | `publicClient.getBalance({ address })` |
| `wallet.sendTransaction(tx)` | `walletClient.sendTransaction(tx)` |
| `signTypedData(domain, types, value)` | `walletClient.signTypedData({...})` |
| `Interface.encodeFunctionData` | `encodeFunctionData({ abi, functionName, args })` |
| `keccak256(toUtf8Bytes(s))` | `keccak256(toBytes(s))` |
| `formatUnits / parseUnits` | `formatUnits / parseUnits` (same) |
| `BigNumber` | native `bigint` |
| `Wallet.fromMnemonic` | `mnemonicToAccount` (`viem/accounts`) |

Run both side-by-side during migration; viem and ethers can share a provider via `custom(window.ethereum)` and `new ethers.BrowserProvider(window.ethereum)`.

## Common pitfalls

- **`bigint` vs `number`**: viem returns bigint everywhere. Math operators between bigint and number throw. Use `parseUnits("1.5", 18)` to parse user input.
- **Decimals mismatch**: USDC is 6 decimals on most chains, USDT varies. Always read `decimals()` rather than hardcoding 18.
- **`walletClient.account` is required for `writeContract`** unless you pass `account` explicitly per call.
- **Chain mismatch**: if the wallet is on mainnet but `walletClient.chain` is base, the wallet rejects. Drive a `useSwitchChain` flow.
- **WebSocket transports drop on idle networks**; set `keepAlive` or use the polling `http` transport for long-lived watchers.
- **Multicall fallback**: if a chain has no Multicall3, viem falls back to one call per item (slow). Verify chain support; for custom chains pass `multicall3: { address }` in the chain config.
- **`waitForTransactionReceipt` timeout** is provider-dependent; pass `timeout: 60_000` for slow chains.
- **EIP-712 schema drift**: do not hardcode domain `name` / `version`. Read them from the contract via `eip712Domain()` (EIP-5267) or the contract's published spec.
- **Server-side wagmi**: wagmi hooks are client-only. For SSR, use viem directly in server components.

## What to read next

- `references/foundry-deep-dive.md` — same chain reads/writes from CLI
- `references/agent-tooling.md` — viem + x402 + MCP for agents
- viem docs: https://viem.sh/
- wagmi docs: https://wagmi.sh/
