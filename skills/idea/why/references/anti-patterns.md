# Anti-Patterns: Common Mistakes When Building on Ethereum

This file is a checklist of mistakes founders, agents, and engineers make when starting an Ethereum project. Read before recommending a chain, an architecture, or a token model. The goal is to recognize the failure mode before the user commits to it.

Each section names the anti-pattern, gives a short diagnostic, explains the failure mode, and prescribes the alternative.

## Chain Selection

### Anti-Pattern: "We'll launch on a brand new L1 because they're paying us to"

**Diagnostic:** Founder mentions a non-public-EVM chain (Sui, Aptos, a new "high-performance" L1) and the reason is grant money or marketing partnership.

**Failure mode:**
- Liquidity will not exist. You will be incentivizing trades with token emissions for 12+ months.
- Tooling gaps will eat your engineering time. Foundry, Hardhat, ethers, viem, wagmi all assume EVM. On non-EVM chains, you'll write equivalents from scratch or use immature SDKs.
- Bridge risk: assets must come from somewhere. The bridge will be hacked. ($3B+ stolen from cross-chain bridges since 2021.)
- When the grant runs out, the chain's narrative collapses, and your liquidity walks. Sustainable user acquisition requires the chain to outlive the marketing budget.

**Alternative:** If the founder needs grant funding, get it from Ethereum Foundation, Optimism RetroPGF, Arbitrum DAO, or Base. Same money, no chain risk.

### Anti-Pattern: "We'll be multi-chain on day one"

**Diagnostic:** Pre-launch product targeting 4+ chains simultaneously to "maximize TAM."

**Failure mode:**
- Liquidity splits 1/N — you have 1/4 the depth on each chain.
- Audit cost roughly multiplies (1.3-1.5N) — different chains have different gas profiles, different precompiles, different opcode availability.
- Ops burden multiplies (RPC monitoring, indexer redundancy, deployment scripts, alerting per chain).
- Cross-chain state synchronization is hard. Either you accept eventual consistency (and explain it to users) or you build a custom messaging layer (and the messaging layer is the new attack surface).

**Alternative:** Pick one chain. Reach 1000 DAU. Then add a second chain only when you can name a specific user request you cannot fulfill on the first.

### Anti-Pattern: "We chose Ethereum L1 because mainnet is the most secure"

**Diagnostic:** Consumer app deploying on Ethereum L1, citing security.

**Failure mode:**
- L1 transaction cost is 10-100x an L2 even post-Fusaka. A user doing 50 actions a month pays $5-50 in gas — kills the funnel.
- L1 confirmation is 12 seconds, plus reorg risk for ~2 blocks. L2 confirmations are typically 200ms-2s with finality at ~10-15 minutes.
- Stage 1+ L2s (Arbitrum, Optimism, Base) inherit Ethereum security via fraud/validity proofs. The "L1 is more secure" claim is mostly outdated for these chains.

**Alternative:** L1 only for assets that must be censorship-resistant at the highest possible level (governance tokens, blue-chip stables, irrevocable settlements >$1M). Everything else: L2.

### Anti-Pattern: "We'll deploy to a Stage 0 rollup"

**Diagnostic:** App holding user funds on a chain L2Beat classifies as Stage 0.

**Failure mode:**
- Sequencer can censor transactions arbitrarily.
- Operator can upgrade contracts instantly with no delay. This means: a compromise of the operator multisig is a total loss of user funds.
- No proof system in production. Withdrawal back to L1 depends on the operator's cooperation.

**Alternative:** Stage 1 minimum for any production product holding user funds. Check L2Beat before committing.

## Token Design

### Anti-Pattern: "We'll airdrop a token first, then build the product"

**Diagnostic:** Roadmap leads with token generation event (TGE) before product-market fit.

**Failure mode:**
- Securities risk: regulators (SEC, FCA, MAS) treat pre-product tokens as investment contracts in most jurisdictions. The legal cost of getting this wrong runs to seven figures.
- Speculative holders are not users. The day-1 holder distribution is mercenary, dumps on day 2-30, and burns your token chart for 12 months.
- You've spent the only governance and incentive lever you had. Once the token is out, you cannot re-issue without dilution and political pain.
- Reputation: the founder team is now permanently in the "did a token first" cohort, which dampens institutional and serious-builder interest.

**Alternative:**
- Build product. Reach $X in revenue or Y DAU.
- If a token solves a *specific* coordination problem (governance, liquidity bootstrapping for a DEX, validator incentives for an L2), introduce it then with a clear rationale and ideally with regulatory clarity (e.g., Wyoming DUNA, Cayman Foundation, Swiss association).
- Most products do not need a token. "We need a token because everyone has one" is not a reason.

