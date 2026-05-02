# Launch Runbook

A launch checklist that's vague produces a launch that's chaotic. This is the ordered, time-bracketed runbook for taking a tested, audited dApp from "ready" to "live" — and what to do in the first 48 hours.

For per-archetype contract patterns, see `references/archetype-blueprints.md`. For post-launch iteration, see `references/post-mvp-iteration.md`.

## T-7 days: pre-launch freeze

Lock everything that should be locked.

- [ ] **Code freeze.** No new features. Bug fixes only with explicit approval.
- [ ] **Final audit fixes verified.** Each Critical/High has a fix commit, re-tested, signed off by auditor.
- [ ] **Deployer key produced.** Hardware wallet, single use. Never used on this chain before.
- [ ] **Multisig signers confirmed.** Each signer has tested signing on the target multisig with a dummy proposal.
- [ ] **Frontend feature-flag any not-ready features.** Don't ship them; don't even have the routes.
- [ ] **Status page live.** URL chosen, linked from footer.
- [ ] **Communication templates pre-written.**
  - "We're live!" tweet + thread
  - Incident template ("We've paused contracts...")
  - Migration template (in case redeploy needed)
- [ ] **Monitoring stack live and tested.** Tenderly Sentinels firing into Slack/Discord on a test event.
- [ ] **Indexer deployed and synced** to a recent block on mainnet (or testnet equivalent).

## T-3 days: dress rehearsal

Run the entire deploy on a fork.

```bash
# Fork mainnet locally
anvil --fork-url $MAINNET_RPC --fork-block-number $LATEST

# Run actual deploy script against fork
forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --broadcast --private-key $TEST_KEY

# Verify outputs
cast call <deployed_contract> "owner()(address)" --rpc-url http://localhost:8545
```

If anything errors on the fork, fix it now. The fork is the cheapest possible rehearsal.

- [ ] Deploy on fork succeeds end-to-end
- [ ] Ownership transfer to multisig (simulated) succeeds
- [ ] First real transaction succeeds
- [ ] Frontend pointed at fork RPC works
- [ ] Indexer can ingest events from fork

## T-1 day: final checks

- [ ] **Funded deployer.** Sent enough ETH to deployer for gas + buffer (typically 0.5-1 ETH on mainnet, 0.05 on L2)
- [ ] **API keys verified.** Etherscan API key works; Vercel deploy hooks work; Pinata JWT works.
- [ ] **DNS propagated.** Custom domain resolves; SSL valid.
- [ ] **OG previews tested.** Share to a private chat; image renders.
- [ ] **Mobile flow tested in 3+ wallets** (MetaMask, Rainbow, Coinbase) on actual phones.
- [ ] **On-call schedule set.** Who's responsible for which hours of T+0 through T+3 days.
- [ ] **Rollback plan documented.** What is the recovery if main contract has a bug?

## T-0: launch day

```
00:00  Final go/no-go decision (team)
00:05  Deploy contracts
00:30  Verify on Etherscan/Basescan/etc.
00:45  Initial state checks (cast call every getter)
01:00  First test transaction (small amount, single wallet)
01:30  Transfer ownership to multisig
02:00  Drain deployer wallet
02:30  Update frontend with deployed addresses
03:00  Deploy frontend to production
03:30  Smoke test: full user flow on production
04:00  Soft launch: announce in Discord/inner circle
06:00  Monitor for 2 hours; fix anything obvious
08:00  Public announcement (Twitter, etc.)
```

Don't compress this. The instinct to "deploy + announce in 30 minutes" is how teams ship bricked contracts.

### Deploy step (the actual commands)

For Foundry-based projects:

```bash
# Use --ledger or --trezor; never type a private key on launch day
forge script script/Deploy.s.sol \
  --rpc-url $RPC_URL \
  --broadcast \
  --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY \
  --ledger \
  --sender $DEPLOYER_ADDRESS \
  --slow

# Save broadcast/ output for the record
git add broadcast/Deploy.s.sol/$CHAIN_ID/run-latest.json
git commit -m "chore: launch broadcast for $CHAIN_NAME"
```

