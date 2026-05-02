# The Four Questions

Most "is this idea good?" conversations end without an answer because the questions weren't sharp. This file is the four questions, in order, with example answers and red flags. If the user can't answer all four with specifics, the idea isn't ready to build.

For cheap tests once the idea is sharp, see `references/cheap-experiments.md`. For crypto-specific traps, see `references/web3-specific-traps.md`.

## Question 1: Who, exactly, is the user?

Bad answer: *"DeFi users"*, *"Crypto natives"*, *"People who care about decentralization"*

These aren't users — they're slogans. A real user has a job, a wallet history, a daily problem.

Good answer: *"Liquid stakers with $50K-$500K of stETH who are tired of manually rebalancing across 3 lending protocols every month."*

Or: *"Solo Solidity devs at hackathons who lose 2 hours setting up the first deploy and verify."*

Or: *"DAO operations leads at L2 ecosystems who run grants programs and need a way to track milestone delivery."*

You should be able to point at a specific person (real, named, in your network or visibly online) who fits. If you can't name three, you don't know your user yet.

### Calibration prompts

When the user gives a vague answer:

- "Tell me about a specific person who'd use this. First name + what they do."
- "What's their wallet doing right now?"
- "Where do they hang out — what Discord, what Telegram, what Twitter?"

If the answer is "I don't know" three times, validation work hasn't started.

## Question 2: What are they doing today instead?

Every problem already has a solution. Even if it's bad. Even if it's "they suffer in silence." If you can't articulate the alternative, you don't know if your solution is better.

Bad answer: *"Nothing — there's no good solution."*

This is almost always wrong. People don't sit on unsolved problems; they cope. Find out how.

Good answer: *"They run a spreadsheet that tracks 8 positions across Aave, Compound, Morpho, Spark. They check it weekly. When health factor drops, they manually rebalance on Etherscan because they don't trust web frontends with $200K positions."*

Now you know:
- The current cost (1 hour/week of pain)
- The current trust threshold (Etherscan only)
- The skill level (knows what health factor means)
- The volume signal ($200K positions)

### Calibration prompts

- "Walk me through what they do today, step by step, last time they had this problem."
- "What's their current pain on a 1-10 scale?"
- "What have they tried? What did they reject and why?"

If they can't tell you what users do today, the problem might not actually exist.

## Question 3: Why would they switch?

The bar to switch is high. People stay with bad solutions because switching costs energy. Your idea needs to clear the switching cost AND provide better value, in a way the user perceives quickly.

Bad answer: *"Because we're decentralized and they're not."*

Almost no real user cares about this except as a tiebreaker. If decentralization is your only edge, expect to win 0% of users who don't already have a decentralization preference (most users).

Good answer: *"Because today they spend an hour a week rebalancing manually. Our vault auto-rebalances against the same 4 protocols, with the same trust assumptions, and charges 0.5% of yield. The math works at $50K+ deposits — we save them an hour a week."*

The "why switch" should be quantifiable. Time saved, money saved, risk reduced, capability unlocked.

### The 10x rule

A new product needs to be roughly 10x better than the alternative on at least one dimension to overcome switching cost. Marginal improvements lose. Be honest about whether you have a 10x edge.

| Dimension | What 10x looks like |
|---|---|
| Cost | $100/mo → $10/mo, or $0.04/swap → $0.004/swap |
| Time | 60 min → 6 min |
| Effort | 20 steps → 2 steps |
| Capability | "couldn't do at all" → "now possible" |
| Trust | "trust an exchange" → "trustless" (only some users care) |

### Calibration prompts

- "What changes for them in one sentence after switching?"
- "Why didn't [Aave / Uniswap / existing competitor] do this already?"
- "Are you 10x better than the status quo, or 1.5x?"

If the answer is "1.5x cheaper" you don't have an idea, you have a feature for an existing product.

## Question 4: What's the cheapest test that could prove this?

The right test depends on the riskiest assumption. Three common assumption types:

**(A) Demand assumption: "users want this"**
- Test: landing page + paid ad, measure signups
- Cost: $200, 1 week
- Pass: 5%+ signup rate from targeted ad

**(B) Behavior assumption: "users will switch"**
- Test: concierge service (you do it manually for 5 users)
- Cost: your time, 2 weeks
- Pass: 3 of 5 users keep using it after the novelty wears off

**(C) Build assumption: "we can actually build this"**
- Test: prototype the riskiest contract on testnet
- Cost: 1-2 weeks of dev
- Pass: it works under realistic conditions

Most ideas have all three risks. Identify the most uncertain one and test it first.

### Calibration prompts

- "What's the one thing that, if false, kills the idea? Test that, not the easy stuff."
- "What experiment costs less than $1K and tells you whether to keep going?"
- "If you spent two weeks on the easiest version of this, and zero people used it, would you keep building?"

The last question is the gut check. If the answer is "yes, I'd keep building because I love the idea" — that's a hobby project, not a product. Be honest about which you're doing.

## Composite example

User says: *"I want to build a DAO tooling product."*

Pull through the four questions:

1. **Who?** *"DAOs."* → not specific. Push: *"OK, name 3 DAOs that have this problem."* → *"Optimism Collective, Arbitrum DAO, Gitcoin."* → better. Now: *"Who at those DAOs feels the pain?"* → *"Grant program managers."* → useful.

2. **What today?** → *"They use a Notion + Discord + occasional Telegram, manually update spreadsheets, follow up with grantees individually."*

3. **Why switch?** → *"Save 5-10 hours/week per program manager. Currently 30+ programs, ~50 PMs total. ~250-500 hours/week of org time."*

4. **Cheapest test?** → *"Build a 1-pager describing the workflow. Do 5 user interviews. If 4+ confirm pain at this level and willingness to pay $X/mo per program, build a Notion-replacement v0 (no contracts) for one DAO as a pilot."*

This is now a startable idea. The four questions surfaced specifics that turn an abstract pitch into a testable plan.

## When to abandon an idea

After running through these four questions, the right move is sometimes to stop. Signals:

- You can't find 3 specific users, even after 1 week of looking
- The "alternative" is "they don't have this problem at all"
- The 10x edge is "decentralization" with no other axis
- The cheapest test is "build the whole thing on mainnet" (means you can't actually test cheaply)
- You're not curious about the user — you're curious about the technology

There's nothing wrong with abandoning. It's cheaper than building. The cost of NOT abandoning a bad idea is months of your time.

## What to read next

- `references/cheap-experiments.md` — concrete test patterns
- `references/web3-specific-traps.md` — crypto failure modes
- `why/SKILL.md` — market thesis grounding
