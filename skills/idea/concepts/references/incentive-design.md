# Incentive Design — Cookbook

Smart contracts do not run themselves. Every state transition needs a caller who pays gas and has a reason to call. This file is the cookbook for designing those reasons. Read it before writing any function whose intent is "this happens later" or "the system maintains itself."

## The Three Questions

For every state transition you sketch, write the answer:

1. **Who pokes it?** A specific actor — user, LP, borrower, liquidator, keeper, arbitrageur, MEV searcher.
2. **Why would they?** Their concrete payoff in tokens, fees, position changes, or avoided losses.
3. **Is the payoff bigger than gas plus opportunity cost?** If gas is $1 and the reward is $0.50, the action never happens.

If any answer is "the team will," "a cron job will," or "we'll deploy a script" — the design is broken. Fix it before writing Solidity.

## Pattern Catalog

### Liquidations

The canonical example. A loan becomes unsafe; anyone closes it for a bonus.

```solidity
// Illustrative — verify against canonical Aave/Compound implementations.
function liquidate(address borrower) external {
    require(healthFactor(borrower) < 1e18, "still healthy");
    uint256 debt = totalDebt(borrower);
    uint256 seize = collateralFor(debt) * (1e18 + LIQUIDATION_BONUS) / 1e18;

    // Caller repays the debt, takes seize amount of collateral.
    debtToken.transferFrom(msg.sender, address(this), debt);
    collateral.transfer(msg.sender, seize);

    emit Liquidated(borrower, msg.sender, debt, seize);
}
```

| Knob | Typical range | Effect if too low | Effect if too high |
|---|---|---|---|
| Liquidation bonus | 5%–10% | Bots ignore small loans, bad debt accrues | Borrowers liquidated aggressively, churn in UX |
| Health factor threshold | 1.0–1.05 | Underwater positions before bots act | Healthy users get liquidated on small dips |
| Close factor (max % of debt liquidatable per call) | 50%–100% | Multiple txs needed, race conditions | Whole position seized for small breach |

Gotchas:
- Make `liquidate` permissionless. If you gate it to a multisig, you have built a service, not a hyperstructure.
- Pay the bonus in the same asset the bot expended (or one it can swap cheaply). Bonus paid in an illiquid governance token is no bonus at all.
- Liquidations of tiny positions can be unprofitable due to gas. Either set a minimum debt size or accept that dust positions linger.

### Harvest / Compound

A pool accrues rewards. Anyone can call `harvest()` to claim, swap, and re-deposit; caller skims a fee.

```solidity
function harvest() external {
    uint256 rewards = strategy.claim();           // pull rewards from external protocol
    uint256 callerFee = rewards * HARVEST_BPS / 10_000;  // e.g. 50 bps = 0.5%
    rewardToken.transfer(msg.sender, callerFee);

    uint256 toDeposit = rewards - callerFee;
    strategy.deposit(toDeposit);                  // compound the rest
    emit Harvested(msg.sender, rewards, callerFee);
}
```

| Knob | Typical range | Notes |
|---|---|---|
| Caller fee | 0.05%–1% of harvested amount | Yearn historically used 0.5% to a designated keeper plus a strategist fee |
| Cooldown | 0–1 day | Without one, bots spam-call when rewards barely exceed gas |
| Min harvest size | configurable | Avoid harvests where the fee is dust |

Gotchas:
- If the harvest involves swapping on a DEX, sandwich attacks are possible. Use a router with slippage limits or route through an aggregator with MEV protection.
- "Compound on every interaction" is a related pattern: instead of a separate harvest function, fold accrual into deposit/withdraw. Cheaper for users, but ties harvest cadence to user activity.

### Arbitrage (Implicit)

You do not write the arbitrageur's code; the market does. Your job is to make sure the price-correcting trade is profitable.

```
Scenario: stablecoin trades at $0.99 in your AMM, $1.00 elsewhere.
- An arbitrageur buys 1M tokens from your pool for $990k.
- Sells them on a CEX or another DEX for $1.00M.
- Pockets $10k minus gas and slippage.
- Your pool's price moves back toward peg.
```

