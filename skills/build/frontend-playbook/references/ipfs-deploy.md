# IPFS Deploy Deep Dive

The mechanics behind a working IPFS deploy of a Next.js dApp — what `output: "export"` actually generates, why routes 404, how CIDs and gateways work, and how to verify a deploy without trusting any single gateway. Read after the playbook's high-level steps; this fills in the parts that break.

## What `output: "export"` produces

```
out/
├── index.html
├── 404.html
├── _next/
│   └── static/
│       ├── chunks/...
│       └── css/...
├── debug/             # only if trailingSlash: true
│   └── index.html
└── ...
```

Next produces one HTML file per route. Each HTML embeds the route's pre-rendered React tree, plus a `<script>` for hydration. After hydration, client-side navigation works as in normal Next.

Without `trailingSlash: true`, you get `debug.html` (a sibling), and IPFS gateways serve it as `/debug.html` — the URL `/debug` returns 404.

## Trailing slash, definitively

```ts
// next.config.ts
const isIpfs = process.env.NEXT_PUBLIC_IPFS_BUILD === "true";
const nextConfig = {
  reactStrictMode: true,
  images: { unoptimized: isIpfs ? true : undefined },
  ...(isIpfs && {
    output: "export",
    trailingSlash: true,
  }),
};
```

Why `trailingSlash` matters: gateways translate `/debug/` → `debug/index.html` automatically. They do NOT translate `/debug` → `debug.html`. This is a property of HTTP directory semantics, not IPFS specifically.

The cost: any internal `<Link href="/debug">` becomes `/debug/`. Anchor tags and external links should match. If you mix, you get redirect chains that double the load time.

## CIDs are content addresses

Every byte change in your `out/` folder produces a different CID. This is your deploy's identity. Two consequences:

1. **Same CID = same content.** If you redeploy and the CID didn't change, you didn't actually change anything (or your build was cached — see "stale build" below).
2. **No mutability.** The CID is immutable. Updates happen at the resolver layer (ENS content hash, DNSLink), not at the CID.

CID v1 (default with modern tooling): `bafy...` (32-char base32). CID v0: `Qm...` (legacy base58). They map 1:1 — `ipfs cid base32 Qm... → bafy...`. Your gateway URL works with both, but ENS prefers CIDv1.

## Stale-build detection

The single biggest IPFS footgun: you edit code, run `yarn ipfs`, and deploy yesterday's bundle.

```bash
# Required hygiene before every deploy
cd packages/nextjs
rm -rf .next out          # 1. Wipe artifacts

# 2. Run the full build (your env vars + flags here)
NEXT_PUBLIC_PRODUCTION_URL=... NODE_OPTIONS=... yarn build

# 3. Spot-check a recent change made it through
grep -l "string from your latest edit" out/_next/static/chunks/app/*.js

# 4. Compare timestamps — source MUST be older than out/
stat -f '%Sm' app/page.tsx
stat -f '%Sm' out/
```

Real CIDs change with content. If your last two deploys produced the same CID, the second was a no-op. Open `git diff` to figure out whether the issue is "I forgot to save" or "build cache returned stale".

## Gateways and how to verify

A gateway is an HTTP→IPFS bridge. They all serve the same content because the CID is content-addressed; a gateway either has it cached or fetches it from the IPFS network.

| Gateway | URL pattern | Notes |
|---|---|---|
| Cloudflare | `https://cloudflare-ipfs.com/ipfs/<CID>/` | Free, fast, cached aggressively |
| ipfs.io | `https://ipfs.io/ipfs/<CID>/` | Protocol Labs canonical |
| BuidlGuidl | `https://community.bgipfs.com/ipfs/<CID>/` | Used by SE2's `yarn bgipfs upload` |
| dWeb.link | `https://<CID>.ipfs.dweb.link/` | Subdomain-based (better cookie isolation) |
| Pinata | `https://gateway.pinata.cloud/ipfs/<CID>/` | Tied to Pinata pinning |

Always verify across 2–3 gateways:

```bash
CID=bafy...
for gw in cloudflare-ipfs.com ipfs.io community.bgipfs.com; do
  echo "$gw"
  curl -s -o /dev/null -w "  %{http_code} %{size_download}b\n" -L "https://$gw/ipfs/$CID/"
  curl -s -o /dev/null -w "  %{http_code} %{size_download}b\n" -L "https://$gw/ipfs/$CID/debug/"
done
```

If one gateway is slow/404 but others work, the deploy is fine — the gateway hasn't fetched the content yet. Wait or pin to a faster service.

## Pinning

Uploading to a gateway is not the same as pinning. Without a pinning service, your content can be garbage-collected by the gateway's storage policy in days/weeks. Production deploys MUST be pinned.

