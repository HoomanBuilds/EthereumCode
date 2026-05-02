# Transaction State Machines

The button label and `disabled` state of every onchain action are a state machine over four signals: connection, network, allowance, and tx-in-flight. Most "weird UI bugs" are mis-modelled transitions: a button re-enables before the chain reflects the new state, a stale `isLoading` blocks the whole UI, an approve spinner stays on after rejection. This file is the patterns that survive the last 1% of edge cases.

## The full state space

```
                 ┌─────────────────────┐
                 │  not connected      │ → "Connect"
                 └─────────────────────┘
                          │ connected
                          ▼
                 ┌─────────────────────┐
                 │  wrong network      │ → "Switch to <chain>"
                 └─────────────────────┘
                          │ correct chain
                          ▼
                 ┌─────────────────────┐
                 │  insufficient       │ → "Approve" (with sub-states)
                 │  allowance          │
                 └─────────────────────┘
                          │ allowance ok
                          ▼
                 ┌─────────────────────┐
                 │  ready              │ → "Stake" / "Swap" / "Deposit"
                 └─────────────────────┘
                          │ user clicks
                          ▼
                 ┌─────────────────────┐
                 │  submitting         │ → spinner, disabled
                 └─────────────────────┘
                          │ wallet returns hash
                          ▼
                 ┌─────────────────────┐
                 │  pending (mempool)  │ → "Staking..." disabled
                 └─────────────────────┘
                          │ mined
                          ▼
                 ┌─────────────────────┐
                 │  confirmed          │ → success toast, refetch
                 └─────────────────────┘
```

`submitting` and `pending` are different. The wallet returns the hash before the tx is mined; if you only watch `isPending`, your button re-enables in the gap and the user can double-click into a duplicate tx.

## React: the hook shape

```tsx
import { useState } from "react";
import { useAccount, useChainId, useReadContract, useWriteContract,
         useWaitForTransactionReceipt, useSwitchChain } from "wagmi";

export function useStakeFlow({ stakingToken, vault, amount, requiredChainId }) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: stakingToken,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, vault] : undefined,
    query: { enabled: isConnected && chainId === requiredChainId },
  });

  const [approveSubmitting, setApproveSubmitting] = useState(false);
  const [stakeSubmitting, setStakeSubmitting] = useState(false);

  const approveTx = useWriteContract();
  const stakeTx   = useWriteContract();

  const approveReceipt = useWaitForTransactionReceipt({
    hash: approveTx.data,
    query: { enabled: !!approveTx.data },
  });
  const stakeReceipt = useWaitForTransactionReceipt({
    hash: stakeTx.data,
    query: { enabled: !!stakeTx.data },
  });

  // Derived state — the UI reads these
  const state =
    !isConnected                   ? "connect"
    : chainId !== requiredChainId  ? "wrongNetwork"
    : approveSubmitting || approveReceipt.isLoading
                                   ? "approving"
    : (allowance ?? 0n) < amount   ? "needsApproval"
    : stakeSubmitting || stakeReceipt.isLoading
                                   ? "staking"
    : "ready";

  const onApprove = async () => {
    setApproveSubmitting(true);
    try {
      await approveTx.writeContractAsync({
        address: stakingToken, abi: erc20Abi,
        functionName: "approve", args: [vault, amount],
      });
    } finally {
      setApproveSubmitting(false);   // covers wallet rejection
    }
  };

  // Refetch allowance after approve confirms
  if (approveReceipt.isSuccess && approveReceipt.data) {
    refetchAllowance();
  }

  const onStake = async () => {
    setStakeSubmitting(true);
    try {
      await stakeTx.writeContractAsync({
        address: vault, abi: vaultAbi,
        functionName: "deposit", args: [amount, address],
      });
    } finally {
      setStakeSubmitting(false);
    }
  };

  return { state, onConnect: () => {/*open modal*/},
           onSwitch: () => switchChain({ chainId: requiredChainId }),
           onApprove, onStake };
}
```

The `try/finally` around `writeContractAsync` is non-negotiable — without it, a wallet rejection (most common error path) leaves the button locked.

## The submit-vs-pending bug

```tsx
// WRONG
<button
  disabled={approveTx.isPending}
  onClick={() => approveTx.writeContract({ ... })}
>...</button>
```

