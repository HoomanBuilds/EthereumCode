# skills

Bundled snapshot of the [ethskills](https://github.com/ethskills/ethskills) knowledge base.

These files run in two places:

1. **API path.** `cli/skills/loader.ts` reads them and `cli/agents/runtime.ts::invoke()` injects them as system context into every Claude API call. No network fetch.
2. **Slash-command path.** `eth init` copies them into `~/.claude/skills/<slug>/` and `~/.codex/skills/<slug>/` so users can invoke them as `/why`, `/audit`, etc. inside Claude Code or Codex.

## layout

```
skills/
  SKILL_ROUTER.md         routing table — agents self-correct to the right skill
  idea/
    why/SKILL.md
    concepts/SKILL.md
    l2s/SKILL.md
  build/
    standards/SKILL.md
    security/SKILL.md
    tools/SKILL.md
    addresses/SKILL.md
    gas/SKILL.md
    testing/SKILL.md
    building-blocks/SKILL.md
    frontend-ux/SKILL.md
    frontend-playbook/SKILL.md
    wallets/SKILL.md
    orchestration/SKILL.md
    indexing/SKILL.md
    noir/SKILL.md
    protocol/SKILL.md
  audit/
    audit/SKILL.md
    qa/SKILL.md
  ship/
    ship/SKILL.md
```

Each `SKILL.md` carries `name` + `description` frontmatter so agent runtimes can show a useful catalog entry.

## refreshing

These files are a snapshot. Re-fetch from upstream:

```bash
for s in why concepts l2s; do
  curl -sSf -o "skills/idea/$s/SKILL.md" "https://ethskills.com/$s/SKILL.md"
done
for s in standards security tools addresses gas testing building-blocks \
         frontend-ux frontend-playbook wallets orchestration indexing noir protocol; do
  curl -sSf -o "skills/build/$s/SKILL.md" "https://ethskills.com/$s/SKILL.md"
done
for s in audit qa; do
  curl -sSf -o "skills/audit/$s/SKILL.md" "https://ethskills.com/$s/SKILL.md"
done
curl -sSf -o "skills/ship/ship/SKILL.md" "https://ethskills.com/ship/SKILL.md"
```

## license

ethskills is MIT-licensed. Upstream: https://github.com/ethskills/ethskills
