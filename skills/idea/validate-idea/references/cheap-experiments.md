# Cheap Experiments

Once you have a clear user and a clear pain (from the four questions), the next step is to falsify your idea cheaply before spending months building. This file is a catalog of experiments by cost, with crypto-specific variants, and the success criteria that distinguish "validated" from "vanity metric".

For the four questions that lead here, see `references/four-questions.md`. For traps to avoid, see `references/web3-specific-traps.md`.

## Cost ladder

```
$0          5 user interviews                          1 day
$20-100     Landing page + waitlist                    3 days
$200-500    Landing page + paid ad                     1 week
$0          Concierge / manual MVP                     1-2 weeks (your time)
$500-2K     Twitter/X bounty for design feedback       1 week
$1K-5K      No-code prototype + paid distribution      2-3 weeks
$2K-10K     Single-contract testnet MVP                3-4 weeks
$10K+       Mainnet MVP (with audit)                   2-3 months
```

Always start at the top and go down only if the prior step doesn't falsify.

## User interviews

The single highest-signal cheap test. Done well, 5 interviews tell you more than 50 surveys.

**How:**
1. Find 5 people who match your "who, exactly" answer. Twitter DMs, Discord servers, Telegram groups, your own network.
2. 30-minute calls. No slides. Open-ended questions:
   - "Walk me through the last time you did [the thing]."
   - "What was hardest about it?"
   - "What did you wish existed?"
   - "What would have to be true for you to switch tools / try something new?"
3. Don't pitch. Don't lead. Listen for problems they describe, not validations of your idea.

**Pass criteria:**
- 3+ of 5 describe the same pain unprompted
- They use specific numbers (time spent, money lost, frequency)
- They've already tried at least one workaround
- They ask "when can I try it?" before you pitch

**Fail criteria:**
- They politely agree your idea sounds cool
- They can't recall a specific recent occurrence of the pain
- The pain is "would be nice if" not "currently costing me"

**Crypto-specific notes:**
- DM wallets you've identified by behavior. "Hi, I noticed you've used [protocol] X times this month — could I ask you 3 questions about how you use it?"
- Reading public on-chain behavior gives you better candidates than any survey.

## Landing page

A static page describing the product, with one clear CTA: enter email, get notified.

**How:**
1. One headline, one subhead, 3 benefits, 1 CTA. No fluff.
2. Tools: Framer, Carrd, plain Next.js + Vercel, or `<5 lines of HTML`.
3. Domain: borrow a subdomain, no need to buy a fresh one yet.
4. Drive traffic: Twitter post, relevant Discord drop, narrow Reddit subreddit.