Options:
- **Pinata**: free tier 1 GB; paid plans for more.
- **Filebase**: S3-compatible API, IPFS pinning under the hood.
- **web3.storage**: decentralized + Filecoin backup.
- **BuidlGuidl IPFS** (`bgipfs`): SE2's default; pins via the BG ecosystem.
- **Self-hosted Kubo**: run your own node and pin locally — you're responsible for uptime.

Verify pinning succeeded:

```bash
# If your service exposes pin status:
curl -H "Authorization: Bearer $PINATA_JWT" \
  "https://api.pinata.cloud/data/pinList?hashContains=$CID"
```

## Static-export traps

Anything that requires a Node runtime fails:
- `getServerSideProps` (deprecated in App Router but still seen).
- Route handlers (`app/api/...`) that return runtime data.
- `dynamic = "force-dynamic"`.
- Image optimization (`next/image` with default loader).
- Middleware.
- ISR (revalidate at request time).

If you depend on any of these, IPFS is the wrong target. Use Vercel or split: static IPFS frontend + serverless backend on a separate domain.

## Runtime: client-only code at module scope

`output: "export"` runs your pages through SSG. A page that imports a module which calls `localStorage` at the top level crashes the build:

```tsx
// app/some/page.tsx
import "wagmi";   // wagmi reads localStorage at import → boom on SSG
```

Two fixes:

1. **Dynamic import with `ssr: false`** for the offending component:
   ```tsx
   const SomeWalletThing = dynamic(() => import("./SomeWalletThing"), { ssr: false });
   ```

2. **Polyfill localStorage / window** for the build process. SE2 does this with `polyfill-localstorage.cjs` + `NODE_OPTIONS=--require ./polyfill-localstorage.cjs`. The polyfill must come via `--require` because Next spawns build workers; per-process injection is the only thing that reaches all of them.

## Image strategy

`next/image` default loader requires a Node server. For static export:

```ts
images: {
  unoptimized: true,             // serve raw images
  // OR
  loader: "custom",
  loaderFile: "./image-loader.ts",  // resolve via Cloudinary / imgix
}
```

If you go `unoptimized`, ship images optimized at build time (squoosh, sharp). A 2 MB hero PNG will hurt your Lighthouse and your gateway bandwidth.

## Cache-control

Gateways set their own caching. You can hint via `_headers` (Cloudflare format) but most gateways ignore it. The CID itself is the cache key — if you redeploy, get a new CID, and update DNSLink/ENS, the old CID is still served to people who bookmarked it.

For a ENS site: short DNS/CCIP TTL is irrelevant; clients re-resolve the content hash on each load. Update the content hash → clients see new content within minutes.

## CI deploy

```yaml
# .github/workflows/deploy.yml
name: Deploy IPFS
on: { push: { branches: [main] }, workflow_dispatch: {} }
jobs:
  ipfs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: yarn }
      - run: yarn install --immutable
      - run: |
          cd packages/nextjs
          rm -rf .next out
          NEXT_PUBLIC_PRODUCTION_URL=${{ secrets.PROD_URL }} \
          NODE_OPTIONS="--require ./polyfill-localstorage.cjs" \
          NEXT_PUBLIC_IPFS_BUILD=true \
          yarn build
      - name: Pin via Pinata
        id: pin
        run: |
          # Walk out/ → upload → capture CID
          # Pinata API: POST /pinning/pinFileToIPFS
      - name: Comment CID on commit
        run: gh api ... --raw "$(echo "Deployed: ${{ steps.pin.outputs.cid }}")"
```

Don't auto-update ENS from CI — that requires a wallet signing key. Keep ENS updates manual: human reviews preview gateway, then signs.

## Observability

Browser console errors after deploy are likelier than after `vercel deploy`. Sources:
- Mixed content (loading HTTP from HTTPS page).
- Hard-coded `localhost` URLs in env-merged config.
- `window` or `document` access in code that ran during SSG.

Wire `Sentry.init({ dsn })` in `app/error.tsx` before launch.

## Common pitfalls

- **Deploying without `rm -rf .next out`** → stale chunks shipped.
- **`trailingSlash: false`** → all routes 404 except `/`.
- **No `NEXT_PUBLIC_PRODUCTION_URL`** → OG image points to `localhost:3000` in social previews.
- **Forgetting `unoptimized` on images** → build fails or images broken at runtime.
- **Trusting one gateway** to verify a deploy → looked good locally, broken for users on a different gateway.
- **Not pinning** → site disappears in 2–6 weeks.
- **Mixing `Link` and `<a>` for internal nav** → trailing-slash redirect chains double load time.
- **Service worker caching old CID's URLs** → users see stale pages even after content-hash update. Disable SW for IPFS sites or version the cache.

## What to read next

- `references/ens-and-domains.md` — pointing names at the CID
- `references/vercel-and-monorepo.md` — alternative target
- `frontend-ux/SKILL.md` — UX rules that should hold post-deploy
- IPFS docs: https://docs.ipfs.tech/