For SE2:

```bash
yarn deploy --network base
yarn verify --network base
```

### Verify step

After deploy:

```bash
# Verify each contract is verified
forge verify-contract $ADDRESS src/Vault.sol:Vault \
  --chain $CHAIN_ID \
  --etherscan-api-key $ETHERSCAN_API_KEY \
  --watch

# Confirm bytecode matches expected (hedge against deploy-time miscompilation)
forge inspect Vault bytecode > expected.bin
cast code $ADDRESS > deployed.bin
diff <(tail -c +3 expected.bin) <(tail -c +3 deployed.bin) || echo "MISMATCH"
```

**Bytecode diff sometimes fails** because of metadata hashes. Strip the last 53 bytes (metadata) before comparing if so.

### Initial state checks

Call every getter and verify it matches expected:

```bash
cast call $VAULT "owner()(address)" --rpc-url $RPC          # → multisig
cast call $VAULT "totalAssets()(uint256)" --rpc-url $RPC    # → 0 (or seed amount)
cast call $VAULT "asset()(address)" --rpc-url $RPC          # → expected token
cast call $VAULT "paused()(bool)" --rpc-url $RPC            # → false (or true if you want to soft-launch)
```

Write these as a script. Run it every time you deploy to any environment.

### First test transaction

Send a tiny amount (1 USDC, 0.001 ETH) from a separate test wallet. Verify:

- Transaction confirms
- Event emits
- State changes match expectation
- Block explorer renders the tx correctly
- Indexer picks it up
- Frontend updates without refresh

If any of these fail, **stop**. Don't proceed to the public announcement.

### Ownership transfer

Two-step, with explicit verification between steps:

```bash
# Step 1: propose transfer (if using OZ Ownable2Step)
cast send $VAULT "transferOwnership(address)" $MULTISIG --ledger
# Step 2: multisig accepts
# (queue Safe transaction, gather signatures, execute)
# Step 3: verify
cast call $VAULT "owner()(address)" --rpc-url $RPC   # → $MULTISIG
```

For non-2-step Ownable contracts, the transfer is single-step. Verify immediately.

### Deployer drain

After ownership is transferred and verified:

```bash
# Send remaining ETH to a cold wallet, leaving 0
cast send $COLD_WALLET --value $(cast balance $DEPLOYER) --ledger
# Confirm zero
cast balance $DEPLOYER  # → 0
```

The deployer key is now "spent". Keep the device around for evidence; never reuse the key.

### Frontend deploy

```bash
# Update deployedContracts.ts (auto-generated by SE2 deploy)
yarn deploy --network mainnet  # already updated this

# Production build
yarn build

# Deploy
vercel --prod  # or fleek deploy / ipfs upload
```

**Verify the deployed frontend is reading from the correct addresses.** Open prod URL, open DevTools, inspect network calls — they should hit the addresses you just deployed.

### Smoke test on production

A real wallet, a small amount of real value:

1. Connect wallet
2. Switch network if needed
3. Approve token (real approval, real tx)
4. Execute action (deposit / mint / swap)
5. Verify it appears in the UI
6. Verify the indexer picked it up
7. Verify the explorer shows it

If any step fails, decide: **bug or polish?** Bugs block launch. Polish issues get a card and ship later.

## T+0 to T+24 hours: hot watch

Two people on call, monitoring:

- Tenderly Sentinels firing
- Sentry error rate
- Uptime checks green
- Subgraph sync status
- Discord/Twitter/email for user reports
- RPC latency

Pre-set alarms:

| Signal | Action |
|---|---|
| Critical Sentinel fires (large unexpected withdraw) | Stop everything, investigate |
| Sentry error rate > 10/min for > 5 min | Identify error, decide if rollback needed |
| Uptime check red | Check DNS, SSL, frontend host |
| Subgraph sync lag > 50 blocks | Investigate; user balances may be stale in UI |
| User reports on Discord | Acknowledge within 5 min, even if no fix yet |

