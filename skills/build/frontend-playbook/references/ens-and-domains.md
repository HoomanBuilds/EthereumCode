# ENS and Domain Setup

How a name in the user's address bar becomes the static site you deployed. Covers ENS subdomains, content hash records, gateway selection, classic DNS fallback, and verification. Read after `references/ipfs-deploy.md` — domains only make sense once you have a CID.

## The pieces

```
user types myapp.alice.eth.link in browser
        │
        ▼
DNS lookup: eth.link gateway resolves *.eth.link
        │  proxy reads ENS records for myapp.alice.eth
        ▼
ENS Registry → Resolver for myapp.alice.eth
        │  returns: contenthash = ipfs://bafy...
        ▼
Gateway fetches /ipfs/bafy.../ from IPFS
        │
        ▼
Returns the static site
```

The two ENS facts you can change as a developer:
1. The **content hash record** of the name → which IPFS CID to serve.
2. The **resolver** the name uses → which contract holds those records.

Most apps use the public ENS resolver (`PublicResolver`). Custom resolvers exist for advanced setups (CCIP-Read, programmatic records).

## Subdomain creation (one-time, parent-name owner)

Owner of `alice.eth` creates `myapp.alice.eth`. Done via:

- ENS Manager UI: https://app.ens.domains/<parent>.eth → Subnames → "New subname"
- Programmatically: call `setSubnodeRecord` on the parent's resolver.

Cost: gas only on mainnet (~$3–10 in 2026). Subdomain is owned by the parent's owner unless you transfer it.

## Setting the content hash

Two ways:

### UI (simplest)

`https://app.ens.domains/myapp.alice.eth` → Records → Edit → Other tab → Content Hash: `ipfs://bafy...`. Save → confirm in wallet.

### Script

```ts
import { createWalletClient, http, namehash, encodeFunctionData } from "viem";
import { mainnet } from "viem/chains";
import { contentHash } from "@ensdomains/content-hash";

const node = namehash("myapp.alice.eth");
const cid = "bafybeib...";    // your CIDv1
const encoded = "0x" + contentHash.encode("ipfs", cid);

const wallet = createWalletClient({ chain: mainnet, transport: http(RPC), account });
await wallet.writeContract({
  address: PUBLIC_RESOLVER,    // 0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63
  abi: resolverAbi,
  functionName: "setContenthash",
  args: [node, encoded],
});
```

Updates take effect after the tx confirms. Most gateways respect changes within 60 seconds.

## Gateways for `.eth` names

| Gateway | URL form | Notes |
|---|---|---|
| eth.link | `myapp.alice.eth.link` | Cloudflare proxy → ENS → IPFS |
| eth.limo | `myapp.alice.eth.limo` | Privacy-focused alternative |
| Native (Brave) | `myapp.alice.eth` | Brave browser resolves natively |
| Native (Opera) | `myapp.alice.eth` | Opera Crypto |
| MetaMask Snap | `myapp.alice.eth` | With ENS Snap installed |

`.eth.link` works on most mobile browsers; `.eth.limo` doesn't always. Pick `.eth.link` as the canonical link in your social previews and `OG` tags.

## Verification (post-deploy)

```bash
NAME=myapp.alice.eth
NODE=$(cast namehash $NAME)
RPC=https://eth.llamarpc.com

# 1. Resolver address
RESOLVER=$(cast call 0x00000000000C2e074eC69A0dFb2997BA6C7d2e1e \
  "resolver(bytes32)(address)" $NODE --rpc-url $RPC)
echo "Resolver: $RESOLVER"

# 2. Content hash bytes (raw, encoded)
cast call $RESOLVER "contenthash(bytes32)(bytes)" $NODE --rpc-url $RPC

# 3. Gateway response
curl -s -o /dev/null -w "%{http_code}\n" -L "https://$NAME.link"

# 4. Specific route works (most-broken thing on IPFS)
curl -s -o /dev/null -w "%{http_code}\n" -L "https://$NAME.link/debug/"

# 5. OG image in HTML head
curl -s -L "https://$NAME.link" | grep -i 'og:image'
```

If (3) is 200 but (4) is 404, you've got the trailing-slash bug — see `references/ipfs-deploy.md`.

