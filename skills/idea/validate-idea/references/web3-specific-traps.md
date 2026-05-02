# Web3-Specific Validation Traps

Crypto has its own culture of false signals: airdrops, points, governance theater, "community", token-as-product. This file is the catalog of traps that make a bad idea look validated when it isn't.

For the four core questions, see `references/four-questions.md`. For the test catalog, see `references/cheap-experiments.md`.

## Trap 1: Mistaking airdrop hunters for users

**Symptom:** "We have 50K wallets interacting with our protocol."

**Reality:** They're farming a future airdrop. They'll leave the day rewards stop.

**How to detect:**
- High wallet count, low repeat usage per wallet
- Sudden spike when you announce points / a season
- Bot patterns (wallets created within hours of each other, same paths)
- 30-day retention near zero after rewards end

**Better signal:** Cohort retention 60+ days after rewards stop. Or: repeat usage from wallets with diverse on-chain history (i.e., real users with their own crypto life).

## Trap 2: Confusing Discord size with traction

**Symptom:** "We have 20K members in our Discord!"

**Reality:** Most are airdrop hunters and bots. Of the rest, 90% never post. Of the posters, 90% are asking when token.

**How to detect:**
- Mod the Discord for a week. Count daily active posters who aren't asking about the token.
- Look at message volume in product/feedback channels vs `#general`.

**Better signal:** Five users in the feedback channel reporting bugs and asking for features = real validation. 20K members of dead general chat = vanity.

## Trap 3: Token as a substitute for product-market fit

**Symptom:** "We'll launch a token to bootstrap the network."

**Reality:** A token attracts speculators. Speculators are not users. The token's price becomes the "product" and the actual product never gets built.

**How to detect:**
- Token launch is on the roadmap before any real users
- Tokenomics doc is more developed than the product spec
- The pitch starts with "the token captures value from..."
- Discord conversations are about price, not product

**Better signal:** Build the product first. Validate it. THEN consider whether a token is the right primitive for distribution / governance / incentives. If you can't articulate why the token specifically (vs a normal product), you don't need one.

## Trap 4: "Decentralization" as the only differentiator

**Symptom:** "Like [centralized incumbent], but decentralized."

**Reality:** The set of users who'll switch from a polished centralized product to a clunky decentralized one *purely because of decentralization* is small. They're already on the decentralized alternative.

**How to detect:**
- Your pitch deck has "censorship-resistant" before any concrete user benefit
- The decentralization is the answer to "why us"
- Real users in interviews don't bring up centralization as a pain

**Better signal:** Pick a UX axis where decentralization unlocks something. "We give you self-custody so your funds can't be frozen" is real for users who've been frozen. "We're decentralized" without the consequence is theater.

## Trap 5: Governance theater

**Symptom:** "Token holders will vote on..."

**Reality:** 0.5% of token holders vote. The vote is dominated by 3 whales and the team. Decisions get rubber-stamped. Nothing is actually governed.

**How to detect:**
- Look at governance vote turnout for similar protocols (typically <5%)
- Count distinct voters in the top 10 votes — usually <50 unique addresses
- The team has admin keys "for emergencies" that override governance

**Better signal:** A small, accountable team running ops, with governance reserved for parameters that genuinely benefit from broad input (treasury allocation, big strategy pivots). Don't theater-decentralize.

## Trap 6: TVL as validation

**Symptom:** "We have $50M TVL."

**Reality:** TVL is mercenary. Yield-driven capital moves at the speed of the next better farm. High TVL with no fee revenue = capital parking, not adoption.

**How to detect:**
- TVL / fees ratio extremely high (capital is sitting, not working)
- Capital concentration in 5-10 wallets (not retail, not real users)
- Outflows the day rewards drop

**Better signal:** Fee revenue, especially from non-incentivized users. 1,000 wallets paying $100K/year in fees is more validated than $50M parked TVL with $50K fees.

## Trap 7: "Crypto-native" is a euphemism for "tiny audience"

