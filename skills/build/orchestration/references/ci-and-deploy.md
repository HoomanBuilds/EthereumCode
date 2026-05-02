# CI and Deploy Automation

How to automate the build, test, and deploy pipeline without making the agent the on-call engineer. This file is the CI shape that fits SE2's monorepo + the boundaries between automatable and human-required steps.

For the manual flow these scripts automate, see `SKILL.md`. For phase gates the CI must enforce, see `references/phase-gates.md`.

## What CI should do (and not do)

| Action | Automate? | Notes |
|---|---|---|
| `forge build` | yes | Catches Solidity errors before reviewer reads PR |
| `forge test` (default fuzz runs) | yes | Fast feedback on every push |
| `forge test --fuzz-runs 10000` | nightly | Too slow for per-PR |
| Slither | yes | High/Medium fail the build |
| `forge coverage` | yes | Comment on PR; fail if drop below threshold |
| Frontend type-check | yes | `tsc --noEmit` |
| Frontend lint | yes | ESLint + Prettier |
| Frontend build | yes | catches build-time crashes (SSG, polyfill) |
| IPFS upload + ENS update | NO | requires wallet + human review |
| Contract deploy to mainnet | NO | requires deployer key signing |
| Contract verification | yes | after manual deploy, can be CI-driven |
| Pin to Pinata / IPFS provider | yes (if hosted with API key) | API key only, no signing key |
| Preview deploy | yes | Vercel previews per PR; never to mainnet ENS |

**Bright line**: anything that requires a private key signs in the open from the operator's machine, never CI. CI gets API keys (read/cache/upload), never signing keys.

## Baseline GitHub Actions

```yaml
# .github/workflows/ci.yml
name: CI
on:
  pull_request:
  push:
    branches: [main]

jobs:
  contracts:
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: packages/foundry } }
    steps:
      - uses: actions/checkout@v4
        with: { submodules: recursive }
      - uses: foundry-rs/foundry-toolchain@v1
        with: { version: stable }
      - run: forge --version
      - run: forge build --sizes
      - run: forge test -vvv
      - name: Slither
        uses: crytic/slither-action@v0.4.0
        with:
          target: "packages/foundry/"
          slither-args: --filter-paths "lib/|node_modules/"
          fail-on: medium

  frontend:
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: packages/nextjs } }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: yarn }
      - name: Install (workspace root)
        run: cd ../.. && yarn install --immutable
      - run: yarn lint
      - run: yarn typecheck
      - run: yarn build
        env:
          NEXT_PUBLIC_PRODUCTION_URL: https://example.com
          NEXT_PUBLIC_IGNORE_BUILD_ERROR: "false"

  coverage:
    runs-on: ubuntu-latest
    needs: contracts
    if: github.event_name == 'pull_request'
    defaults: { run: { working-directory: packages/foundry } }
    steps:
      - uses: actions/checkout@v4
        with: { submodules: recursive }
      - uses: foundry-rs/foundry-toolchain@v1
      - run: forge coverage --report summary --report lcov
      - uses: codecov/codecov-action@v4
        with: { files: packages/foundry/lcov.info }
```

## Nightly deep tests

Fuzz and invariant tests are too slow for per-push CI. Run them nightly:

```yaml
# .github/workflows/deep-tests.yml
on:
  schedule: [{ cron: "0 4 * * *" }]
  workflow_dispatch:
jobs:
  deep:
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: packages/foundry } }
    steps:
      - uses: actions/checkout@v4
        with: { submodules: recursive }
      - uses: foundry-rs/foundry-toolchain@v1
      - run: FOUNDRY_PROFILE=deep forge test --no-match-test "skipDeep" -vvv
      - if: failure()
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.create({
              owner: context.repo.owner, repo: context.repo.repo,
              title: `nightly deep tests failed (${context.runId})`,
              body: `See https://github.com/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`,
              labels: ["bug", "ci"],
            })
```

## Fork tests in CI

Fork tests need an RPC URL with high request limits. Use repository secrets, not public defaults:

```yaml
- run: forge test --match-path "test/fork/**" --fork-url ${{ secrets.MAINNET_FORK_RPC }}
  env:
    FOUNDRY_FUZZ_RUNS: 256
```

Cache the fork between runs if your provider supports it (Alchemy: yes for an hour). Without caching, each fork test eats ~50–500 requests.

## Pre-commit hygiene

Before code reaches CI, catch the obvious:

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.0
    hooks: [{ id: gitleaks }]
  - repo: local
    hooks:
      - id: foundry-fmt
        name: forge fmt
        entry: bash -c "cd packages/foundry && forge fmt --check"
        language: system
        files: \.sol$
      - id: typecheck
        name: tsc
        entry: bash -c "cd packages/nextjs && yarn typecheck"
        language: system
        files: \.(ts|tsx)$
        pass_filenames: false
```

## Contract deployment workflow

Deployment itself is manual (human signs), but the surrounding scripts are CI-friendly:

```yaml
# .github/workflows/verify-deploy.yml — runs AFTER manual deploy
on:
  workflow_dispatch:
    inputs:
      chain:
        type: choice
        options: [base, arbitrum, optimism, mainnet]
      address:
        type: string
        description: Deployed address
jobs:
  verify:
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: packages/foundry } }
    steps:
      - uses: actions/checkout@v4
        with: { submodules: recursive }
      - uses: foundry-rs/foundry-toolchain@v1
      - run: |
          forge verify-contract \
            ${{ inputs.address }} \
            contracts/YourContract.sol:YourContract \
            --chain ${{ inputs.chain }} \
            --watch
        env:
          ETHERSCAN_API_KEY: ${{ secrets.ETHERSCAN_API_KEY }}
```

