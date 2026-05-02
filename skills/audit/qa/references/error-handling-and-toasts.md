# Error Handling and Toast Discipline

The default behavior of wagmi + viem on a transaction failure is to log a 200-line stack trace to the console and silently display nothing to the user. This is a UX-shipping bug, not a developer-experience problem. This file is the contract for what your app must show — and not show — when something goes wrong.

For the full pre-ship checklist, see `SKILL.md`. For mobile-specific issues, see `references/mobile-and-pwa.md`. For post-launch monitoring, see `references/post-launch-monitoring.md`.

## The rule

Every error a user can trigger must produce **one** human-readable toast. Not a console log. Not a generic "Something went wrong." Not a stack trace. A specific sentence that tells them what happened and what to do.

```tsx
// FAIL — silent
try { await write(); } catch (e) { console.error(e); }

// FAIL — generic
try { await write(); } catch (e) { toast.error("Error"); }

// FAIL — raw hex
try { await write(); } catch (e) { toast.error(e.message); } // "0x4e487b71..."

// PASS — mapped, specific
try { await write(); } catch (e) { toast.error(humanizeError(e)); }
```

## The error taxonomy

Every transaction error falls into one of these buckets. Map each to a human-readable message:

| Bucket | Detection | Toast message |
|---|---|---|
| User rejected | `e.code === 4001` or `/user (rejected\|denied)/i.test(e.message)` | "Transaction cancelled." (no error tone) |
| Insufficient funds | `/insufficient funds/i` | "Not enough ETH for gas. Top up your wallet." |
| Insufficient allowance | Contract revert + `transferFrom` in calldata | "Approve the token first, then try again." |
| Slippage / price moved | Custom error matching protocol | "Price moved beyond your slippage. Try again or raise tolerance." |
| Wrong network | `useChainId() !== targetNetwork.id` | "Switch to [Chain] to continue." (and render switch button) |
| RPC down / timeout | viem `RpcRequestError` or fetch timeout | "Connection issue. Check your network and retry." |
| Nonce too low | `/nonce too low/i` | "Wallet is out of sync. Disconnect and reconnect." |
| Replacement transaction underpriced | `/replacement transaction underpriced/i` | "A pending transaction is blocking this one. Speed it up or cancel in your wallet." |
| Contract revert with reason | `BaseError.shortMessage` or decoded custom error | The reason string, formatted as a sentence |
| Contract revert without reason | catch-all | "The contract rejected this transaction. Check inputs." |
| Generic / unknown | last resort | "Something went wrong. Try again, or check the explorer for details." |

## viem's error structure

viem wraps errors in a hierarchy you can pattern-match against:

```ts
import {
  BaseError,
  ContractFunctionRevertedError,
  UserRejectedRequestError,
  TransactionExecutionError,
  RpcRequestError,
} from "viem";

function humanizeError(error: unknown): string {
  if (!(error instanceof BaseError)) {
    return "Something went wrong. Try again.";
  }

  const rejected = error.walk(e => e instanceof UserRejectedRequestError);
  if (rejected) return "Transaction cancelled.";

  const reverted = error.walk(e => e instanceof ContractFunctionRevertedError);
  if (reverted instanceof ContractFunctionRevertedError) {
    const customError = reverted.data?.errorName;
    if (customError) return mapCustomError(customError, reverted.data?.args);
    if (reverted.reason) return reverted.reason;
  }

  const exec = error.walk(e => e instanceof TransactionExecutionError);
  if (exec) {
    if (/insufficient funds/i.test(exec.message)) {
      return "Not enough ETH for gas. Top up your wallet.";
    }
    if (/nonce too low/i.test(exec.message)) {
      return "Wallet is out of sync. Disconnect and reconnect.";
    }
  }

  const rpc = error.walk(e => e instanceof RpcRequestError);
  if (rpc) return "Connection issue. Check your network and retry.";

  return error.shortMessage ?? "Something went wrong. Try again.";
}
```

`walk(predicate)` traverses the cause chain — wagmi/viem errors are nested, and the root error type often isn't the class you'd guess from the message.

## Custom contract errors

Solidity custom errors are encoded in the revert data. Map each to a user-facing string:

```ts
const CUSTOM_ERRORS: Record<string, (args?: unknown[]) => string> = {
  InsufficientShares: (args) => `Not enough shares. You have ${args?.[0]}.`,
  Slippage: () => "Price moved beyond your slippage tolerance.",
  Paused: () => "The protocol is paused.",
  ExceedsLimit: (args) => `Amount exceeds the limit (${args?.[0]}).`,
  Cooldown: () => "You are in a cooldown period. Try again later.",
};

function mapCustomError(name: string, args?: unknown[]): string {
  const handler = CUSTOM_ERRORS[name];
  if (handler) return handler(args);
  // Convert PascalCase to Sentence case as a fallback
  return name.replace(/([A-Z])/g, " $1").trim() + ".";
}
```

Read your contract's custom errors and map every one of them. The fallback (PascalCase → Sentence) is for catching ones you missed; it's better than raw selectors but worse than a real mapping.

## Toasting policy

Choose ONE toast library and use it consistently:

| Library | Notes |
|---|---|
| `react-hot-toast` | Lightweight, good defaults. SE2 ships with this. |
| `sonner` | Better animations, queue management. |
| `@scaffold-eth-2`'s `notification` helper | Wraps react-hot-toast, includes explorer links. |

In SE2, prefer `notification.error(humanizeError(e))` over raw toast calls — it includes block explorer linking automatically.

### Toast types and severity

```ts
notification.success("Deposit complete");        // green
notification.error("Approval failed");           // red, requires action
notification.info("Switch to Base to continue"); // blue, neutral
notification.loading("Confirming on-chain...");  // gray, with spinner
```

