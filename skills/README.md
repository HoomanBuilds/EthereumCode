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
    eth-beginner/SKILL.md
    validate-idea/SKILL.md
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
    debug-contract/SKILL.md
    design-taste/SKILL.md
    frontend-design-guidelines/SKILL.md
    number-formatting/SKILL.md
    page-load-animations/SKILL.md
    roast-my-product/SKILL.md
  audit/
    audit/SKILL.md
    qa/SKILL.md
  ship/
    ship/SKILL.md
  launch/
    apply-grant/SKILL.md
    create-pitch-deck/SKILL.md
    submit-to-hackathon/SKILL.md
```

Each `SKILL.md` carries `name` + `description` frontmatter so agent runtimes can show a useful catalog entry.

## refreshing

These files are a snapshot. Re-fetch from upstream:
```bash
for s in why concepts l2s eth-beginner validate-idea; do
  curl -sSf -o "skills/idea/$s/SKILL.md" "https://ethskills.com/$s/SKILL.md"
done
for s in standards security tools addresses gas testing building-blocks \
         frontend-ux frontend-playbook wallets orchestration indexing noir protocol \
         debug-contract design-taste frontend-design-guidelines number-formatting \
         page-load-animations roast-my-product; do
  curl -sSf -o "skills/build/$s/SKILL.md" "https://ethskills.com/$s/SKILL.md"
done
for s in audit qa; do
  curl -sSf -o "skills/audit/$s/SKILL.md" "https://ethskills.com/$s/SKILL.md"
done
curl -sSf -o "skills/ship/ship/SKILL.md" "https://ethskills.com/ship/SKILL.md"
```

## license

ethskills is MIT-licensed. Upstream: https://github.com/ethskills/ethskills