You did not pay them. You did not contract with them. They acted because the math worked. Design every price-touching contract assuming arbitrage will happen — never assume it will not.

Anti-pattern: If an attacker can manipulate your price for one block (e.g. by reading from a single DEX pool), arbitrage is no longer benign. See `oracles.md` for protections.

### Keepers and Bots

When the action does not have a built-in financial reason to call (a check that updates state, a phase transition, a reward distribution to N recipients), pay an explicit keeper fee.

```solidity
function poke() external {
    require(block.timestamp >= nextRunAt, "too early");
    require(conditionMet(), "no work to do");

    // Do the work.
    _runMaintenance();

    // Pay the caller in ETH or the protocol's reward token.
    uint256 fee = KEEPER_FEE;
    nextRunAt = block.timestamp + INTERVAL;
    (bool ok,) = msg.sender.call{value: fee}("");
    require(ok, "fee transfer failed");
    emit Poked(msg.sender, fee);
}
```

Decision: explicit keeper fee vs. implicit incentive.

| Use explicit fee when | Use implicit incentive when |
|---|---|
| The action has no natural financial winner | The action benefits a specific party (themselves) |
| The action is rare (daily, weekly) | The action happens on every user interaction |
| You can afford a flat per-call cost | The protocol cannot subsidize keeper fees |

Networks like Gelato, Chainlink Automation, and Keeper3r exist as pre-built keeper pools — but they themselves rely on the same fee logic. Permissionless `poke()` with a fee is the primitive; those services are syntactic sugar.

### Rebalancers

Index funds, AMM concentrators, vaults that allocate across strategies. The bad pattern is "the manager will rebalance daily." The good pattern is "anyone can rebalance when the deviation exceeds X, and they earn a slice of the spread."

```solidity
function rebalance() external {
    uint256 deviation = abs(currentWeight() - targetWeight());
    require(deviation > REBALANCE_THRESHOLD, "in band");

    // Compute the trade that brings weights back; execute it; pay caller.
    uint256 callerReward = _executeRebalance() * REBALANCER_BPS / 10_000;
    rewardToken.transfer(msg.sender, callerReward);
}
```

The rebalance threshold is the most-tuned knob. Too tight and bots churn the pool, paying out fees on noise. Too loose and the index drifts far from target.

### Time-Triggered Actions Without Time

Ethereum has no scheduler. "Run every Friday" is impossible directly. The patterns:

1. **Open the gate at T, let anyone walk through.** Function reverts before T, succeeds after. Whoever benefits from the action calls it. If nobody benefits, the action does not happen — which means you should not have scheduled it.
2. **Lazy evaluation.** The next user interaction triggers the time-based work. State carries `lastUpdated` and recomputes on read.
3. **Pay a keeper.** Explicit fee for being the one to call after T.

```solidity
// Pattern 1: gate opens, beneficiary walks through.
function claimUnlock() external {
    require(block.timestamp >= unlockAt[msg.sender], "locked");
    uint256 amount = locked[msg.sender];
    locked[msg.sender] = 0;
    token.transfer(msg.sender, amount);
}

// Pattern 2: lazy accrual.
function _accrue(address user) internal {
    uint256 elapsed = block.timestamp - lastAccrual[user];
    balances[user] += rate * elapsed;
    lastAccrual[user] = block.timestamp;
}

// Pattern 3: paid keeper.
function rolloverEpoch() external {
    require(block.timestamp >= currentEpoch.endsAt, "epoch active");
    _settleEpoch();
    rewardToken.transfer(msg.sender, KEEPER_REWARD);
}
```

## Anti-Patterns and Their Fixes