### Anti-Pattern: "Inflation will incentivize liquidity"

**Diagnostic:** Tokenomics model with high single-digit or double-digit annual emissions to LPs / stakers.

**Failure mode:**
- Mercenary liquidity: TVL spikes when emissions are high, walks when they taper. The "vampire attack" pattern (Sushi vs Uniswap, 2020) has been re-run on every chain since with diminishing effect.
- Sell pressure: every emitted token is sold within 7-30 days on average. Token price collapses, which collapses the dollar value of emissions, which collapses TVL.
- You've created a Ponzi-shaped token chart and you can't unwind it without breaking promises to early LPs.

**Alternative:**
- Bootstrap liquidity via your own treasury (POL — protocol-owned liquidity, à la Olympus / Tokemak / Aave Umbrella).
- Use targeted, time-bounded incentives for specific pools, not blanket emissions.
- Charge fees and route them to stakers/LPs (Uniswap v4 hooks, Hyperliquid HYPE buyback model).

### Anti-Pattern: "We'll use ve(3,3) for governance"

**Diagnostic:** Founder cites Curve / Velodrome / Aerodrome as inspiration without understanding the second-order effects.

**Failure mode:**
- ve(3,3) only works when there is real flow that bribes can compete for. If your protocol is small, the bribe market is empty and the model fails.
- It locks governance into a sclerotic structure where the largest LP-stakers calcify decisions for 4 years.
- It is a lot of code surface for governance — more contracts, more attack surface, more audit cost.

**Alternative:** Plain stake-based governance. Or no on-chain governance at all (most apps do not need it on-chain). Use Snapshot (off-chain, signature-based, free) for non-binding signals; multisig for execution; on-chain governance only when the protocol genuinely cannot operate without it.

## Smart Contract Architecture

### Anti-Pattern: "We'll write our own ERC-20 / ERC-721 / ERC-4626"

**Diagnostic:** Engineer reaches for `contract MyToken { ... }` and starts writing balance mappings.

**Failure mode:**
- Re-implementing standards introduces subtle bugs. The ERC-20 `approve` race condition, the ERC-721 `safeTransferFrom` reentrancy, the ERC-4626 inflation attack — all have been re-discovered and re-exploited on home-rolled implementations.
- Audits cost more because the auditor cannot rely on the OpenZeppelin / Solady security baseline.
- Composability suffers — small deviations from the standard break aggregator integrations (1inch, CowSwap, OpenSea).

**Alternative:**
- Use `@openzeppelin/contracts` for standards-compliant, audited primitives.
- Use `solady` (vectorized.eth) for gas-optimized variants when gas matters and you can review them.
- Inherit, don't reimplement.

### Anti-Pattern: "We'll make it upgradable just in case"

**Diagnostic:** Every contract is a Transparent Proxy or UUPS without a specific use case for upgradeability.

**Failure mode:**
- Upgradability is the #1 attack vector for protocols that have been drained. If the upgrade key is compromised, the protocol is gone.
- Storage layout bugs on upgrades silently corrupt user state. (See: every upgrade-related incident from 2022-2024.)
- Users distrust upgradable contracts. Major aggregators flag them.
- Audit cost goes up materially — initialization functions, storage gaps, function selector clashes.

**Alternative:**
- Default: immutable contracts. Decide upfront what the contract does and ship it.
- If upgradability is required (e.g., for parameter tuning), use minimal proxies for narrow scopes (a single fee parameter), not whole-contract proxies.
- If upgradability is genuinely required for the whole contract, use a timelock (>=48h) and a multisig (>=3-of-5 with independent signers).

### Anti-Pattern: "We'll use `tx.origin` for access control"

**Diagnostic:** `require(tx.origin == owner)` anywhere in the codebase.

**Failure mode:**
- Phishing: any contract the owner interacts with can call into yours and pass the `tx.origin` check. The "fake airdrop claim" pattern uses this exact vector.
- Pectra makes this worse: with EIP-7702, an EOA can temporarily have contract code, blurring the `tx.origin` vs `msg.sender` distinction even further.

**Alternative:** Always `msg.sender` for access control. If you need to know "the human at the start of the call chain," you cannot reliably know it on a public chain — design around the requirement.

### Anti-Pattern: "We'll use `block.timestamp` for randomness"

**Diagnostic:** Any line containing `block.timestamp` or `block.prevrandao` as a randomness source for value-bearing decisions (lottery, mint order, drop allocation).

