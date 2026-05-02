---
name: apply-grant
description: Use when the user is applying for a crypto grant — Optimism RPGF, Arbitrum Foundation, Ethereum Foundation, Gitcoin, or chain-specific programs. Covers grant discovery, proposal structure, milestone planning, and avoiding the common rejection reasons.
---

# Apply for a Grant

## What You Probably Got Wrong

**"Grants are free money."** Grants are milestone-funded deliverables. A VC writes a check for equity; a grant program writes a check for work that benefits their ecosystem. Treat a grant like fundraising and you'll get rejected immediately.

**"I'll apply to every program."** Spray-and-pray applications get rejected. Each proposal must be tailored to that specific program's priorities. Reviewers can tell when you copy-pasted.

**"My project is great, they'll fund it."** Great is not enough. Alignment with the program's goals is the gate. If your project doesn't serve their ecosystem, nothing else matters.

For pitch decks see `create-pitch-deck/SKILL.md`. For hackathons see `submit-to-hackathon/SKILL.md`. For idea validation see `validate-idea/SKILL.md`.

## When to use

Trigger this skill when the user says:

- "Apply for Optimism RPGF"
- "Which grants should I apply for?"
- "How do I write a grant proposal?"
- "Arbitrum grant program"
- "Ethereum Foundation grant"
- "Budget for a grant application"

Do **not** use this skill if:

- The user has no validated idea yet (use `validate-idea`)
- The user wants an investor pitch deck (use `create-pitch-deck`)
- The user is preparing a hackathon submission (use `submit-to-hackathon`)

## Workflow

1. **Find the right program.** Don't spray applications. Read [references/program-landscape.md](references/program-landscape.md) for the major programs, what they fund, and what they don't.

2. **Verify eligibility before writing.** Many programs have hard requirements: open-source, deployed on their chain, prior track record. Read [references/eligibility-check.md](references/eligibility-check.md) — run the checklist first, write the proposal second.

3. **Structure the proposal.** Read [references/proposal-structure.md](references/proposal-structure.md) for the canonical sections and what reviewers actually score.

4. **Write milestones that are measurable.** "Build a vault" is not a milestone. "Deploy audited ERC-4626 vault on Base with Foundry tests, verified contracts, and documentation" is.

5. **Budget honestly.** Reviewers know what things cost. Under-budgeting signals inexperience; over-budgeting signals extraction. $80–$150/hr for Solidity devs is standard in grant budgets.

6. **Submit and follow up.** Most programs review in 2–6 weeks. If you don't hear back, that's the answer.

## The grant landscape

Programs open, close, and change priorities. Verify current status before applying.

| Program | Focus | Typical Size | Cycle |
|---|---|---|---|
| Optimism RPGF | Retroactive public goods on OP Stack | $5K–$100K+ | Rounds |
| Arbitrum Foundation | DeFi, tooling on Arbitrum | $10K–$250K | Rolling |
| Ethereum Foundation | Protocol-level, research, tooling | $5K–$50K | Quarterly |
| Gitcoin Grants | Public goods (quadratic funding) | $1K–$50K | Seasonal |
| Uniswap Foundation | Uniswap ecosystem, hooks | $10K–$100K | Rolling |
| Aave Grants | Aave integrations | $5K–$50K | Rolling |
| Base Ecosystem | Consumer apps on Base | $10K–$100K | Rolling |

Each program has different priorities. Optimism RPGF is retroactive — you need to have already shipped and shown impact. Arbitrum favors DeFi and tooling that increases TVL. EF funds protocol work, not dApps.

## What reviewers score

Most programs use a rubric:

```
Alignment with program goals      30%
Team capability / track record    25%
Technical feasibility             20%
Budget reasonableness             15%
Impact / reach                    10%
```

Alignment is the gate. If your project doesn't clearly serve the program's ecosystem, the rest doesn't matter.

## Milestone writing rules

- **One deliverable per milestone.** "Build vault + frontend + docs" is three milestones.
- **Include acceptance criteria.** How will the program verify completion?
- **Put the hardest milestone first.** If you fail early, the program can cancel.
- **Include testing in each milestone.** "Deploy contract" without "with Foundry tests" is incomplete.

```
Milestone 1: Core contract development ($8,000)
- Deliverable: ERC-4626 vault with deposit/withdraw, timelock, pause
- Acceptance: Foundry tests (unit + fuzz + fork), verified on Base Sepolia
- Timeline: Weeks 1–3

Milestone 2: Frontend integration ($6,000)
- Deliverable: Next.js frontend with wagmi, deposit/withdraw flow
- Acceptance: Deployed to Vercel, connects to deployed contract
- Timeline: Weeks 3–5

Milestone 3: Audit + mainnet deployment ($11,000)
- Deliverable: Security audit, mainnet deployment, documentation
- Acceptance: Audit report with no critical findings, verified on Base
- Timeline: Weeks 5–8
```

## Budget justification

```
Role              | Hours | Rate   | Cost
Contract dev      | 120   | $100   | $12,000
Frontend dev      | 80    | $100   | $8,000
Security audit    | —     | —      | $5,000
Total                      |        | $25,000
```

- Audit costs are pass-through — quote from actual auditor
- Don't include "team salary" — budget for deliverables, not people
- If you can't justify a line item, cut it

## What gets rejected

| Rejection reason | How to avoid |
|---|---|---|
| "Not aligned with our goals" | Read the program's published priorities; explicitly map your project |
| "Team has no track record" | Show GitHub, prior projects, or partner with someone who has shipped |
| "Budget too high" | Get actual quotes; show competitive rates |
| "Budget too low" | Signals you don't know what things cost; budget honestly |
| "Milestones unclear" | Use the structure above; include acceptance criteria |
| "Overly ambitious scope" | Cut to 3 milestones max; show what's v1 and what's future |
| "Copy of existing project" | Show what's different; link to competitors and explain the gap |

## The follow-up

- Most programs confirm receipt within 1 week
- Review takes 2–6 weeks
- If rejected, ask for feedback. Many programs share reviewer notes.
- If accepted, deliver on milestones on time. Missing a milestone burns the relationship.

## Post-hackathon grants

Hackathon winners get fast-tracked. Reference the hackathon result (judges, prize, demo link) in the proposal. You already have a deployed prototype — that's stronger than a cold application.

## What to read next

- `create-pitch-deck/SKILL.md` — investor pitch deck
- `submit-to-hackathon/SKILL.md` — hackathon track as a path to grant fast-tracking
- `validate-idea/SKILL.md` — make sure the idea is real before pitching