**Pass criteria:**
- 5%+ visit-to-signup rate (good)
- 10%+ (very good — you're talking to the right people)
- Signups confirm they have the problem

**Fail criteria:**
- <2% signup rate from targeted traffic = headline + audience misaligned
- Lots of vague "looks cool" comments, no signups

**Crypto-specific notes:**
- Address-based signup (sign a message to subscribe) is high-signal: only people with wallets and the literacy to sign show up.
- Telegram groups can outperform email for crypto audiences.

## Paid ad to landing page

Better than organic for early validation because you control the targeting.

**How:**
1. Same landing page as above.
2. Ad targeting: very narrow. Specific subreddits, specific Twitter accounts as audiences.
3. Budget: $200-500 over 1 week.
4. Track: cost per email, signup rate, click-through rate.

**Pass criteria:**
- $5-10 cost per signup in a targeted niche
- Signups responsive when emailed for follow-up

**Fail criteria:**
- $50+ cost per signup = niche is wrong or pitch is wrong
- Clicks but no signups = page isn't communicating

## Concierge MVP

You manually do, for a small set of users, what your product would automate. Highest-signal next to user interviews.

**Examples:**

| Idea | Concierge version |
|---|---|
| Automated DeFi rebalancer | You DM the user when they should rebalance, walk them through it |
| DAO grants tracker | You manage their grants in Notion, share the tracker with them, charge them |
| NFT pricing oracle | You email them a daily floor-price email |
| Onchain reputation score | You manually compute it for their wallet, email a PDF |

**Pass criteria:**
- 3+ of 5 trial users keep using it after week 2
- Users start asking when it'll be self-serve / automated
- Users refer others without prompting

**Fail criteria:**
- Users politely use it once, never again
- They negotiate the price before any value delivered

This test is cheap in dollars but expensive in time. It's worth it because the signal is unambiguous.

## No-code prototype

Build with Bubble, Retool, Glide, or low-code. Even with a smart contract, you can wire to existing protocols (Uniswap router, Aave) without writing your own.

**Use when:**
- The riskiest assumption is "will users adopt the workflow?"
- The product is composable on top of existing primitives, not a new primitive

**Don't use when:**
- The riskiest assumption is "can we build the contract?" — testnet that instead
- You want to charge real money — no-code limits payment options

**Pass criteria:**
- Real users use it for real things, not just demos
- Some are willing to pay before you have a real product

## Testnet MVP

The smallest possible contract that does the riskiest thing. No frontend, just `cast` calls if needed.

**When:**
- Your risk is "can we build this with the right properties?" (gas, security, oracle freshness, MEV)
- You've already validated demand in cheaper ways

**How:**
1. Sketch the contract on paper first
2. Implement only the riskiest function
3. Deploy to Sepolia / Base Sepolia
4. Run real numbers through it
5. Have a security-conscious friend review (or `audit/SKILL.md` self-review with fresh agent)

**Pass criteria:**
- The contract behaves as expected under realistic conditions
- Gas / latency / state size are within budget
- No Critical/High findings from informal review

**Fail criteria:**
- Realizing mid-build that the construction is fundamentally different from what you imagined
- Discovering a constraint that breaks the use case (e.g., "we need to sort 10K elements onchain")

## When to use each test for which assumption

| Riskiest assumption | Best cheap test |
|---|---|
| "Users want this" | Landing page + paid ad to a narrow audience |
| "Users will switch" | Concierge MVP for 3-5 users |
| "We can build this" | Testnet MVP of the hardest function |
| "Economics work" | Spreadsheet model + sensitivity analysis (no test, just math) |
| "Distribution is possible" | Twitter/X thread or community post; measure response |
| "Trust threshold is right" | User interviews specifically about trust assumptions |

The biggest mistake: testing "can we build it?" first when the real risk is "will anyone use it?" Build risk is usually lower than demand risk for crypto products.

## Common cheap-experiment mistakes

- **Polling Twitter "would you use this?"** — meaningless. Crypto Twitter likes everything.
- **Asking friends.** They lie to be nice.
- **Surveys with leading questions.** "Would you pay for an automated rebalancer?" → 80% yes, 0% pay later.
- **Counting Discord joins as validation.** Joining is free; signal is talking and showing up next week.
- **Treating "we got 1,000 signups" as success.** It depends on the source. 1,000 from a viral tweet is noise. 100 from a targeted ad is signal.
- **Treating airdrop hunters as users.** They're hunting yield, not solving your problem.
- **Mainnet MVP as the validation.** Mainnet costs gas + audits + team time. By the time you launch, you've already spent the budget.

## What "validated" feels like

You'll know you have validation when:

- 3+ users describe the pain in the same words, unprompted
- You can list 10+ users by handle, not just "people"
- A few users are mildly annoyed that the product isn't built yet
- You have a clear, narrow first segment ("liquid stakers with $50K+", not "DeFi users")
- You feel a slight reluctance to build, because the user pain is so clear that the work is now obvious instead of exciting

The last one is the most reliable signal. Excitement is cheap. Slight reluctance to do the obvious work means you've done the validation right.

## What to read next

- `references/four-questions.md` — the inputs to a good experiment
- `references/web3-specific-traps.md` — crypto-flavored failure modes
- `roast-my-product/SKILL.md` — once a prototype exists, get external critique