**Failure mode:**
- Validators can choose to skip a slot (cost: 1 missed proposal reward, ~$100-200 in 2026) to influence the random seed. For a >$1000 reward, this is profitable.
- `block.prevrandao` (post-Merge) is better than `blockhash` (pre-Merge) but is still manipulable by the next proposer.

**Alternative:** Chainlink VRF, RANDAO with a delay, or an off-chain commit-reveal scheme. For >$10K decisions, use VRF and pay the fee.

### Anti-Pattern: "Our oracle is a single Uniswap V3 spot price"

**Diagnostic:** Lending or perps protocol reads `slot0()` from a Uniswap pool as truth.

**Failure mode:**
- One block of price manipulation lets an attacker borrow against false collateral or trigger false liquidations.
- Flash-loan-funded pool manipulation has drained protocols since 2020. Each new lending protocol re-runs this exploit.

**Alternative:**
- Chainlink price feeds for blue-chip assets where they exist.
- Uniswap V3 TWAP with at least a 30-minute window for less liquid assets.
- Aggregate two independent oracles and require their median.
- Never `slot0()`.

### Anti-Pattern: "We'll trust contract returns implicitly"

**Diagnostic:** Code path like `IERC20(token).transfer(user, amount);` without checking the return value.

**Failure mode:**
- Some tokens (USDT, BNB, OMG legacy) return false instead of reverting on failed transfers. Your accounting goes out of sync silently.
- Some tokens return nothing at all. Solidity's ABI decoder reverts when the function expects a return.

**Alternative:** Use OpenZeppelin's `SafeERC20` library: `IERC20(token).safeTransfer(user, amount)`.

## Operations and Deployment

### Anti-Pattern: "We'll deploy the audited code and tweak in production"

**Diagnostic:** PR merged after audit changes one line "for clarity."

**Failure mode:**
- The audit no longer covers the deployed bytecode. Many post-audit bugs have come from "small" changes — variable renames that broke storage layout, "obvious" optimization that introduced reentrancy, etc.

**Alternative:**
- Deploy the exact audited bytecode.
- If a change is required, treat it as a new audit. For minor changes, request a delta review (cheap, fast).
- Use `forge inspect` to compare bytecode hashes between audited and deployed.

### Anti-Pattern: "We'll deploy to mainnet first, test there"

**Diagnostic:** No testnet deployment, no fork tests, going straight to production.

**Failure mode:**
- Bugs cost real money on mainnet. The 2-3% of bugs that only surface under realistic conditions (multi-user, oracle interactions, MEV bots) cannot be caught in unit tests alone.

**Alternative (the canonical pre-flight):**
1. `forge test` — 100% line coverage on critical paths.
2. `forge test --fork-url $MAINNET_RPC` — fork tests against current mainnet state.
3. Sepolia or Holesky deploy; integration tests against real testnet.
4. Audit (one or two firms; for novel code, formal verification via Certora).
5. Mainnet deploy with admin-only / TVL-capped early period.
6. Gradual cap raises with monitoring (Forta, Hexagate, OpenZeppelin Defender).
7. Full open after 2-4 weeks of clean operations.

### Anti-Pattern: "Ops keys are on the founder's MacBook"

**Diagnostic:** Deployer EOA, owner EOA, or fee recipient EOA all controlled by a single hot key on someone's laptop.

**Failure mode:**
- One stolen laptop, one phishing link, one misclicked CI script: full protocol drain.
- Probably the single most common loss-of-funds vector for early-stage protocols.