| Anti-pattern | Why it breaks | Fix |
|---|---|---|
| `onlyOwner setPrice(uint p)` | Centralized, censorable, single point of failure | Read from a Chainlink feed; if you must trust, document it loudly |
| "The contract checks every hour" | Nothing checks | Make the check happen on user interaction, or pay a keeper |
| "Expired listings are auto-removed" | Dead state accumulates | Charge the next interactor to clean up; reward callers per cleanup |
| "Admin advances the phase" | Admin disappears, whole game halts | Phase advances when block.timestamp passes a deadline; anyone calls `advance()` |
| Rewards distributed by `for` loop over all users | Gas explodes; tx eventually fails | Pull pattern: each user claims their own share |
| `transferFrom` everyone's tokens to settle | Cannot transfer without each user signing | Settle in a per-user ledger; let users withdraw |

## The Pull-vs-Push Rule

Push: contract sends tokens or state to N parties.

Pull: each party retrieves their own.

Always pull, unless N is statically bounded and small (1–2). Push patterns:

- Cost gas proportional to N (eventually fails).
- Re-enter on every recipient (security risk).
- Brick the entire flow if any one recipient reverts.

Pull patterns:

- Each user pays their own gas.
- Failed claims do not block other users.
- Easy to add per-user state like accrual or vesting.

```solidity
// Push (bad for many recipients):
function distribute() external onlyOwner {
    for (uint i = 0; i < holders.length; i++) {
        token.transfer(holders[i], share[holders[i]]);  // can OOG, can revert
    }
}

// Pull (good):
mapping(address => uint256) public claimable;

function setShares(address[] calldata h, uint256[] calldata s) external onlyOwner {
    for (uint i = 0; i < h.length; i++) claimable[h[i]] += s[i];
}

function claim() external {
    uint256 amount = claimable[msg.sender];
    claimable[msg.sender] = 0;
    token.transfer(msg.sender, amount);
}
```

## Calibrating Rewards

A reward is too small if no bot calls. A reward is too big if it eats protocol revenue.

Process:

1. Estimate gas cost of the action in the worst case (high base fee, complex path). Convert to USD using a hedge ETH price — call it $X.
2. Estimate frequency of the action. Daily? Per-block? On user interaction?
3. Reward must be at least ~2x worst-case gas to be reliable, given that bots compete and only one wins per opportunity.
4. Cap the reward at a percentage of what is being secured or moved. Liquidation bonus is 5%–10% of the position because the position is what the protocol cares about preserving.

Do not assert specific gas numbers in your design — base fees vary order-of-magnitude across L1 and L2s. Parameterize the reward in basis points of value, with a floor in absolute terms if needed.

## When You Genuinely Need Centralization

Some designs genuinely need a privileged actor — early-stage protocols, regulated products, prize distributions where an external oracle determines winners. Be explicit:

- Document the trust assumption in plain English in the contract NatSpec.
- Use a multisig (Safe), not an EOA. Document the signer set.
- Use a timelock for parameter changes (24h–72h is common). The `OwnableTimelock` pattern from OpenZeppelin Governor is a starting point — verify the latest API at https://docs.openzeppelin.com/contracts.
- Plan the path to removing the privilege. "Trustless by year 2" is a roadmap; "trustless someday" is not.

CROPS — Censorship Resistance, Open Source, Privacy, Security — is the Ethereum Foundation's shorthand for what makes Ethereum trustworthy. A single key that can freeze users is a censorship vector under this framing. If you ship one, name it as such.

## Hyperstructure Self-Test

Before deploying, write down:

1. What is the protocol's revenue source? Who pays it?
2. What is the gas cost on every transition? Who pays it?
3. What happens if the team disappears tomorrow? Walk through every function.
4. What happens if the keeper network goes offline? Does user funds get stuck?
5. What happens if rewards drop to zero (token price crashes)? Do bots still call?

If your answers depend on a specific company, key, or off-chain process — you have built a service, not a hyperstructure. Both are valid; know which one you shipped.

## Further Reading

- Aave V3 liquidation logic: https://github.com/aave/aave-v3-core (verify against current release)
- Yearn V3 strategy/keeper docs: https://docs.yearn.fi
- Gelato Network: https://docs.gelato.network
- Flashbots and MEV primer: https://docs.flashbots.net

Whenever you copy a fee number, threshold, or address from this file into production code, verify against the canonical project documentation. Numbers in this cookbook are illustrative.