Manual trigger from the GitHub UI. Inputs: chain + address. CI runs verification with the project's Etherscan key. No signing keys involved.

## IPFS preview per PR

Deploying to an IPFS preview gateway on every PR gives reviewers a real URL to click. Pin only — don't update ENS in CI:

```yaml
# .github/workflows/ipfs-preview.yml
on: [pull_request]
jobs:
  ipfs:
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: packages/nextjs } }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: yarn }
      - run: cd ../.. && yarn install --immutable
      - run: |
          NEXT_PUBLIC_PRODUCTION_URL="https://preview.example.com" \
          NODE_OPTIONS="--require ./polyfill-localstorage.cjs" \
          NEXT_PUBLIC_IPFS_BUILD=true \
          yarn build
      - name: Pin via Pinata
        id: pin
        run: |
          CID=$(curl -s -X POST \
            -H "Authorization: Bearer ${{ secrets.PINATA_JWT }}" \
            -F "file=@out/" \
            https://api.pinata.cloud/pinning/pinFileToIPFS | jq -r '.IpfsHash')
          echo "cid=$CID" >> $GITHUB_OUTPUT
      - uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              owner: context.repo.owner, repo: context.repo.repo,
              issue_number: context.issue.number,
              body: `IPFS preview: https://${{ steps.pin.outputs.cid }}.ipfs.dweb.link`,
            })
```

ENS update is **never** in CI — that requires the multisig signing on mainnet.

## Vercel previews

Vercel handles preview deploys automatically once the project is connected. Two settings need attention:

1. **Root Directory**: `packages/nextjs`
2. **Install Command**: `cd ../.. && yarn install --immutable`

Use a separate Vercel project for previews vs production, or scope environment variables by environment (Production/Preview/Development) in the Vercel dashboard. Don't ship production RPC keys to preview deploys.

See `frontend-playbook/references/vercel-and-monorepo.md` for the full Vercel setup.

## Secrets handling in CI

Three categories:

| Category | Examples | Where to store |
|---|---|---|
| API keys (read-only) | Alchemy, BaseScan, Pinata JWT | GitHub repo secrets, scoped to actions |
| Signing keys | Deployer EOA, multisig signer | Never in CI — local + hardware/KMS |
| Webhook secrets | Slack, Discord | Repo secrets |

GitHub repo secrets:
- Visible to anyone with admin access — keep contributor list small.
- Not visible to forks — PRs from forks can't read secrets (good for security, frustrating for full preview).
- Rotate quarterly; on-rotate, audit the GitHub Actions logs for past leaks.

## Branch protection

Enforce gates via branch protection on `main`:

- Require status checks: `contracts`, `frontend`
- Require coverage report
- Require 1+ reviewer (or 2 for security-sensitive paths via CODEOWNERS)
- Disallow force pushes
- Require signed commits (optional but cheap)

## CODEOWNERS

```
# .github/CODEOWNERS
packages/foundry/contracts/   @yourdao/security-team
packages/foundry/script/       @yourdao/deploy-team
.github/workflows/             @yourdao/devops
```

Forces a security-team review on contract changes. The agent submits the PR; the human reviews. This is the pattern that keeps an agent-driven project safe to ship.

## Deployment runbook (human-driven)

Even with all CI in place, the deploy itself runs from a human's terminal:

```bash
# 1. Cut a release branch
git checkout -b release/v1.2.0

# 2. Wait for CI green on the release branch

# 3. Tag locally + verify checksum on contract bytecode matches what CI built
forge build --sizes
sha256sum out/YourContract.sol/YourContract.json
# Compare to CI artifact

# 4. Deploy (Ledger or KMS-signed)
forge script script/Deploy.s.sol \
  --rpc-url $BASE_RPC \
  --ledger \
  --hd-paths "m/44'/60'/0'/0/0" \
  --broadcast --verify --etherscan-api-key $ETHERSCAN_API_KEY

# 5. Trigger CI verification workflow with the deployed address

# 6. Transfer ownership to multisig (separate tx, separate signer)
cast send $CONTRACT "transferOwnership(address)" $MULTISIG \
  --ledger --rpc-url $BASE_RPC

# 7. Push the release tag
git tag v1.2.0
git push --tags

# 8. Announce in deploy log + Discord/forum
```

## Common pitfalls

- **CI deploys to mainnet** → wallet key in GitHub secrets → first leak ruins everything. Make this structurally impossible.
- **CI fails silently on coverage drop** → set `fail_ci_if_error: true` on Codecov.
- **Forge submodules not cached** → CI re-clones forge-std + OZ on every run, slow. Use `actions/cache` keyed on `lib/`.
- **Frontend build CI uses different Node than local** → set `engines` in `package.json` and use `actions/setup-node` with that version.
- **PR previews leaking production secrets** → preview env in Vercel must be separate from production env.
- **CI uses public RPC** → rate-limited; flaky tests. Use a project RPC with a CI-tier rate limit.
- **Slither flakes on new high** → review the finding; if false positive, suppress with a `// slither-disable-next-line ...` annotation, not a global filter.
- **Coverage report comments forever** → use `unmodified-only: false` on Codecov to comment only on changed files.

## What to read next

- `references/phase-gates.md` — what CI must enforce at each gate
- `references/monorepo-layout.md` — directory shape this CI assumes
- `frontend-playbook/references/vercel-and-monorepo.md` — Vercel-specific CI
- `frontend-playbook/references/ipfs-deploy.md` — what `yarn build` produces for IPFS
- `wallets/references/key-management.md` — why CI never holds signing keys