Rules:

- **Success**: only after on-chain confirmation, never on signature alone
- **Error**: only on actual error, not user-cancellation
- **Info**: for guidance ("connect wallet", "switch chain")
- **Loading**: for in-flight operations; replace with success/error when resolved

## What "user cancelled" should NOT do

User rejection (clicked "Reject" in their wallet) is **not an error**. Do not show an error toast. Either show no toast at all or a brief informational dismissal:

```ts
if (rejectedDetected) {
  // Option A: no toast (preferred — they know they cancelled)
  return;
  // Option B: gentle info
  notification.info("Transaction cancelled.");
}
```

Showing a red error toast on rejection trains users to ignore your error toasts entirely.

## Loading state mapping

Every async action needs a loading toast that resolves to success or error:

```ts
const handleDeposit = async () => {
  const id = notification.loading("Submitting deposit...");
  try {
    await writeAsync({ functionName: "deposit", args: [amount] });
    notification.remove(id);
    notification.success("Deposit complete");
  } catch (e) {
    notification.remove(id);
    notification.error(humanizeError(e));
  }
};
```

If you skip the explicit `remove`, the loading toast lingers indefinitely. react-hot-toast can be configured to auto-replace via `toast.promise()`, which is cleaner:

```ts
notification.promise(writeAsync({ functionName: "deposit", args: [amount] }), {
  loading: "Submitting deposit...",
  success: "Deposit complete",
  error: humanizeError,
});
```

## Error boundaries

For unexpected errors that escape the try/catch (e.g., wagmi internals, hook errors), use an error boundary at the app root:

```tsx
"use client";
import { ErrorBoundary } from "react-error-boundary";

function ErrorFallback({ error, resetErrorBoundary }) {
  return (
    <div className="alert alert-error">
      <p>The page crashed. Please refresh.</p>
      <button onClick={resetErrorBoundary} className="btn btn-sm">Reset</button>
    </div>
  );
}

<ErrorBoundary FallbackComponent={ErrorFallback} onError={reportToSentry}>
  <App />
</ErrorBoundary>
```

Without this, a wagmi exception in a hook can blank the page with no recovery path.

## Reporting errors to monitoring

In production, log unexpected errors to Sentry / Tenderly / your monitoring stack:

```ts
catch (e) {
  notification.error(humanizeError(e));
  if (isUnexpected(e)) {
    Sentry.captureException(e, {
      tags: { contract: "Vault", function: "deposit" },
      extra: { args, account: address },
    });
  }
}

function isUnexpected(e: unknown): boolean {
  if (!(e instanceof BaseError)) return true;
  if (e.walk(x => x instanceof UserRejectedRequestError)) return false;
  if (e.walk(x => x instanceof ContractFunctionRevertedError)) return false;
  return true;
}
```

User cancellations and contract reverts are **expected** — don't pollute monitoring with them. RPC timeouts, nonce issues, viem internals are unexpected and worth flagging.

## Empty / loading / error UI states

For pages that load on-chain data, every state must have a UI:

```tsx
if (isLoading) return <Skeleton />;
if (error) return <ErrorState error={error} onRetry={refetch} />;
if (!data || data.length === 0) return <EmptyState />;
return <DataTable data={data} />;
```

The most common AI mistake: render `data.map(...)` without checking `isLoading` or `error`, leading to a blank screen during fetch and a TypeError on failure.

## Specific failure scenarios you must handle

| Scenario | What user sees |
|---|---|
| User has 0 ETH on the connected chain | "Get ETH on [Chain]" guidance + bridge link if applicable |
| Wallet returns empty signature | "Wallet didn't return a signature. Try again." |
| Approval succeeded but action then fails | Toast for the action error, NOT for the approval (it succeeded) |
| User on wrong chain | "Switch to [Chain]" button in CTA slot, not error toast |
| Mobile user closes wallet mid-sign | "Transaction cancelled." (treat as user-rejection) |
| RPC returns stale data and tx fails | "Network is congested. Try again in a moment." |
| Contract is paused | Map custom `Paused()` error to "The protocol is paused. Check status page." |

## Common pitfalls

- **Catching but not toasting** — `try { ... } catch {}` swallows the error invisibly
- **Toasting raw `e.message`** — exposes hex selectors, stack info, RPC internals
- **Showing "Success!" on signature, not confirmation** — user thinks tx succeeded; it might not for 30 seconds
- **Stacking toasts** — every retry adds another toast; cap with `toast.dismiss()` or use unique IDs
- **No retry option** — RPC errors are transient; users want a button, not just a message
- **Treating rejection as error** — red toast on rejection trains users to ignore reds
- **Silent contract reverts** — if `e.shortMessage` is "execution reverted" with no reason, you lose the failure mode. Map common contract reverts explicitly.

## Quick check checklist

- [ ] All write calls wrapped in try/catch with `humanizeError`
- [ ] User rejection produces no error toast
- [ ] Custom contract errors mapped to user-facing strings
- [ ] Loading states for every async action
- [ ] Error boundary at app root
- [ ] Sentry/monitoring receives unexpected errors only
- [ ] Empty / loading / error UI states for every data-fetching page
- [ ] No raw `e.message` in toasts
- [ ] No `console.error(e)` in production (unless followed by user feedback)

## What to read next

- `SKILL.md` — full QA checklist
- `references/mobile-and-pwa.md` — mobile-specific UX
- `references/post-launch-monitoring.md` — what to watch after launch
- viem error reference: https://viem.sh/docs/glossary/errors.html
- React Error Boundary: https://github.com/bvaughn/react-error-boundary
