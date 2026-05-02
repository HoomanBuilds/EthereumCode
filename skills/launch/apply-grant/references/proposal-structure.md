# Proposal Structure

The canonical grant proposal template. Most programs use a variant of this structure. Adapt to the specific application form, but keep the sections in this order.

## Section 1: Title

One line. Product name + what it does.

```
Good: "AutoVault — Auto-rebalancing yield vault on Arbitrum"
Bad: "A DeFi Protocol for the Future of Yield Farming"
```

## Section 2: Problem (150-250 words)

Describe the specific gap in the ecosystem. Name the user, the friction, and the cost.

Structure:
1. Who is affected
2. What they're doing today to work around it
3. Why that's inadequate
4. Why this matters to the program's ecosystem

```
Example:

Arbitrum users holding stablecoins currently split their deposits across
Aave, GMX, and Camelot to optimize yield. This requires manual monitoring,
multiple transactions, and understanding of three different protocols.
The average user earns 3.2% when a simple auto-rebalancer would deliver
4.1% — a 28% yield gap. As TVL grows to $10B+, this friction prevents
millions in unrealized yield from reaching Arbitrum users, making the
ecosystem less competitive vs. Base and Optimism.
```

## Section 3: Solution (200-300 words)

What you'll build, how it works, and why it solves the problem.

Structure:
1. Product description (one paragraph)
2. Key mechanism (one paragraph — just enough technical detail)
3. User experience (one paragraph — what the user sees and does)

```
Example:

AutoVault is an ERC-4626 vault that automatically rebalances stablecoin
deposits across Aave, GMX, and Camelot on Arbitrum based on real-time yield
comparisons. Users deposit once; the vault handles allocation and rebalancing.

The vault monitors APY across the three target protocols every 12 hours.
When the yield gap between the optimal and current allocation exceeds 0.5%,
it rebalances. A 48-hour timelock prevents rapid strategy changes. All
rebalancing transactions are executed through a single smart contract with
Flashbots Protect to prevent MEV.

Users interact via a simple deposit/withdraw interface. They see their
current allocation across protocols, projected yield, and a history of
past rebalances. No multi-step flows — deposit once, earn optimized yield.
```

## Section 4: Milestones (the most important section)

3-5 milestones. Each must have: deliverable, acceptance criteria, timeline, and budget.

Format:

```
### Milestone 1: [Name] — $X,XXX
**Deliverable:** [what you'll ship]
**Acceptance criteria:**
- [specific, verifiable condition 1]
- [specific, verifiable condition 2]
- [specific, verifiable condition 3]
**Timeline:** Weeks N-N
**Budget breakdown:**
- Role A: X hours × $Y/hr = $Z
- [other costs]
```

## Section 5: Team (100-200 words)

Who's building this and why they can do it.

```
[Name / Pseudonym] — [role]
Prior work: [project, link, metric]
Expertise: [specific area]

[Name / Pseudonym] — [role]
Prior work: [project, link, metric]
Expertise: [specific area]

If pseudonymous: Include GitHub profiles, deployed contract addresses,
and any prior grants or hackathon results.
```

## Section 6: Budget (table format)

```
| Category           | Cost    | Justification                      |
|--------------------|---------|------------------------------------|
| Smart contract dev | $12,000 | 120 hrs × $100/hr (ERC-4626 + tests)|
| Frontend dev       | $8,000  | 80 hrs × $100/hr (Next.js + wagmi) |
| Security audit     | $5,000  | Quote from [auditor name]          |
| Total              | $25,000 |                                    |
```

## Section 7: Timeline

```
Week 1-3:   Milestone 1 — Core contracts
Week 3-5:   Milestone 2 — Frontend
Week 5-8:   Milestone 3 — Audit + deployment
```

## Section 8: Risks & Mitigations

```
Risk: Audit finds critical vulnerability
Mitigation: Budget includes audit; timeline includes 2 weeks for fixes

Risk: Target protocol changes API / contract interface
Mitigation: Abstract protocol integration behind an interface; update adapter

Risk: Insufficient user adoption
Mitigation: Partner with [existing project] for distribution; apply for ecosystem co-marketing
```

## Section 9: Prior Work

Links to GitHub repos, deployed contracts, prior grants, hackathon results.

```
- GitHub: github.com/org/project
- Deployed: 0x... on Arbitrum [explorer link]
- Prior grant: [program name, amount, status]
- Hackathon: [event, prize, demo link]
```

## Section 10: Ecosystem Benefit

Why this specific program should fund you. Connect your project to the program's goals.

```
This project directly supports Arbitrum's goal of increasing DeFi TVL by:
1. Making yield optimization accessible to non-technical users
2. Driving deposits into existing Arbitrum protocols (Aave, GMX, Camelot)
3. Creating a composable building block for other DeFi applications
4. Differentiating Arbitrum's DeFi ecosystem from competing L2s
```

## Writing Tips

- **Be specific.** "Increase TVL by 5% in 6 months" is better than "grow the ecosystem."
- **Show, don't tell.** Links to code beat descriptions of capability.
- **Don't overpromise.** Reviewers have seen hundreds of proposals. Unrealistic projections destroy credibility.
- **Write for a technical audience.** Grant reviewers are developers. Use correct terminology.
- **Proofread.** Typos signal carelessness.
