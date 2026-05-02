# Vercel and Monorepo Deploys

When you'd pick Vercel over IPFS, how to make Scaffold-ETH 2's monorepo build there, and the OOM / cache / env-var traps that bite specifically on Vercel + a multi-package repo.

## When Vercel beats IPFS

| Need | Vercel | IPFS |
|---|---|---|
| Server-side rendering, route handlers, ISR | yes | no |
| Image optimization | yes | needs custom loader |
| Edge functions / middleware | yes | no |
| Decentralized hosting | no | yes |
| Free up to a substantial volume | mostly | yes |
| ENS-native URL | needs proxy | native |
| Roll back to last deploy | one click | wait for ENS update |

If the dApp is purely static (read events from chain, render UI, send tx), IPFS wins on alignment. If you need serverless backend (gating content, off-chain APIs, server-side ENS resolution caching), Vercel.

A common production split: **frontend on IPFS** + **backend API on Vercel**, with the IPFS site calling `https://api.myapp.com` for non-trust-critical reads.

## SE2 monorepo on Vercel

SE2 ships as a yarn workspaces monorepo:

```
my-dapp/
├── package.json
├── packages/
│   ├── foundry/         # Solidity contracts
│   └── nextjs/          # Frontend
└── yarn.lock
```

Vercel by default builds the repo root, expects a Next.js app there, and fails. You must point it at `packages/nextjs` and tell it to install workspaces from the root.

### Vercel project settings

| Field | Value |
|---|---|
| Root Directory | `packages/nextjs` |
| Install Command | `cd ../.. && yarn install --immutable` |
| Build Command | (leave default: `next build`) |
| Output Directory | (leave default: `.next`) |
| Node.js Version | 20.x or 22.x (avoid 25 — see below) |

Set via dashboard or `vercel.json`:

```json
{
  "rootDirectory": "packages/nextjs",
  "installCommand": "cd ../.. && yarn install --immutable"
}
```

### Common failures

| Symptom | Cause | Fix |
|---|---|---|
| "No Next.js version detected" | Root Directory not set | Set to `packages/nextjs` |
| "Cannot find module 'next'" | Install ran in `packages/nextjs/` only | `cd ../..` in install command |
| Build hangs forever | `yarn install` redownloading on every deploy | Check Vercel cache; bump cache version |
| OOM, exit code 137/129 | Build worker memory exceeded | Use `vercel --prebuilt` (build locally) |
| "Module not found: .../deployedContracts" | Foundry deploy not run before frontend build | Generate contracts file locally and commit it |

## OOM in monorepos

Vercel's free/pro tier has a build memory ceiling (~8 GB pro, less on hobby). SE2 + Hardhat or large Foundry projects can exceed this if both packages compile during `yarn install`.

Mitigations:

1. **`vercel --prebuilt`** — build locally, push the artifacts:
   ```bash
   cd packages/nextjs
   vercel build --prod
   vercel deploy --prebuilt --prod
   ```
   No remote build = no OOM. CI-friendly.

2. **Strip Foundry from install path** — use yarn's `--ignore-scripts` and skip the foundry workspace's postinstall:
   ```json
   // package.json (root)
   "scripts": {
     "vercel:install": "yarn workspaces focus @se-2/nextjs"
   }
   ```
   And set Vercel's install command to `yarn workspaces focus @se-2/nextjs`. This installs only the frontend's deps.

3. **Move heavy deps out of `dependencies`** — anything build-time goes to `devDependencies`; anything dApp-runtime stays.

## Environment variables

Vercel splits envs by environment (Production, Preview, Development). Do NOT just paste keys into "all environments" — preview deploys get production keys.

Recommended split:

| Variable | Production | Preview | Local |
|---|---|---|---|
| `NEXT_PUBLIC_RPC_URL` | Alchemy prod key | Alchemy preview key | Alchemy dev key |
| `NEXT_PUBLIC_TARGET_CHAIN` | `base` | `baseSepolia` | `foundry` |
| `NEXT_PUBLIC_PRODUCTION_URL` | `https://myapp.com` | (auto: vercel-generated URL) | `http://localhost:3000` |

Use Vercel's auto-generated `NEXT_PUBLIC_VERCEL_URL` for previews so each PR has a self-consistent OG image.

### Secrets that must NEVER be in Vercel env

