# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

**ethereum.new** — an AI-native CLI (`eth`) for founders to ship Ethereum dApps: idea → build → ship → audit → raise. Every Claude call is **grounded** in bundled ethskills markdown loaded as system context before the task prompt, eliminating hallucinated addresses and stale information.

## Build & Run

```bash
npm install
npm run build           # tsup → dist/index.js (ESM, shebang added)
npm run dev             # tsup --watch
npm run typecheck       # tsc --noEmit (strict mode)
node dist/index.js      # run the CLI
```

No test framework is configured yet. Quality gates are:
- `npm run typecheck` must pass (strict, `noUncheckedIndexedAccess`)
- `npm run build` must succeed
- `node dist/index.js doctor` must render without crashing
- `cd templates/defi-vault && forge test` for the reference template

## Architecture

### Agent Chokepoint

`cli/agents/runtime.ts::invoke()` is the **only** way to call Claude. Every agent goes through it. It:
1. Loads relevant ethskills via `cli/skills/registry.ts` → `cli/skills/loader.ts`
2. Injects skill content as system context ahead of the task prompt
3. Falls back to deterministic stubs when `ANTHROPIC_API_KEY` is missing

**Never call the Anthropic SDK directly.** Always use `invoke()`.

### Skill Routing

`cli/skills/registry.ts` maps each `TaskKey` to an array of `SkillSlug`s. Skills live as `skills/<phase>/<slug>/SKILL.md` under the repo root (phases: `idea`, `build`, `audit`, `ship`) — never fetched from network. The loader walks all phase folders once and resolves by slug, so the registry doesn't care which phase a slug lives under. Same files double as slash-command skills via `eth init`, which copies them into `~/.claude/skills/` and `~/.codex/skills/`.

### Agents

Each agent in `cli/agents/` exports `async function run<Role>(input): Promise<Output>` and calls `invoke()`. Models: Opus for architecture/audit/review decisions, Sonnet for iteration/building. The auditor is always a separate agent from the builder (ethskills requirement).

### Commands

Eight commands registered in `cli/index.ts`: `new`, `idea`, `build`, `audit`, `ship`, `raise`, `doctor`, `init`. Each lives in `cli/commands/<name>.ts` exporting `async function cmd<Name>(argv: string[])`. `init` is a local-only command (no Claude calls) that mirrors the bundled skills into agent skill directories.

### Chain Registry

`cli/chains/registry.ts` defines 5 chains (mainnet, base, arbitrum, optimism, zksync) each with an RPC, explorer, testnet config, and a "superpower" rationale. Default chain is Base. `cli/chains/recommend.ts` heuristically maps a brief to a chain suggestion.

### Template System

`cli/templates/copy.ts::copyTemplate()` copies a skeleton into the working directory. Reference template: `templates/defi-vault/` (ERC-4626, Foundry tests, Scaffold-ETH 2 frontend).

## Conventions

- **TypeScript strict mode**, ESM-only, Node 20+. tsconfig `rootDir` is `cli/` — code outside `cli/` is not compiled.
- **All user-visible strings** go through `cli/ui/prompt.ts` helpers, never raw `console.log` in commands.
- **All file writes** go through `cli/util/fs.ts::writeProjectFile()` — it runs the secret scanner from `cli/util/env.ts` before writing.
- **No emojis** anywhere (code, output, docs).
- **Minimal dependencies**: core is `@anthropic-ai/sdk`, `@clack/prompts`, `picocolors`. Justify any addition.
- **No comments** by default. Only when the *why* is non-obvious.
- **Error copy**: one short sentence with what to do next.
- **Foundry only**, no Hardhat. Scaffold-ETH 2 for frontend.
- **`@clack/prompts` quirk**: always call `p.isCancel()` on prompt results before casting. The wrapper in `cli/ui/prompt.ts` handles this — use it instead of calling `@clack/prompts` directly.

## Adding Things

**Command**: create `cli/commands/<name>.ts`, register in `cli/index.ts`, use `invoke()` for Claude calls, `prompt.ts` for UI, `writeProjectFile` for writes.

**Skill**: add `skills/<phase>/<slug>/SKILL.md` (with `name` + `description` frontmatter), add slug to `SkillSlug` union in `cli/skills/registry.ts`, add to relevant task arrays in `SKILLS`. Phase placement is filesystem-only; the loader resolves by slug.

**Chain**: add to `cli/chains/registry.ts` with a "superpower", add heuristic rules to `cli/chains/recommend.ts`.

**Template**: create `templates/<name>/` mirroring `defi-vault/` structure, add to template union in `cli/agents/architect.ts`.

**Agent**: create `cli/agents/<role>.ts` with `run<Role>()`, call `invoke()` only, wire into the relevant command.

## Gotchas

- `cli/skills/loader.ts` uses a `CANDIDATES` array to resolve the `skills/` directory from both source and dist paths, then walks `<phase>/<slug>/SKILL.md` once to build a slug→path index — be aware when changing the build layout. Duplicate slugs across phases throw at index time.
- `corpus.json` uses `import ... with { type: "json" }` — requires Node 20.10+ and `resolveJsonModule: true`.
- The Plan JSON parser in `cli/agents/architect.ts` is crude (regex + `JSON.parse`). If Claude wraps JSON in backticks, it falls through to the default plan.
- No end-to-end test exists yet. Agents haven't been verified against a real API key producing valid Solidity.

## Config & Environment

- Global config: `~/.ethereum.new/config.toml` (chain, rpc, keys)
- `ANTHROPIC_API_KEY` env var takes precedence over config file
- Chain RPC overrides: `MAINNET_RPC`, `BASE_RPC`, `ARBITRUM_RPC`, `OPTIMISM_RPC`, `ZKSYNC_RPC`
