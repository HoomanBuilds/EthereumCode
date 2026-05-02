# Sponsor Prize Alignment

Most hackathons have more prize money from sponsors than from the event itself. Winning a sponsor prize requires genuine integration, not a name-drop. This guide covers how to pick the right sponsors and integrate meaningfully.

## How Sponsor Prizes Work

Sponsor prizes are funded by the sponsor (not the hackathon organizers). The sponsor's goal is:

1. **Developer adoption.** Get builders to use their SDK/chain/tool.
2. **Showcase capabilities.** Show what their product can do.
3. **Hiring signals.** Find talented devs who might join their team.

Your submission is evaluated by the sponsor's team, not the hackathon judges. They know their product. They can tell if you actually integrated it or just mentioned it.

## Picking the Right Sponsors

Don't try to win every prize. Pick 2-3 that align naturally with what you're building.

**Evaluation criteria:**

| Criteria | Question |
|---|---|
| Natural fit | Does this sponsor's product solve a real problem in your project? |
| Integration depth | Can you build something meaningful in a weekend? |
| Prize size | Is the prize worth the integration effort? |
| Competition | How many teams will target this prize? (popular = harder) |

**Example alignment:**

| Your Project | Good Sponsor Picks | Why |
|---|---|---|
| Yield aggregator | Chainlink (price feeds), Aave (lending) | Core to the product |
| NFT marketplace | IPFS/Pinata (storage), Alchemy (API) | Infrastructure needs |
| Privacy app | Semaphore (ZK proofs), Aztec (private transactions) | Core to the product |
| L2 bridge | Base (deployment chain), Optimism (OP Stack) | Deployment target |

## Integration Depth Levels

Sponsors evaluate integration depth. Here's what each level looks like:

### Level 1: Name-Drop (Rejection)

- Mention the sponsor in the README
- Don't actually use their product
- "Powered by [Sponsor]" with no integration

**Result:** Disqualified from the sponsor prize.

### Level 2: Surface Integration (Maybe)

- Import the SDK but barely use it
- One API call in the entire codebase
- Sponsor mentioned in the demo video for 5 seconds

**Result:** Possible small prize if competition is weak.

### Level 3: Meaningful Integration (Win)

- The sponsor's product is core to a feature
- Multiple touchpoints in the codebase
- Demo video shows the sponsor integration clearly
- README explains what the sponsor does for your project
- Link to the specific file where the integration lives

**Result:** Strong contender for the prize.

### Level 4: Showcase Integration (Top Prize)

- The sponsor's product enables something that would be impossible without it
- Your project demonstrates a novel use case for the sponsor's product
- The sponsor could use your project as a case study
- You've built something the sponsor's own docs didn't cover

**Result:** Almost certainly the winner.

## Sponsor-Specific Tips

### Chain Sponsors (Base, Arbitrum, Optimism, etc.)
- **Deploy on their chain.** This is the minimum.
- **Use their specific features.** Base: Coinbase Smart Wallet. Arbitrum: Stylus. Optimism: Superchain.
- **Mention their ecosystem.** "We chose Base because of Coinbase's distribution to 100M+ verified users."
- **Show on-chain data.** Transaction count, gas costs, deployment address.

### Infrastructure Sponsors (Alchemy, Tenderly, Infura, etc.)
- **Use their API in a visible way.** Dashboard, monitoring, debugging.
- **Show the integration in the demo.** "Here's the Tenderly simulation of our transaction."
- **Mention specific features.** Not just "we used Alchemy" — "we used Alchemy's Notify API for transaction alerts."

### DeFi Sponsors (Aave, Uniswap, Chainlink, etc.)
- **Actually call their contracts.** Don't mock the interface.
- **Use their specific version.** "Uniswap v4 with custom hooks" not "Uniswap."
- **Show the flow.** User action → their protocol → result.

### ZK/Privacy Sponsors (Semaphore, Aztec, Noir, etc.)
- **Build a real circuit.** Not a toy example.
- **Show the prove/verify flow.** This is the core ZK interaction.
- **Explain the privacy benefit.** What data is hidden and why that matters.

## What Sponsors Look For

When sponsor judges evaluate submissions, they score:

```
Uses our product meaningfully      40%
Technical execution                25%
Creativity / novelty               15%
Demo quality                       10%
Documentation / README             10%
```

The 40% for "uses our product" means a surface integration can't win. You need the sponsor's product to be a real part of your solution.

## Common Mistakes

| Mistake | Why it's bad | Fix |
|---|---|---|
| Selecting 12 sponsor prizes | Signals you're spamming, not targeting | Pick 2-3 |
| "We used [sponsor]" with one import | Not a real integration | Build a feature around it |
| No mention of the sponsor in the demo | Judges won't know it's there | Show it explicitly |
| Wrong sponsor version | "Used Chainlink" but it's Chainlink Functions, not price feeds | Be specific |
| Integrating after the submission | Too late | Integrate during the hackathon |

## The Sponsor README Section

Add this to your README for each sponsor you're targeting:

```markdown
## [Sponsor Name] Integration

We use [Sponsor's Product] for [specific purpose]. Here's how:

1. [Step 1 of what their product does in your project]
2. [Step 2]

Key file: `src/path/to/integration.ts`

This integration enables [specific capability] that would not be possible
with [alternative approach].
```