## T+1 to T+7 days: cool watch

Hot watch can relax to one person on call. Daily check-ins:

- Funnel conversion (connect → first action)
- New unique users per day
- Failed tx rate (should be < 5%)
- Wallet distribution (which wallets dominate; any hotspots of failure)
- Geographic distribution (any region breaking?)
- Page load times by region
- Gas costs per user action (any unexpected spikes?)

Fix UX bugs as they surface. Defer feature requests until the dust settles.

## Incident response patterns

If something goes wrong, follow the same sequence every time:

```
1. ACKNOWLEDGE
   - "We're investigating reports of X. More info shortly."
   - Tweet + Discord + status page within 10 minutes.

2. DIAGNOSE
   - What's broken? (frontend, contract, RPC, indexer)
   - Is it actively losing user funds? Yes → pause if possible.
   - What's the blast radius?

3. CONTAIN
   - Frontend: roll back deploy
   - Contract: pause via multisig
   - RPC: failover to secondary
   - Indexer: redeploy from last good block

4. COMMUNICATE
   - "Identified the issue: [X]. Working on a fix. Funds [are/are not] at risk."
   - Time estimate if you have one. Don't promise what you can't guarantee.

5. FIX
   - Patch, test on fork, peer review.
   - Deploy with full rehearsal.

6. POST-MORTEM
   - Within 7 days: write up what happened, why, and what changes.
   - Public if user-facing; internal if not.
```

Pre-write all the templates so you're not composing during a fire.

## Common launch failures

- **Compiler version drift between local and CI.** Bytecode diff catches this; check before announcing.
- **Forgot to set the multisig as owner.** Now you're scrambling to transfer post-launch.
- **Frontend hardcoded the testnet addresses.** Smoke test on production catches this.
- **OG image is a relative URL.** Tweet preview shows nothing. Test before announce.
- **DNS not propagated.** Some users see the old site. TTL matters; lower it 24h before launch.
- **No on-call coverage at 3am.** First Asia user hits a bug, nobody responds for 6 hours.
- **No status page.** Users panic in DMs; you can't keep up.
- **Announce before smoke test.** Bug found mid-traffic; rolling back is harder under load.
- **Single-RPC dependency.** Provider hiccup = your outage.

## Pre-launch + launch + post-launch checklist

```
[ ] Code freeze (T-7)
[ ] Final audit fixes verified (T-7)
[ ] Deployer hardware wallet ready (T-7)
[ ] Multisig signers tested (T-7)
[ ] Status page live (T-7)
[ ] Comms templates written (T-7)
[ ] Monitoring stack tested (T-7)
[ ] Fork rehearsal passes (T-3)
[ ] DNS + SSL verified (T-1)
[ ] Mobile flow tested in 3+ wallets (T-1)
[ ] On-call schedule set (T-1)
[ ] Rollback plan documented (T-1)

[ ] Deploy contracts (T-0)
[ ] Verify on explorer (T-0)
[ ] Initial state checks pass (T-0)
[ ] First test transaction (T-0)
[ ] Ownership → multisig (T-0)
[ ] Deployer drained (T-0)
[ ] Frontend deployed (T-0)
[ ] Smoke test on production (T-0)
[ ] Soft launch announce (T-0)
[ ] Public announce (T+4h)

[ ] Hot watch 24h (T+0)
[ ] Cool watch 7 days (T+1)
[ ] First post-mortem if needed (T+7)
```

## What to read next

- `SKILL.md` — full ship lifecycle
- `references/archetype-blueprints.md` — what to build
- `references/post-mvp-iteration.md` — after launch
- `audit/qa/references/post-launch-monitoring.md` — monitoring stack details
- `orchestration/references/ci-and-deploy.md` — CI patterns
