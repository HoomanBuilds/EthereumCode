# Address and Name UX

Addresses are identifiers users will paste, type, scan, and share — and a single wrong character means permanent loss. Name systems (ENS, Basenames, Linea Names, Smart Names) are the user-friendly layer on top. Treat both as a UX surface, not a string.

## Display: never raw

Every onchain address shown to the user should:

1. Resolve to a name when one exists.
2. Truncate consistently (`0x1234…5678`).
3. Show an avatar (ENS avatar, Blockie, or jazzicon) when space allows.
4. Have a one-tap copy and an explorer link.

Use a single `<Address>` component everywhere — the moment you have two ways to render an address in the codebase, they drift.

```tsx
import { useEnsName, useEnsAvatar } from "wagmi";

export function Address({ value }: { value: `0x${string}` }) {
  const { data: name } = useEnsName({ address: value, chainId: 1 });
  const { data: avatar } = useEnsAvatar({ name, chainId: 1, query: { enabled: !!name } });

  const display = name ?? `${value.slice(0, 6)}…${value.slice(-4)}`;
  return (
    <span className="inline-flex items-center gap-1.5">
      <Identicon address={value} avatar={avatar} />
      <button onClick={() => copy(value)} title={value}>{display}</button>
      <a href={`https://etherscan.io/address/${value}`} target="_blank" rel="noreferrer">↗</a>
    </span>
  );
}
```

ENS resolution happens against mainnet even when your dApp targets an L2 — primary-name records are stored on mainnet. Use `chainId: 1` explicitly.

## Resolution priorities

When showing a name for an address:

1. **Primary ENS name** (`.eth` reverse record) — verified primary identity.
2. **Basename** (`.base.eth`) on Base — Coinbase's primary-name service, reverse-resolvable.
3. **Linea Names** on Linea, **Mode Names** on Mode — chain-native equivalents.
4. **Truncated hex** as fallback.

Don't show forward-only matches: an address could be claimed by anyone in their forward record without owning the reverse. Always check the reverse record first (`useEnsName` does this for ENS).

ENSv2 Beacon contract on mainnet: `0x...` (verify against current docs). Read primary names from the registry `0x00000000000C2e074eC69A0dFb2997BA6C7d2e1e`.

## Input: validate, normalize, resolve

A user can paste:
- A hex address (`0x...`).
- A checksummed hex address (mixed case).
- An ENS name (`alice.eth`).
- A subdomain (`treasury.uniswap.eth`).
- A name from another resolver (Basenames, .lens, .crypto).

```tsx
import { isAddress, getAddress } from "viem";
import { useEnsAddress } from "wagmi";

function AddressInput({ onChange }: { onChange: (a: `0x${string}` | null) => void }) {
  const [raw, setRaw] = useState("");
  const looksLikeName = raw.includes(".");
  const { data: resolved } = useEnsAddress({
    name: looksLikeName ? raw : undefined,
    chainId: 1,
    query: { enabled: looksLikeName },
  });

  useEffect(() => {
    if (looksLikeName) {
      onChange(resolved ?? null);
    } else if (isAddress(raw)) {
      onChange(getAddress(raw));   // checksummed
    } else {
      onChange(null);
    }
  }, [raw, resolved]);

  return <input value={raw} onChange={(e) => setRaw(e.target.value.trim())} />;
}
```

Always:
- `getAddress()` to normalize before sending — checksummed form catches wrong-character paste mistakes that a lowercase-only path would let through.
- Show resolution result inline (`alice.eth → 0xabc…123`) so the user can verify before signing.
- Offer a "scan" action on mobile (camera → ENS or address from QR).

## Common name systems and their reverse status

| System | Forward (name → address) | Reverse (address → name) | Notes |
|---|---|---|---|
| ENS (`.eth`) | yes | yes (primary record) | Mainnet truth; works on L2 via CCIP-Read |
| Basenames | yes | yes | Base only; resolver published primary names |
| Linea Names | yes | yes | Linea only |
| `.lens` (Lens Protocol) | yes | partial | Polygon, social-graph integrated |
| Unstoppable Domains (`.crypto`, `.x`, etc.) | yes | yes | Polygon registry |

Production rule: resolve and reverse-resolve on the chain that owns that name system. Never trust `chainId: 1` reverse for `.base.eth` — it'll miss most of them.

## CCIP-Read for L2 names

ENS supports CCIP-Read (EIP-3668) — the resolver returns an off-chain gateway URL, the client fetches the answer, and the resolver verifies a signature. viem's `getEnsName` / `getEnsAddress` handle this transparently. For Basenames specifically, set `universalResolverAddress` on Base to the Basenames Universal Resolver.

```ts
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";