If onchain content hash matches your CID but gateway returns the OLD content for hours, force-purge: `curl -X POST "https://api.cloudflare.com/...purge_cache..."` (only works if you operate the gateway). Otherwise wait — eth.link cache TTL is short (~5 min) but stale-while-revalidate can extend.

## Classic DNS path (alternative)

If you have a regular domain (`myapp.com`) and want it to serve IPFS:

```
TXT record on _dnslink.myapp.com → "dnslink=/ipfs/bafy..."
```

Then anyone with a DNSLink-aware client (Cloudflare gateway, IPFS Companion) resolves `myapp.com` to the IPFS content. Update the TXT to deploy a new version.

For users without IPFS-aware clients, point an A record at a gateway:
```
myapp.com → gateway provider (CNAME to *.ipfs.dweb.link or similar)
```

This is centralized but works in every browser. Combine: DNSLink for crypto-native users, gateway A record for everyone else.

## Multi-name strategy

Production dApps typically use:

| Name | Purpose |
|---|---|
| `myapp.com` | Marketing, blog, docs (mutable, full SEO) |
| `app.myapp.com` | Live dApp (DNSLink → IPFS) |
| `myapp.alice.eth` | Crypto-native canonical |

Customize each with the right OG meta — search results from Google should land on `myapp.com`, sharing in crypto twitter should resolve to `myapp.alice.eth.link`. Use your `NEXT_PUBLIC_PRODUCTION_URL` per build to control which appears in `og:url`.

## CCIP-Read for L2 domains

If your name lives on an L2 (Basenames `.base.eth`, Linea Names `.linea.eth`), the resolver returns a CCIP-Read pointer. Browser clients with EIP-3668 support resolve transparently. Older tooling falls back to the ENS UniversalResolver:

```
UniversalResolver (mainnet): 0xce01f8eee7E479C928F8919abD53E553a36CeF67
```

When pointing a Basename at IPFS:
1. Set the content hash on the Base resolver.
2. Test with `https://basename.base.eth.link` (eth.link works for `.base.eth` as of Q1 2026).
3. Verify in a wallet that supports ENSv2 (MetaMask 12+, Rainbow 2025+).

## Reverse-resolution (for completeness)

A user's primary name (`alice.eth`) is the reverse record on their address. This is what your dApp displays — see `frontend-ux/references/address-and-name-ux.md`. Setting it:

```ts
// Reverse Registrar: 0xa58E81fe9b61B5c3fE2afD33CF304c454AbFc7Cb
await wallet.writeContract({
  address: REVERSE_REGISTRAR,
  abi: reverseRegistrarAbi,
  functionName: "setName",
  args: ["alice.eth"],
});
```

## Domain renewals and rug risk

ENS names have an expiry. If you build on a domain you don't own, you depend on the owner renewing. Always:

- Own the domain you ship under, or have a long lease.
- For subdomains under a third-party name, get a written lease + a backup.
- For DAO-owned names, multi-sig the owner role.

Domain reclamation + renaming has burned dApps. Subgraphs hardcode names; users bookmark. Migrating off a name is harder than buying it.

## Common pitfalls

- **Using a hex content hash instead of a `bafy...` CIDv1**: PublicResolver expects encoded `bytes`, not a string. Use `@ensdomains/content-hash` to encode.
- **Setting content hash on the wrong resolver**: if your name uses a non-PublicResolver, calling `setContenthash` on PublicResolver is a no-op for resolution.
- **Not setting `NEXT_PUBLIC_PRODUCTION_URL` to the `.eth.link` URL**: OG image points to localhost in shared links.
- **Using `.eth.limo` as canonical**: works on desktop, often fails on mobile and many email clients.
- **Forgetting subdomain creation tx**: trying to set content hash on a name that doesn't exist yet → tx reverts.
- **Mixing legacy resolvers**: pre-2022 resolvers don't support `contenthash`, only `text` records and addresses. Migrate to PublicResolver before setting.
- **Gateway TTL surprise**: eth.link caches positive responses; a 404 you saw an hour ago might still be 404 even after fix. Test from a fresh client (curl with `-H 'Cache-Control: no-cache'` or a different gateway).

## What to read next

- `references/ipfs-deploy.md` — generating the CID this points at
- `frontend-ux/references/address-and-name-ux.md` — ENS in the UI
- ENS docs: https://docs.ens.domains/
- DNSLink: https://docs.ipfs.tech/concepts/dnslink/