**Alternative:**
- Deployer EOA: use only for deploys; rotate after each. Keep on a hardware wallet.
- Owner address: 3-of-5 Safe multisig from day one. Independent signers (not all one team's laptops).
- Treasury: separate Safe multisig from owner.
- For automation (rebalancing bots, keeper bots), use limited-scope session keys (post-Pectra, this is much easier).

### Anti-Pattern: "We'll use `block.number` for time"

**Diagnostic:** Vesting, lockups, or auctions denominated in block numbers.

**Failure mode:**
- Block time is approximately 12 seconds on Ethereum L1, but L2s have variable block time (Base ~2s, Arbitrum ~250ms, Optimism ~2s). Block-number time-locks behave differently per chain.
- Block time can change with upgrades.

**Alternative:** Always use `block.timestamp` for time-based logic. The 15-second-or-so manipulation window on `block.timestamp` is acceptable for almost all use cases.

## Agent and Wallet UX

### Anti-Pattern: "Users will install MetaMask and write down a seed phrase"

**Diagnostic:** Onboarding flow requires users to install a browser extension before reaching product value.

**Failure mode:**
- MetaMask install rate from a cold landing page is 1-3%. You lose 97-99% of traffic at the install gate.
- Seed phrase comprehension among non-crypto users is near zero. They write it down, lose it, panic-export, get phished, and blame your product.

**Alternative (canonical 2026 onboarding):**
1. Email or social sign-in (Privy, Dynamic, Turnkey).
2. Embedded wallet generated server-side (or via MPC).
3. EIP-7702 delegation for batched/sponsored UX (post-Pectra).
4. Paymaster sponsors gas in USDC.
5. User first sees value within 30 seconds. The word "wallet" never appears in the UI.

### Anti-Pattern: "Agents will sign with the user's main key"

**Diagnostic:** Agent product proposes long-lived access to user EOA.

**Failure mode:**
- Single key = single point of failure. One compromised agent = total user drain.
- Users cannot revoke without rotating their entire wallet.

**Alternative:**
- Session keys (EIP-7702 makes this easy on EOAs): scoped to specific contracts, specific tokens, specific spending limits, specific time windows.
- Sub-accounts: agent operates from a derived address with capped funds.
- ERC-4337 modular accounts (Safe, Kernel, Biconomy) for full granularity.

### Anti-Pattern: "We'll require agents to hold ETH for gas"

**Diagnostic:** Agent product expects each agent to maintain its own ETH balance for gas.

**Failure mode:**
- Agent operators must monitor and refill gas balances across N agents on M chains. Operationally painful.
- Gas-shortage outages: agent runs out of ETH mid-task and silently fails.

**Alternative:**
- Use a paymaster that accepts USDC. Agent only ever holds USDC (single asset, easier accounting).
- For x402 commerce, the fee is paid by the merchant in the settlement transaction, so the agent never needs gas at all on the buyer side.

## Security Theatre vs Security

### Anti-Pattern: "We got audited, so we're secure"

**Diagnostic:** Single audit from a firm, no formal verification, no continuous monitoring, no bug bounty.

**Failure mode:**
- Audits catch ~60-80% of bugs in the audited scope. The remaining 20-40% include the worst ones (novel attack vectors, complex multi-step exploits).
- The audited code is not the deployed code (see above). Or the audited code is fine, but a mainnet integration partner introduces the bug.
- Operational compromise (key theft, phishing, social engineering) is the #1 loss vector and audits don't cover it.

**Alternative (defense in depth):**
- Two independent audits for any protocol with >$10M TVL projected.
- Formal verification (Certora, Halmos) for invariants on critical math.
- Bug bounty program from day one (Immunefi, Cantina). Match TVL: 5-10% of TVL as max bounty. This is the cheapest insurance you can buy.
- Continuous monitoring (Forta, Hexagate, OpenZeppelin Defender) with paged on-call.
- Time-locked admin functions (>=48h delay) so the community has time to react to a malicious upgrade.

### Anti-Pattern: "We'll add the bug bounty after launch"

**Diagnostic:** Pre-launch protocol has no public bounty.

**Failure mode:**
- White-hat researchers will not work on your code without a bounty. Black-hat researchers always will.
- Once you've been drained, the post-mortem and rescue-bounty negotiations are 10x more expensive than a pre-launch bounty would have been.

**Alternative:** Launch the bounty 2-4 weeks before mainnet. Start with $50K for criticals; raise as TVL grows.

## Summary Checklist

Before recommending a chain, architecture, or token model, run through this:

- [ ] Is the chain choice justified by liquidity and tooling, not by a marketing partnership?
- [ ] Is the chain Stage 1 or higher on L2Beat (if it's an L2)?
- [ ] Is the product launching on one chain, with multi-chain a deliberate later choice?
- [ ] Is the token (if any) introduced after product-market fit, with a specific coordination role?
- [ ] Are emissions short-duration, targeted, and not the primary liquidity strategy?
- [ ] Is the smart contract built on OpenZeppelin / Solady, not from scratch?
- [ ] Are upgrades opt-in, time-locked, and multisig-controlled — not default?
- [ ] Does access control use `msg.sender`, never `tx.origin`?
- [ ] Are oracles redundant, time-averaged, and not single-pool spot reads?
- [ ] Are deployer / owner / treasury keys on multisigs from day one?
- [ ] Is the onboarding flow email-or-social, not seed-phrase-first?
- [ ] Are agent signing flows scoped via session keys, not full-key delegation?
- [ ] Is there a bug bounty before mainnet, monitoring after?

If any answer is "no," document why before proceeding.