const baseClient = createPublicClient({
  chain: base, transport: http(),
});
// Resolves names on Base via L2 universal resolver
const addr = await baseClient.getEnsAddress({ name: "alice.base.eth" });
```

## Avatars and identity

ENS avatars can be IPFS, HTTPS, or NFT-pointer URIs (`eip155:1/erc721:0x.../123`). Resolve them with care:

- viem's `getEnsAvatar` handles IPFS gateway selection and NFT lookup.
- Fallback to a generated identicon (`@vechain/picasso`, `@download/blockies`) — never to nothing.
- Avatars from arbitrary URLs are an XSS-via-SVG vector if you embed them as `<img src=...>` without sandboxing. Use `sandbox` on iframe, or pin to a trusted gateway.

## Address selection in confirmation flows

Before any tx that sends to an address (transfer, withdraw to external, swap with custom recipient), show a confirmation card:

```
You're sending
  100 USDC ($100.00)
to
  alice.eth
  0xabc1...d234
```

Always show the resolved hex even when a name is present. A name-only confirmation hides resolver compromises (someone hijacks a name → users sign the wrong tx).

For high-value transfers, add an extra step: "Confirm address" with the user typing the last 4 hex chars. Coinbase, Kraken, and Safe do this for cold-wallet sends.

## Address book / contacts

If your dApp benefits from named recipients (DAO treasuries, recurring payees), local contact list:

- Stored client-side (localStorage or IndexedDB), never on a backend you don't control.
- Each entry: `(label, address, optional ENS, last_used)`.
- Surface in the address input as autocomplete with a clear "added by you" badge — distinguishable from globally-resolved names.

Don't auto-add every interacted address; let the user opt in. Suggestions for "save 0x… as 'Alice'" after a successful tx work well.

## Mobile: deep links and scans

- iOS / Android: register `ethereum:` URI handler so QR codes containing `ethereum:0xabc...?value=1e18` open your dApp with form prefilled.
- WalletConnect QR: don't conflate with address QR; both are legal but mean different things.
- Camera scan UX: instant feedback ("Address recognized: 0xabc…d234") before submitting.

EIP-681 is the standard for the URI format: `ethereum:<address>[@<chain_id>][/<function_name>]?[<param>=<value>...]`.

## Common pitfalls

- **Showing `address.toLowerCase()`**: loses checksum information; users miss copy/paste errors.
- **Using `address.slice(0, 6) + ... + address.slice(-4)` without monospace font**: characters drift visually; use a fixed-width font for hex.
- **Forward-only ENS check**: anyone can claim "vitalik.eth" in their forward record. Always reverse-resolve to verify.
- **Resolving ENS on L2 chain id**: returns nothing for most names. Always resolve on the right chain for the name system.
- **Showing only the name in confirmation**: resolver compromise → silent rug. Always show hex too.
- **Auto-saving every address to contacts**: privacy nightmare. Opt-in only.
- **No fallback when ENS is unreachable**: gateway down → app shows raw hex everywhere → users panic. Cache last-known names with timestamps.
- **Treating EIP-3770 chain-prefixed addresses (`eth:0x...`) as plain hex**: parse and show the chain badge. Critical for multi-chain dApps where the same hex on different chains means different things.

## What to read next

- `references/tx-state-machines.md` — recipient-input gating in send flows
- `addresses/SKILL.md` — verified protocol addresses
- ENS docs: https://docs.ens.domains/
- Basenames: https://www.base.org/names
