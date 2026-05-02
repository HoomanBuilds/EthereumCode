# Component Recipes

Copy-paste-ready patterns for the components every dApp needs. Tailwind + shadcn/ui conventions. Adapt class names if you're on a different stack.

For layout see `references/layout-and-grid.md`. For copy see `references/copy-rules.md`.

## Button

Variants:

```tsx
// Primary — used 1-2 per screen
<button className="inline-flex items-center justify-center h-10 px-4 rounded-md bg-brand text-white text-sm font-medium hover:bg-brand-600 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed">
  Deposit
</button>

// Secondary
<button className="inline-flex items-center justify-center h-10 px-4 rounded-md border bg-background text-foreground text-sm font-medium hover:bg-muted focus-visible:ring-2">
  Cancel
</button>

// Ghost
<button className="inline-flex items-center justify-center h-10 px-4 rounded-md text-foreground text-sm font-medium hover:bg-muted">
  Skip
</button>

// Destructive
<button className="inline-flex items-center justify-center h-10 px-4 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700">
  Disconnect
</button>
```

With loading state:

```tsx
<button disabled={isPending} className="...">
  {isPending ? (
    <>
      <Spinner className="mr-2 h-4 w-4 animate-spin" />
      Confirming...
    </>
  ) : (
    'Deposit'
  )}
</button>
```

Sizes:

```
sm    h-8  px-3  text-sm
md    h-10 px-4  text-sm    ← default
lg    h-12 px-6  text-base
```

Icon button:

```tsx
<button className="inline-flex items-center justify-center h-10 w-10 rounded-md hover:bg-muted">
  <Copy className="h-4 w-4" />
</button>
```

## Input (text)

```tsx
<input
  type="text"
  className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50"
/>
```

With label:

```tsx
<div className="space-y-2">
  <label htmlFor="amount" className="text-sm font-medium">
    Amount
  </label>
  <input id="amount" ... />
  <p className="text-xs text-muted-foreground">Available: 1,234.56 USDC</p>
</div>
```

## Amount input (the most important crypto component)

```tsx
<div className="rounded-xl border bg-card p-4">
  <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
    <span>You deposit</span>
    <span>Balance: 1,234.56 USDC</span>
  </div>
  <div className="flex items-center gap-3">
    <input
      type="text"
      inputMode="decimal"
      placeholder="0.0"
      value={amount}
      onChange={...}
      className="flex-1 bg-transparent text-3xl font-medium tabular-nums focus:outline-none"
    />
    <button className="text-xs font-medium text-brand hover:underline" onClick={setMax}>
      MAX
    </button>
    <TokenSelector />
  </div>
  <div className="mt-2 text-xs text-muted-foreground">
    ≈ ${usdEquivalent}
  </div>
</div>
```

Critical pieces:

- `inputMode="decimal"` (mobile keyboard)
- `font-variant-numeric: tabular-nums` for alignment
- MAX button accessible
- USD equivalent shown
- Balance always visible
- Token symbol next to the number, not inside the input

## Card

```tsx
<div className="rounded-xl border bg-card p-6 shadow-sm">
  <h3 className="text-sm font-medium text-muted-foreground">TVL</h3>
  <p className="mt-2 text-3xl font-semibold tabular-nums">$1,234,567</p>
  <p className="mt-1 text-xs text-emerald-600">+2.4% (24h)</p>
</div>
```

For a hover-elevated card:

```tsx
<div className="rounded-xl border bg-card p-6 transition-shadow hover:shadow-md">
```

## Modal

shadcn Dialog API:

```tsx
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent className="sm:max-w-md">
    <DialogHeader>
      <DialogTitle>Confirm deposit</DialogTitle>
      <DialogDescription>
        Depositing 100 USDC into the stETH vault.
      </DialogDescription>
    </DialogHeader>
    <div className="space-y-3 py-4">
      <Row label="Amount" value="100 USDC" />
      <Row label="Network fee" value="~$0.02" />
      <Row label="You will receive" value="~99.95 vUSDC" />
    </div>
    <DialogFooter>
      <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      <Button onClick={confirm}>Confirm</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

Rules:

- Backdrop click closes by default — disable while transaction is signing
- ESC closes by default
- Focus trapped inside
- Title is one short sentence; no question marks
- One primary CTA in the footer

## Toast (sonner)

```tsx
import { toast } from 'sonner';

// Success
toast.success('Deposited 100 USDC', {
  description: 'Transaction confirmed',
  action: {
    label: 'View',
    onClick: () => window.open(explorerUrl, '_blank'),
  },
});

// Error
toast.error('Transaction failed', {
  description: 'Slippage too high — try increasing tolerance',
  duration: Infinity,
});

