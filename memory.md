# memory.md

Handoff notes for anyone (human or agent) picking up `ethereum-code` after the v0.1 scaffold session.

## what this repo is

An AI-native CLI framework for shipping on Ethereum. Modeled on [solana.new](https://www.solana.new) but sharper, deeper, and grounded in a bundled snapshot of [ethskills](https://github.com/ethskills/ethskills).

The binary is `eth`. The five engines are **idea → build → ship → audit → raise**. Every Claude call goes through a single chokepoint (`cli/agents/runtime.ts`) that injects the relevant ethskills markdown as system context before the task prompt.

GitHub: https://github.com/HoomanBuilds/EthereumCode
Local: `/Users/panther/Desktop/ethagent`

## what shipped in v0.1

- Full CLI skeleton: `cli/index.ts` dispatcher, seven commands (`new`, `idea`, `build`, `audit`, `ship`, `raise`, `doctor`), taste-layer UI primitives (theme, banner, prompt, stream).
- Four agents: `architect` (Opus), `builder` (Sonnet), `auditor` (Opus), `reviewer` (Opus), `raise` composite. All invoke through `runtime.ts` — never the SDK directly.
- Skills: **20 ethskills files bundled in `./skills/`** (not fetched). Routing table in `cli/skills/registry.ts` maps each task to its skill set. Loader reads from disk with in-memory memo.
- Chains: Base, Arbitrum, Optimism, zkSync, Mainnet registered with a "superpower" each. `recommend.ts` gives a local use-case → chain hint before the architect agent runs.
- Idea corpus: 50 tagged ideas seeded in `cli/ideas/corpus.json` (roadmap: grow to 500).
- Reference template `templates/defi-vault/`: ERC-4626 vault (cap, pause, reentrancy, 48h timelocked strategy rotation), unit + fuzz Foundry tests, chain-agnostic deploy script, Scaffold-ETH 2 frontend with the three-button flow.
- `setup.sh` idempotent installer, `SKILL.md` self-describing for other agents, `README.md` with dev guide + `docs/cli.svg` terminal mockup.
- Verified: `npx tsc --noEmit` clean, `tsup` build clean, `node dist/index.js --help` and `doctor` render correctly, `npm audit` reports 0 vulnerabilities across 140 deps.

## key decisions (and why)

1. **Skills are bundled, not fetched.** The first draft used `undici` to fetch `ethskills.com/<slug>/SKILL.md` at runtime with a 24h cache. The user corrected mid-session — wanted skills imported into the repo so there's no URL dependency and what ships is what every agent sees. `undici` was removed from deps; the loader now reads from `./skills/<slug>.md` on disk.
2. **Single chokepoint for Claude calls.** Every agent goes through `invoke()` in `cli/agents/runtime.ts` so skill injection, secret scanning, and graceful degradation (when `ANTHROPIC_API_KEY` is missing) happen in one place. Never bypass this.
3. **Auditor is a separate agent from the builder.** The ethskills `audit` skill explicitly warns: the agent that wrote the code should never audit its own code. Enforced by using a different `invoke()` call with a fresh context.
4. **Foundry only, no Hardhat.** Template `foundry.toml` is the source of truth.
5. **Scaffold-ETH 2 frontend pattern**: three-button flow (switch → approve → execute) is mandatory, exact allowances only, never `type(uint256).max`, reads via `useScaffoldReadContract`, writes via `useScaffoldWriteContract`.
6. **No global git config writes.** When pushing to GitHub we used `-c user.email=... -c user.name=...` flags so nothing persisted outside this repo.
7. **Secret scanner runs on every file write.** `cli/util/fs.ts::writeProjectFile` calls `scanForSecrets` from `cli/util/env.ts`. Adding a new write path means going through this helper — don't use raw `writeFile`.
8. **No emojis anywhere.** Output, code, comments, docs. It's a craft rule from the design philosophy section of the README.
9. **Chain default is Base.** If the heuristic finds nothing, fall back to Base — it's the most taste-forward starting chain for a new founder (consumer onboarding, Coinbase distribution, reasonable fees).

## non-obvious gotchas

- **Loader path resolution**: `cli/skills/loader.ts` uses `CANDIDATES` to resolve `skills/` from either source (`cli/skills → ../../skills`) or built (`dist/cli/skills → ../../../skills`). When publishing to npm, the `files` field in `package.json` includes `skills/` so the directory ships with the package.
- **tsconfig rootDir is `cli`**: anything outside `cli/` (e.g. `scripts/`, `templates/`) is not compiled. This is why `deploy.ts` lives at `cli/deploy/deploy.ts`, not `scripts/deploy.ts`. An earlier draft had it in `scripts/` and broke the build.
- **`@clack/prompts` has a quirk**: `p.isCancel` must be called on the result of each prompt before casting. Our wrapper in `cli/ui/prompt.ts` handles this — don't call `p.text` / `p.select` / `p.confirm` directly from commands.
- **Stub mode**: if `ANTHROPIC_API_KEY` is not set, `invoke()` returns a deterministic stub so the CLI still demos the shape of each flow. Stubs are not magical — they tell the user "set your key and re-run". Don't try to make them fake real output.
- **The `eth doctor` RPC check** reads from `~/.ethereum-code/config.toml`. There's no `eth doctor --init` yet — the `setup.sh` installer writes a placeholder, users edit by hand. On the roadmap.
- **The build command currently references a `scripts/deploy.ts`**  path that doesn't exist — fixed to `cli/deploy/deploy.ts`. If anyone re-introduces a top-level `scripts/` directory, verify the import.
- **`cli/ideas/corpus.json` is imported with `with { type: "json" }`** — needs node 20.10+ and `resolveJsonModule: true` in tsconfig. Both are already set; don't downgrade.

## what's pending / next steps

Roadmap sections in `README.md` are authoritative. Highest-priority items:

1. **v0.2 — five more templates** matching the quality bar of `defi-vault/`:
   - `nft-drop/` (ERC-721A + allowlist signing + Farcaster frame)
   - `dao-governance/` (OZ Governor + Tally)
   - `agent-wallet/` (ERC-4337 smart account + session keys)
   - `rwa-issuance/` (permissioned T-bill vault + allowlist NFTs)
   - `zk-privacy/` (Noir circuit + on-chain verifier)
2. **Vitest suite**: the repo has no JS tests yet. Smoke test that runs `eth new` end-to-end against a stub Anthropic server and diff-checks the output.
3. **Grow the idea corpus** from 50 to 500+ tagged ideas.
4. **`eth skills refresh`** command: pull newer versions of bundled ethskills files from upstream and show a diff.
5. **`eth doctor --init`**: interactive first-run config that writes `~/.ethereum-code/config.toml` based on answers.

## known risks (read before shipping)

- **No real end-to-end test** has been run — the agents invoke Claude successfully in theory, but nobody has run `eth build` with a real API key against the `defi-vault` template to confirm the builder agent actually produces valid Solidity edits.
- **The Plan JSON parser** in `cli/agents/architect.ts::parsePlan` is crude (regex + `JSON.parse`). If Claude wraps the JSON in backticks or prose, it'll fall through to the default plan. Worth tightening before shipping real users.
- **`forge` dependency missing from `eth build`** — the builder doesn't actually run `forge test` after generating code. It relies on the user running tests themselves. v0.2 should close this loop.
- **`ANTHROPIC_API_KEY` is read at every `invoke()` call** via a module-scoped client. If the user rotates mid-session it won't pick up the new one. Low-priority fix.
- **The `github_pat_11BKRB3...` token the user pasted for the initial push is still visible in this conversation's history** and should be rotated on GitHub. The local `.git/config` remote URL was scrubbed clean immediately after the push.

## how to run / verify locally

```bash
cd /Users/panther/Desktop/ethagent
npm install
npx tsc --noEmit                # strict typecheck
npm run build                    # tsup → dist/index.js
node dist/index.js --help
node dist/index.js doctor

# with a real key:
export ANTHROPIC_API_KEY=sk-ant-...
node dist/index.js new

# run the reference template's tests:
cd templates/defi-vault
forge install foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts
forge test
```

## coding conventions (enforced, not aspirational)

- TypeScript strict mode, `noUncheckedIndexedAccess`, ESM-only, Node 20+.
- Default to no comments. Only write a comment when the *why* is non-obvious.
- Every user-visible string goes through a `cli/ui/prompt.ts` helper — never raw `console.log` in a command.
- Every file write goes through `cli/util/fs.ts::writeProjectFile` so the secret scanner runs.
- Dependencies are expensive — core deps are `@anthropic-ai/sdk`, `@clack/prompts`, `picocolors`. Justify any addition.
- No emojis anywhere.
- Error copy is one short sentence with what to do next.

## attribution

- Inspired by solana.new.
- Grounded on a bundled snapshot of ethskills (MIT). See `skills/README.md` for refresh instructions and attribution.
- Agent runtime built on Claude (Opus 4.6 + Sonnet).
