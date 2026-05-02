# Phase Handoff Spec

Schema for `.ethereum.new/idea-context.md`, the cross-command memory file.

## Format

YAML frontmatter followed by named markdown sections:

```
---
slug: yield-vault-base
chain: base
phase: idea
created: 2026-05-01
updated: 2026-05-02
---

## Idea

Body...

## Why now

Body...
```

## Sections by command

| Command  | Writes                        | Reads  |
|----------|-------------------------------|--------|
| idea     | Idea, Why now, Open questions | no     |
| build    | Architecture, Open questions  | yes    |
| audit    | Audit findings                | yes    |
| ship     | Ship status                   | yes    |
| raise    | nothing                       | yes    |

## Rule

Agents **append** to sections, never overwrite. If a section already exists, new body is appended below existing content with a blank line separator.