// Promise (auto handles loading → success/error)
toast.promise(deposit(amount), {
  loading: 'Depositing...',
  success: (tx) => `Deposited 100 USDC`,
  error: (err) => translateError(err),
});
```

## Skeleton

For loading lists:

```tsx
<div className="space-y-3">
  {Array.from({ length: 5 }).map((_, i) => (
    <div key={i} className="flex items-center gap-3 p-4 rounded-md border">
      <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-1/3 bg-muted rounded animate-pulse" />
        <div className="h-3 w-1/2 bg-muted rounded animate-pulse" />
      </div>
      <div className="h-6 w-20 bg-muted rounded animate-pulse" />
    </div>
  ))}
</div>
```

Match the shape of the loaded content. A generic centered spinner means you didn't think about loading.

## Empty state

```tsx
<div className="flex flex-col items-center justify-center py-16 text-center">
  <div className="rounded-full bg-muted p-4 mb-4">
    <Wallet className="h-8 w-8 text-muted-foreground" />
  </div>
  <h3 className="text-lg font-semibold">No positions yet</h3>
  <p className="mt-2 text-sm text-muted-foreground max-w-sm">
    Deposit to start earning yield on your stETH.
  </p>
  <Button className="mt-6">Deposit stETH</Button>
</div>
```

Always include a CTA. Empty without next step is dead-end.

## Address display

```tsx
function Address({ address }: { address: `0x${string}` }) {
  const short = `${address.slice(0, 6)}…${address.slice(-4)}`;
  return (
    <button
      onClick={() => navigator.clipboard.writeText(address)}
      className="inline-flex items-center gap-1 font-mono text-sm hover:text-brand"
    >
      {short}
      <Copy className="h-3 w-3" />
    </button>
  );
}
```

## Number display

```tsx
import { formatUnits } from 'viem';

function TokenAmount({ value, decimals = 18, symbol, precision = 4 }: ...) {
  const formatted = Number(formatUnits(value, decimals));
  return (
    <span className="tabular-nums">
      {formatted.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: precision,
      })}{' '}
      <span className="text-muted-foreground">{symbol}</span>
    </span>
  );
}
```

Never display raw bigint. Always format. Always show the symbol.

## Connect wallet button

```tsx
<ConnectButton.Custom>
  {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
    const ready = mounted;
    const connected = ready && account && chain;

    return (
      <div className="flex gap-2">
        {!connected ? (
          <Button size="lg" onClick={openConnectModal}>Connect Wallet</Button>
        ) : chain.unsupported ? (
          <Button variant="destructive" onClick={openChainModal}>Wrong network</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={openChainModal}>
              <ChainIcon /> {chain.name}
            </Button>
            <Button variant="secondary" onClick={openAccountModal}>
              {account.displayName}
            </Button>
          </>
        )}
      </div>
    );
  }}
</ConnectButton.Custom>
```

## Transaction button (the hardest)

```tsx
function DepositButton({ amount }: ...) {
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const handleDeposit = () => {
    writeContract({
      address: VAULT,
      abi,
      functionName: 'deposit',
      args: [amount],
    });
  };

  if (isPending) return <Button disabled className="w-full"><Spinner /> Confirm in wallet</Button>;
  if (isConfirming) return <Button disabled className="w-full"><Spinner /> Confirming on-chain</Button>;
  if (isSuccess) return <Button disabled className="w-full">Deposited</Button>;

  return <Button onClick={handleDeposit} className="w-full">Deposit</Button>;
}
```

Three distinct states matter:

1. **Awaiting wallet signature** — user is in MetaMask popup
2. **Submitted, waiting for confirmation** — block confirmation pending
3. **Confirmed** — done

Conflating them is the most common dApp UX failure.

## Tabs

```tsx
<div role="tablist" className="inline-flex h-10 items-center justify-center rounded-md bg-muted p-1">
  {tabs.map((tab) => (
    <button
      key={tab.id}
      role="tab"
      aria-selected={active === tab.id}
      onClick={() => setActive(tab.id)}
      className={cn(
        'inline-flex items-center justify-center rounded-sm px-3 py-1.5 text-sm font-medium transition-all',
        active === tab.id ? 'bg-background shadow' : 'hover:text-foreground/80'
      )}
    >
      {tab.label}
    </button>
  ))}
</div>
```

## Network mismatch banner

```tsx
{chain && chain.id !== EXPECTED_CHAIN.id && (
  <div className="flex items-center justify-between gap-3 p-3 bg-amber-50 border border-amber-200 rounded-md">
    <div className="flex items-center gap-2 text-sm text-amber-900">
      <AlertCircle className="h-4 w-4" />
      Wrong network. Switch to {EXPECTED_CHAIN.name} to continue.
    </div>
    <Button size="sm" onClick={() => switchChain({ chainId: EXPECTED_CHAIN.id })}>
      Switch
    </Button>
  </div>
)}
```

Inline banner, not a popup. Don't error out — offer the fix.

## What to read next

- `references/layout-and-grid.md` — section padding, container widths
- `references/copy-rules.md` — UI copy patterns
- `frontend-ux/SKILL.md` — flow design
- `wallets/SKILL.md` — wallet patterns
