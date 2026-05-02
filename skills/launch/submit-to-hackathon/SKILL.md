---
name: submit-to-hackathon
description: Use when preparing a hackathon submission — ETHGlobal, ETHIndia, ETHDenver, or sponsor bounties. Covers what judges actually evaluate, repo packaging, demo video rules, sponsor prize alignment, and avoiding the reasons judges skip your project.
---

# Submit to a Hackathon

## What You Probably Got Wrong

**"Technical depth wins."** Hackathons are not graded on technical depth. They're graded in 3–5 minutes per project by tired judges who've seen 50 submissions. Your submission either reads in those 3 minutes or it doesn't.

**"I'll target every sponsor prize."** Selecting 12 prizes without meaningful integration gets you disqualified from all of them. Judges from sponsors can tell the difference between real integration and a name-drop.

**"I'll finish building at midnight and submit at 8am."** If you're still building features Sunday at 11am, you'll submit a broken demo. Submission packaging takes hours. Start early.

For pitch decks see `create-pitch-deck/SKILL.md`. For grant applications see `apply-grant/SKILL.md`. For idea validation see `validate-idea/SKILL.md`.

## When to use

Trigger this skill when the user says:

- "Submitting to ETHGlobal"
- "Hackathon project this weekend"
- "How do I package my submission?"
- "What do judges look for?"
- "Sponsor prize for [X]"

## Workflow

1. **Read the actual rules.** Most judges skip projects that don't meet basic requirements (open-source repo, deployed, demo video, etc). Read [references/submission-checklist.md](references/submission-checklist.md) — run it 2 hours before deadline.

2. **Pick prizes deliberately.** Don't try to win 12. Pick 2–3 sponsor tracks that align with what you're building. Read [references/sponsor-prize-alignment.md](references/sponsor-prize-alignment.md).

3. **Make the demo video count.** 90 seconds. Show product working, not slides. Read [references/demo-video.md](references/demo-video.md) for the exact structure.

4. **Package the repo for evaluators.** README at top, deployed contract addresses, `.env.example`, one-line "how to run." Don't make judges install 12 dependencies.

5. **Write a submission description that previews the demo.** Judges read the description before opening the video.

6. **Match the claim to the build.** "Fully decentralized cross-chain MEV-resistant solver" with 200 lines of code loses credibility.

7. **Working demo > comprehensive scope.** A swap that works > a swap-bridge-stake-vote MVP that doesn't.

## What judges actually evaluate

```
Technical complexity        25%
Originality / creativity    25%
Use of sponsor tech         20%
Polish / completeness       15%
Demo / pitch quality        15%
```

Sponsor prizes additionally weight "do they actually use our SDK." A submission that mentions sponsor X but doesn't call their API loses sponsor X.

## The judging reality

A judge has 3 minutes for the first-round filter. Hundreds of submissions to review. Their decision tree:

```
Does the README make sense in 30 seconds? → no → skip
Does the demo video play? → no → skip
Does the project actually work as shown? → no → skip
Does it use sponsor X tech meaningfully? → no → no prize from X
Is it interesting / well-built? → yes → consider
```

You're optimizing for surviving each cut.

## The submission package

1. **Short title.** "EthLend" not "Decentralized Permissionless Lending Protocol on Ethereum L2."
2. **One-line description.** What it does, in plain words.
3. **200–400 word longer description.** What you built, the problem, how the tech is used.
4. **90-second demo video.** Working product. No deck slides.
5. **Public GitHub repo.** With a README.
6. **Deployed contracts.** With addresses, on the prize chain. Verified.
7. **Live URL.** Not localhost.
8. **Tags / sponsor selections.** Pick the right prize tracks.

## The README

The first thing every judge sees:

```markdown
# ProjectName

One-line description.

[Demo video](URL) · [Live app](URL) · [Slides](URL)

## What it does
2-3 paragraphs: product, user, problem.

## How it works
1-2 paragraphs: contracts, chains, sponsor SDKs.

## Deployed contracts
- Vault: 0x... on Base Sepolia [explorer]
- Token: 0x... on Base Sepolia [explorer]

## Local development
git clone && yarn && yarn dev
(One paragraph max.)

## Tech stack
- Solidity (Foundry)
- Next.js + wagmi
- [Sponsor X] for [specific feature]

## Team
[Name] — Twitter / GitHub / role
```

Don't write a manifesto. Don't include 30 screenshots.

## The demo video

90 seconds. Hardest constraint of the whole submission.

```
0-10s    Hook: what is this, in one sentence
10-60s   Demo: actual product working, no slides
60-75s   Tech: how you used sponsor X / Y
75-90s   Close: what's next + GitHub URL on screen
```

Rules: real microphone, cut silence, show the wallet popup when signing, show the explorer link after tx confirms, record in 1080p. No slides. No Figma mockups. No background music.

## Common failures

| Failure | Fix |
|---|---|
| README is empty | Write the structure above |
| Demo video is 4 minutes | Cut to 90 seconds |
| Demo shows slides | Re-record showing the product |
| Contracts not deployed | Deploy to testnet, paste addresses |
| Contracts not verified | Run `forge verify-contract` |
| Live URL is localhost | Deploy to Vercel |
| Sponsor selected but not used | De-select or actually integrate |
| Title is generic ("DeFi App") | Pick a memorable name |
| Too many features, none working | Cut scope, ship 1 working feature |
| Code in private repo | Make it public |

## Time budget for the last day

```
Saturday 22:00     Core flow works end-to-end
Sunday 09:00       Deploy to testnet, verify contracts
Sunday 10:00       Polish the README
Sunday 11:00       Record demo video
Sunday 12:00       Submit
Sunday 13:00       Post-deadline polish
```

If you're still building features Sunday at 11am, you'll submit broken.

## The submission write-up

Most platforms (DoraHacks, Devpost, ETHGlobal) ask for a description:

```
ProjectName lets [user] do [thing] [10x better than alternative].

Problem: [one paragraph]
Solution: [one paragraph]
How it works: [one paragraph; mention sponsors]
What's next: [one paragraph]
```

250–350 words. Include the demo URL, live URL, GitHub URL.

## What to read next

- `create-pitch-deck/SKILL.md` — pitch deck for live presentations
- `apply-grant/SKILL.md` — post-hackathon grant follow-up
- `ship/SKILL.md` — ship the project beyond hackathon weekend