`isPending` clears as soon as the wallet returns the hash. If your UI also waits for the allowance refetch (which only completes after the receipt), there's a window where:
- `isPending = false`
- allowance is still pre-approve
- button re-enables → user clicks → second tx queued

Always combine `submitting` + `receipt.isLoading` for `disabled`.

## Network-switch race

User on Ethereum, your dApp targets Base. They click "Switch to Base." Some wallets emit `chainChanged` before the switch is fully committed; if you optimistically render "Approve" and they click it, the wallet still thinks it's on Ethereum and pops a wrong-chain tx.

Fix: gate the action button on `chainId === requiredChainId` AND on `useSwitchChain().isPending === false`. Don't trust the chain id alone for one render.

## Refetch cadence after confirmation

After a state-changing tx confirms, you have to refetch:
- The user's balance (for both tokens involved).
- The allowance (for the spender involved).
- Any onchain state your UI displays (vault shares, position).

Wagmi v2 + TanStack Query: invalidate by `queryKey` rather than calling `refetch` everywhere. One `queryClient.invalidateQueries({ queryKey: ["readContract"] })` after `receipt.isSuccess` works for most apps. Tighten the key as you grow.

## Optimistic updates

For UX-critical reads (e.g. "your balance just decreased after deposit"), update the cache optimistically:

```tsx
queryClient.setQueryData(balanceQueryKey, (old) => old - amount);
```

Then refetch on confirmation. If the tx reverts, refetch overwrites with truth. Don't do this for security-sensitive reads (allowances, positions used for borrow limits) — show actual chain state.

## Error paths

| Error | Source | UX |
|---|---|---|
| User rejected | wallet | toast "Transaction cancelled" — no error red flag |
| Insufficient funds for gas | wallet | toast with specific amount needed |
| Reverted with reason string | RPC | show parsed string ("Slippage too high") |
| Reverted with custom error | RPC | decode via ABI → human message |
| Network timeout | provider | toast "Network slow, retry?" with retry button |
| Already pending tx | wallet (account nonce in-use) | toast "Confirm or reject the pending wallet popup" |

`viem`'s `BaseError`, `ContractFunctionRevertedError`, `UserRejectedRequestError` chain hierarchy makes this straightforward — see `references/error-translation.md`.

## Multi-step flows (mint → stake → join pool)

For longer flows, model as an explicit machine, not a pile of booleans. XState shape, plain reducer:

```ts
type Step = "idle" | "minting" | "minted" | "staking" | "staked" | "pooling" | "done";
type Event =
  | { type: "MINT_SUBMITTED" } | { type: "MINT_CONFIRMED" }
  | { type: "STAKE_SUBMITTED" } | { type: "STAKE_CONFIRMED" }
  | { type: "POOL_SUBMITTED" } | { type: "POOL_CONFIRMED" }
  | { type: "ERROR" };

function reducer(s: Step, e: Event): Step {
  if (e.type === "ERROR") return "idle";
  switch (s) {
    case "idle":     return e.type === "MINT_SUBMITTED" ? "minting" : s;
    case "minting":  return e.type === "MINT_CONFIRMED" ? "minted" : s;
    // ...
    default: return s;
  }
}
```

Show one step's button at a time. Persist step to localStorage so a refresh mid-flow lands on the right step (with a "resume" CTA).

## Common pitfalls

- **Single shared `isLoading`** for many buttons → all spin together; one bug locks the page.
- **Re-enabling on `isPending = false`** → window for double-submit.
- **Forgetting `finally {}`** → rejected tx locks the button forever.
- **Switching network without waiting for confirmation** → next click goes out on the old chain.
- **Missing `query.enabled`** on reads that depend on `address` → TanStack issues a request with `args: [undefined]` and your console fills with errors.
- **Optimistic update without rollback path** → user sees wrong balance after a revert.
- **Showing "Approve" while a previous approve is still pending** in the wallet → user signs two approves; second one's nonce conflicts.
- **No empty state for zero balance / zero shares** → "Stake" button enabled with `amount = 0` → tx reverts.

## What to read next

- `references/error-translation.md` — viem error → user message
- `references/address-and-name-ux.md` — address inputs and ENS
- `frontend-playbook/SKILL.md` — full deploy and QA pipeline
- wagmi v2 docs: https://wagmi.sh/