- Wallet private keys (deployer keys belong in your local environment, not in CI/CD).
- Etherscan API keys for contract verification (can stay in `foundry/.env` locally).
- Anything starting with `NEXT_PUBLIC_` is exposed to the browser. Don't prefix secrets with it.

## Preview deploys for PRs

Every PR gets a preview URL. Useful for QA but two traps:

1. **OG metadata points at preview URL** — fine for testing, but if someone shares the preview, the `og:image` resolves at `vercel.app`. Don't share previews on social.
2. **Preview RPC keys** — if the preview tier of your Alchemy plan is rate-limited, every commit eats into it. Use a separate "preview" Alchemy app.

Optional: automate preview deploys → `forge test` against preview → comment results on PR.

## Custom domains

Vercel handles DNS:
- Add domain via dashboard.
- Point your registrar's CNAME at `cname.vercel-dns.com` (or A at the static IP for apex).
- Verify; Vercel issues a Let's Encrypt cert automatically.

For ENS-native serving on Vercel, you can't (Vercel won't serve to `.eth` resolvers). Use a CNAME like `app.myapp.com` pointing at Vercel and reserve `myapp.alice.eth` for IPFS — see `references/ens-and-domains.md`.

## Rollbacks and atomicity

Each deploy is a separate immutable URL. The current production deploy points one of them at the canonical domain.

```bash
# List recent deploys
vercel ls myapp

# Promote a previous deploy
vercel alias set https://myapp-abc123.vercel.app myapp.com

# Or via dashboard: Deployments → ... → Promote to production
```

A botched deploy is a 5-second rollback. IPFS rollback requires a new ENS tx.

## Build cache surprises

Vercel caches `node_modules` and `.next/cache` between builds. If your build mysteriously starts using stale data:

```bash
# Bust the cache
vercel deploy --force
```

Or set "Override the build cache" in dashboard. Don't bust it casually — first build with no cache takes 5–10× longer.

## Function and image limits

Vercel has runtime caps:
- Hobby: 10s execution, 1024 MB memory, 50 req/s.
- Pro: 60s, 3008 MB.
- Enterprise: configurable.

For an Ethereum dApp, server functions are usually thin (proxy RPCs, cache subgraph queries, sign minted tokens). Don't write a function that does multiple onchain calls in series — `eth_call` round-trips can blow the time limit.

## Scaffold-ETH-specific gotchas

- **`yarn deploy` updates `deployedContracts.ts`** — if Vercel only builds the `nextjs` workspace, that file might be stale. Commit it after every deploy of contracts to a chain you target.
- **`scaffold.config.ts` `targetNetworks`** — must list every chain you support, including the L2 testnet you preview against.
- **Burner wallet on production** — set `burnerWalletConfig.onlyLocal: true` (or `burnerWalletMode: "localNetworksOnly"` depending on SE2 version) so the prod build doesn't ship the burner-wallet UI.
- **`NEXT_PUBLIC_IGNORE_BUILD_ERROR=true` is for IPFS only** — do NOT carry it into Vercel; it hides build errors that should fail the deploy.

## Cost rough ranges (2026)

- Vercel Hobby: $0 (caps at 100 GB-hr/month, ~enough for prototypes).
- Vercel Pro: $20/user/month + usage.
- IPFS pinning: $0–$20/month for most static dApps.
- ENS: ~$5/year per name + ~$3–10 in gas per content-hash update on mainnet.

Hobby Vercel + free Pinata + $5/year ENS is enough to ship and scale a real dApp.

## Common pitfalls

- **Root Directory unset** → "No Next.js version detected" and many lost hours.
- **OOM on large monorepos** → use `vercel --prebuilt` and stop trying to make remote builds work.
- **Burner wallet visible in prod** → users see a "use a temporary wallet" CTA on a financial app. Disable for production.
- **Preview URL leaked** with prod ENV vars → preview deploys are public; treat them like prod for security.
- **Forgetting to commit `deployedContracts.ts`** → frontend builds with stale contract addresses; users send funds to nowhere.
- **Node 25 polyfill mismatch** → Vercel offers Node 22 max as of early 2026; if you bumped to 25 locally for IPFS, your Vercel build is on a different runtime. Match versions explicitly with `engines` in `package.json`.

## What to read next

- `references/ipfs-deploy.md` — alternative deploy target
- `references/ens-and-domains.md` — pointing names at either deploy
- `orchestration/SKILL.md` — three-phase build pipeline
- Vercel docs: https://vercel.com/docs/deployments/configure-a-build
