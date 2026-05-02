# Error Translation

Raw revert data is unintelligible to users. Translate it. The goal is one short, accurate sentence that tells the user what to do next — not a stack trace, not a hex selector.

## The viem error tree

viem throws a structured hierarchy. Walk it and pick the deepest match:

```ts
import {
  BaseError,
  ContractFunctionRevertedError,
  UserRejectedRequestError,
  TransactionExecutionError,
  EstimateGasExecutionError,
  InsufficientFundsError,
  RpcRequestError,
} from "viem";

export function translateError(e: unknown, abi?: any): string {
  if (!(e instanceof BaseError)) return "Something went wrong. Please retry.";

  // 1. Wallet rejection — most common, never a "real" error
  const rejected = e.walk((err) => err instanceof UserRejectedRequestError);
  if (rejected) return "Transaction cancelled.";

  // 2. Out of gas / insufficient funds
  const insufficient = e.walk((err) => err instanceof InsufficientFundsError);
  if (insufficient) return "Insufficient ETH for gas.";

  // 3. Contract revert — try to decode
  const reverted = e.walk((err) => err instanceof ContractFunctionRevertedError);
  if (reverted instanceof ContractFunctionRevertedError) {
    return decodeRevert(reverted, abi);
  }

  // 4. RPC error — provider problem, not user
  const rpc = e.walk((err) => err instanceof RpcRequestError);
  if (rpc) return "Network is busy. Please retry in a moment.";

  // 5. Fallback — short message, never the raw string
  return e.shortMessage ?? "Transaction failed.";
}
```

`e.walk(predicate)` is the key viem helper — it traverses the cause chain and returns the first match. Always walk; the top-level error is usually a wrapper.

## Decoding contract reverts

```ts
function decodeRevert(err: ContractFunctionRevertedError, abi: any): string {
  // Custom error (named): err.data.errorName + err.data.args
  if (err.data?.errorName) {
    return mapCustomError(err.data.errorName, err.data.args);
  }
  // Plain require(message): err.reason
  if (err.reason) return prettify(err.reason);
  // Panic (assert / overflow / div by zero)
  if (err.signature === "0x4e487b71") return "Internal contract error.";
  return "Transaction reverted.";
}

const CUSTOM_ERROR_MAP: Record<string, (args: any[]) => string> = {
  InsufficientBalance: ([have, want]) =>
    `You need ${formatToken(want)} but have ${formatToken(have)}.`,
  SlippageTooHigh: () =>
    "Price moved while confirming. Try again or raise slippage tolerance.",
  Expired: () =>
    "Quote expired. Refresh and try again.",
  Paused: () =>
    "This action is temporarily paused.",
};

function mapCustomError(name: string, args: any[]) {
  return CUSTOM_ERROR_MAP[name]?.(args) ?? `${name}.`;
}
```

Build the `CUSTOM_ERROR_MAP` from your contract's ABI. For external protocols (Uniswap, Aave) you can extend the map with their published custom errors — Uniswap V4 has ~40 typed errors, all on https://docs.uniswap.org/contracts/v4/reference/.

## Message tone

Bad:
- "ERC20: transfer amount exceeds allowance"
- "0xb39e7b07: SlippageTooHigh"
- "execution reverted"
- "Error: missing revert data"

Better:
- "Approve more tokens before swapping."
- "Price moved while confirming. Try again."
- "Transaction reverted. The contract rejected this action."
- "Network is busy. Please retry."

Rules:
- One sentence, period.
- Tell them what to do next, not what failed in vault terms.
- Never display hex selectors, gas numbers, or addresses unless the user explicitly opens a "details" affordance.
- "Cancelled" for rejections, not "Failed."

## Pre-flight: simulate before sending

Most reverts can be caught BEFORE the wallet popup using `simulateContract`:

```ts
import { useSimulateContract } from "wagmi";

const { data: sim, error: simError } = useSimulateContract({
  address: vault, abi: vaultAbi,
  functionName: "deposit",
  args: [amount, user],
  query: { enabled: amount > 0n },
});

if (simError) {
  // Show inline: "Cannot deposit — insufficient allowance"
  return <Inline error={translateError(simError, vaultAbi)} />;
}
```

A failing simulation means a failing tx. Disable the button and show the reason inline rather than letting the user pop the wallet only to be told no.

## Wallet-specific error shapes

Wallets occasionally wrap the same error differently:

- MetaMask: `code: 4001` for rejection, `code: -32603` for internal errors.
- Coinbase Wallet: nested `cause.cause` for rejections.
- Rainbow: same as MetaMask.
- WalletConnect: `code` lives at `error.code`, `message` at `error.message`.

viem's walker handles MetaMask and Rainbow correctly. For Coinbase Wallet, add an extra walk:

```ts
const cb = e.walk((err) =>
  err.message?.includes?.("User denied") ||
  err.message?.includes?.("User rejected")
);
```

It's belt-and-braces but cheaper than diagnosing a "wallet rejection counted as failure" support ticket.

## Inline vs toast

| Where | When |
|---|---|
| Inline near the button | Pre-flight error (simulate failed); the user can fix and retry |
| Toast | Submitted-then-failed; the action is over, just tell them |
| Modal | Multi-step flow failed midway; needs explanation + recovery action |

Don't toast on rejection — it's noisy. A subtle inline indicator is enough.

## Logging vs displaying

```ts
try { ... } catch (e) {
  console.error("staking failed", e);     // raw error → console
  reportToSentry(e);                       // raw error → telemetry
  toast(translateError(e, vaultAbi));      // friendly string → user
}
```

Never paste the raw error into the UI. Never strip details from your telemetry. Two channels.

## Common pitfalls

- **Using `e.message` directly**: usually a long technical string. Always go through `translateError`.
- **Catching and swallowing**: the user thinks the tx succeeded. Always show or rethrow.
- **Mapping by error string content**: viem changes wording across versions. Map by error class + selector instead.
- **Forgetting custom-error args**: `InsufficientBalance(have, want)` carries the numbers — show them.
- **Treating "user rejected" as a failure**: it's not. Don't show a red banner.
- **No fallback for unknown errors**: ship a "Something went wrong, retry?" CTA with a copy-error-to-clipboard affordance for support.
- **Decoded message in tech tone** ("`SlippageTooHigh`") instead of plain English ("Price moved while confirming"). Always rewrite.

## What to read next

- `references/tx-state-machines.md` — when errors fire and how to recover
- viem error reference: https://viem.sh/docs/glossary/errors
- `security/SKILL.md` — what the contract should revert on (so you know what to translate)