**Symptom:** "We're targeting crypto-native users initially."

**Reality:** ~5M people globally have ever used a DEX. Of those, maybe 500K are active monthly. Of those, your specific subsegment is 5-50K. That's your TAM ceiling at maximum penetration.

**How to detect:**
- Implicit assumption: "crypto-native" means "millions of users"
- No path defined for going beyond crypto-native

**Better signal:** Either (a) accept the small-niche reality and build a high-margin product, or (b) have a real path to non-crypto users that doesn't require them to "learn crypto" first.

## Trap 8: The retro / airdrop / season / points loop

**Symptom:** Adoption rises with new airdrop seasons, falls between them.

**Reality:** You're not running a product, you're running a slot machine. The "users" are speculators rotating through whatever has the next claim.

**How to detect:**
- Month-over-month active users tracks airdrop rumor cycles, not product improvements
- Bug reports are entirely about "did I qualify for the airdrop?"

**Better signal:** Steady usage growth uncorrelated with rewards events. Users complain about product issues, not about reward formulas.

## Trap 9: Gating "real" usage behind speculation

**Symptom:** A real product hidden inside a speculation wrapper. Examples: NFT-gated tools, token-gated communities for things that don't need gating.

**Reality:** You added a token-buy step before users can experience your product. You've reduced your funnel by 90%+ to capture revenue from the 10% who'll buy in.

**How to detect:**
- The product is genuinely useful but locked behind purchase
- Most signups don't convert past the buy-the-token gate

**Better signal:** Free or cheap entry. Charge for value, not for access. If your token is the only path to product, the token is the product.

## Trap 10: Hackathon-itis

**Symptom:** "We're building [hackathon-prize-winning idea]."

**Reality:** Hackathon judges optimize for novelty + demo polish. Users optimize for usefulness + reliability. The two don't overlap much.

**How to detect:**
- The pitch deck reads like a hackathon submission
- Roadmap items are "win [next hackathon]" not "ship feature for users"
- Excitement is from sponsors / VCs, not from a real user pipeline

**Better signal:** Users who'd use the thing whether or not there's a prize attached.

## Trap 11: Founder-ego patterns

**Symptom:** "I want to build the next Uniswap / Aave / Lido."

**Reality:** Those are 5-year, multi-team efforts with tens of millions in funding. "Next X" almost never wins; specific niches do.

**How to detect:**
- The pitch starts with comparisons to multi-billion-dollar protocols
- The team is 1-2 people, no funding, no specific niche
- Differentiation is "ours will be better" with no axis

**Better signal:** A specific use case where the established protocol is bad, with concrete users frustrated by the gap. Then build for that gap, not the whole market.

## Trap 12: Misreading "we'd love to have you on the podcast" as validation

**Symptom:** Crypto media coverage, podcast invites, conference panel slots.

**Reality:** The crypto press needs content. Coverage doesn't mean product validation. Many products with extensive press never find PMF.

**How to detect:**
- Press metrics dominate the user metrics in updates
- Coverage is about the team / story, not user outcomes

**Better signal:** A user case study where someone solved a real problem with the product, in their words. One unprompted such case study beats a podcast appearance.

## Composite filter

When the user pitches an idea, score it against these traps:

```
[ ] Real user, with a name and wallet behavior, not "DeFi users"
[ ] Pain quantified (time, money, frequency), not "would be nice"
[ ] Onchain reason that isn't decentralization-as-marketing
[ ] No token in v1 (or strong reason for one beyond fundraising)
[ ] Governance is real or absent, not theater
[ ] Funnel doesn't depend on speculation gates
[ ] Differentiation is a specific axis, not "ours will be better"
[ ] Cheap test is identified and starts within a week
```

If 2+ are unchecked, push back on the idea before building.

## What to read next

- `references/four-questions.md` — the validation interview
- `references/cheap-experiments.md` — what to actually test
- `why/SKILL.md` — market thesis grounding
