# Post-Launch Monitoring

Shipping is the start, not the end. The day after launch, the question isn't "is the code correct" — it's "what's actually happening on-chain right now, and would I notice if it broke?" This file is the monitoring stack and the runbook for production dApps.

For pre-ship QA, see `SKILL.md`. For error handling that feeds monitoring, see `references/error-handling-and-toasts.md`. For mobile-specific issues, see `references/mobile-and-pwa.md`.

## What to monitor

```
ON-CHAIN                         OFF-CHAIN
─────────                        ─────────
Contract events (success rate)   Frontend errors (Sentry)
Reverts and revert reasons       RPC latency / availability
TVL / balances                   Page load times
Suspicious patterns              Wallet connect success rate
Oracle price updates             Conversion funnel
Gas price and fee health         User-reported bugs
Owner / admin transactions       Domain / DNS / SSL
```

You need at least one alert source for each row. Without it, you find out about failures from users on Twitter.

## On-chain monitoring stack

### Tenderly (recommended)

Tenderly Web3 Actions watch contract events and trigger webhooks. Best for "alert me when X happens":

```javascript
// Tenderly Action: alert on large withdraw
async function actionFn(context, event) {
  const { args } = event.transaction.events.find(e => e.name === "Withdraw");
  if (args.amount > 100_000n * 10n ** 18n) {
    await fetch(SLACK_WEBHOOK, {
      method: "POST",
      body: JSON.stringify({ text: `Large withdraw: ${args.amount} by ${args.user}` }),
    });
  }
}
```

Useful Tenderly alerts:
- Owner / admin transactions (any tx from privileged address)
- Large withdraws / deposits exceeding threshold
- Specific revert reasons (e.g., `Slippage`, `Paused`)
- Low balance on a critical contract or relayer
- New contract deployment on your factory

### OpenZeppelin Defender

Defender's Sentinels work similarly. Defender also has built-in support for:
- Multi-sig proposal monitoring
- Pause / emergency action automation (with safeguards)
- Function-level alerts (rate limiting, anomaly detection)

If you use a multi-sig, Defender + Sentinels is the standard.

### Indexers as monitors

Your subgraph already has the data; add metrics to the schema:

```graphql
type Hourly @entity {
  id: ID!
  timestamp: BigInt!
  deposits: BigInt!
  withdrawals: BigInt!
  uniqueUsers: BigInt!
  reverts: BigInt!
}
```

Query the subgraph from a Grafana panel:
- Hourly transaction count
- Revert rate (reverts / total)
- New unique users / day
- TVL over time

If you don't have a subgraph, Dune + scheduled queries works the same way for analytics-style monitoring.

### Custom RPC pollers

For highly specific checks, a small Node script run on cron:

```ts
async function checkPoolHealth() {
  const pool = getContract({ address: POOL, abi, client });
  const [reserve0, reserve1] = await pool.read.getReserves();
  const ratio = Number(reserve1) / Number(reserve0);
  if (ratio < EXPECTED_LOW || ratio > EXPECTED_HIGH) {
    await alert(`Pool ratio out of range: ${ratio}`);
  }
}

// Run every 5 minutes via GitHub Actions, Vercel cron, or systemd timer
```

Cheap and flexible. Use when off-the-shelf tools don't cover the specific invariant.

## Off-chain monitoring stack

### Sentry for frontend errors

```bash
yarn add @sentry/nextjs
```

```ts
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  beforeSend(event, hint) {
    const error = hint?.originalException as any;
    // Filter out user rejections — not bugs
    if (error?.code === 4001) return null;
    if (/user (rejected|denied)/i.test(error?.message || "")) return null;
    return event;
  },
});
```

Wagmi/viem errors are noisy by default. Filter aggressively or you'll get 5,000 "user rejected" events per day.

### Frontend performance

Vercel Analytics, PostHog, or Plausible track:
- Core Web Vitals (LCP, FID, CLS)
- Page views / unique users
- Conversion funnel (landing → connect → first tx)
- Geographic distribution

For Web3 specifically, the most valuable funnel is:

```
1. Landing page view
2. Connect wallet click
3. Wallet connected
4. First action (approve, deposit, etc.)
5. Transaction submitted
6. Transaction confirmed
```

If you see a steep drop between any two steps, that's your priority bug.

### Uptime checks

Simple but essential:

```
GET https://yourapp.com               → expect 200, < 1s
GET https://yourapp.com/api/health    → expect 200, JSON with status:"ok"
WSS subgraph endpoint                 → expect connection
```

UptimeRobot, BetterUptime, Checkly. 5-minute intervals from at least 3 regions.

Add an `/api/health` route that does meaningful checks:

```ts
// app/api/health/route.ts
export async function GET() {
  const checks = await Promise.allSettled([
    fetch(RPC_URL, { method: "POST", body: JSON.stringify({jsonrpc:"2.0",id:1,method:"eth_blockNumber"}) }),
    fetch(SUBGRAPH_URL, { method: "POST", body: JSON.stringify({query:"{ _meta { block { number }}}"}) }),
  ]);
  const ok = checks.every(c => c.status === "fulfilled");
  return Response.json({ ok }, { status: ok ? 200 : 503 });
}
```

Pings catch SSL expiration, DNS issues, deploy regressions.

## RPC observability

RPC providers fail silently — slow responses, occasional 500s, regional outages. You need to know:

```ts
// Wrap viem transport with timing
const transport = http(RPC_URL, {
  onFetchResponse: async (res) => {
    const ms = Date.now() - res.startTime;
    if (ms > 2000) Sentry.captureMessage(`Slow RPC: ${ms}ms`, "warning");
  },
});
```

Or push metrics to Grafana:

```ts
metric.histogram("rpc_latency_ms").record(elapsedMs, { method, status });
```

Alert when:
- p95 latency > 1s for >5 minutes
- Error rate > 5% for >5 minutes
- Block lag > 30 seconds (provider's reported block far behind chain head)

Multi-region failover for the RPC provider (Alchemy + Infura + QuickNode) hedges against single-provider outages.

## Wallet connect health

Track at the page level:

```ts
const { isConnected } = useAccount();
useEffect(() => {
  if (isConnected) {
    posthog.capture("wallet_connected", { connector: connector?.id });
  }
}, [isConnected]);

// On error:
posthog.capture("wallet_connect_failed", { reason: err.message });
```

You'll see:
- Which wallets fail most often
- Whether a specific wallet broke (e.g., MetaMask v12 update)
- Geographic concentration of failures

## On-chain incident response

When monitoring fires, the runbook should be ready before launch:

```
Alert: Large unexpected withdraw
  ↓
1. Check Tenderly tx trace — what was the exploit path?
2. If active exploit: pause contract via multisig (Tenderly action or manual)
3. Notify users via Twitter / Discord / Status page
4. Snapshot state (eth_getStorageAt) for forensics
5. Engage auditor for post-mortem
6. Communicate with affected users
7. Plan remediation (refund, redeploy, etc.)
```

Pre-write the Twitter / Discord template. In an actual incident you don't have time to compose.

## Pause and rollback procedures

If your contract has a `pause` function, **practice using it before launch**:

```bash
# Test in a fork
forge script script/Pause.s.sol --fork-url $RPC --private-key $TEST_KEY --broadcast
```

Document who has the keys, where they are, and how long it takes to assemble multisig signers (this is usually the bottleneck — 3/5 multisig with people in different timezones is slow).

For non-pausable contracts, the analogue is "drain the contract via owner functions if possible." If the contract is genuinely immutable with no admin powers, you can't rollback — the only response is communication.

## Status page

A simple status page (Statuspage.io, Better Stack, or a static page you update):

- Current contract addresses
- Subgraph status
- RPC status
- Known issues
- Recent incidents

Link from the footer. When something breaks, point users to the status page instead of getting flooded with DMs.

## Post-launch metrics worth tracking

Beyond uptime, in the first 90 days:

| Metric | Why |
|---|---|
| DAU / WAU / MAU | Real engagement vs. one-time users |
| First-tx-to-second-tx funnel | Are users coming back? |
| Average gas spent per user | Cost of using the app |
| Failed tx rate | UX issues or contract issues |
| Time-to-first-tx after connect | Friction in onboarding |
| Wallet distribution | Where to optimize compatibility |
| Referrer analysis | Where users come from |
| Browser / OS distribution | Where to focus QA |

Use these to prioritize the next iteration. If 40% of failed txs are from one wallet, that's a clear fix.

## Communication channels

Set up before launch:
- **Twitter** — fastest reach for outages
- **Discord** — bug reports, deeper community
- **Email list** — for security incidents requiring user action
- **Status page** — referenced URL when things break
- **Internal Slack/Discord** — alerts route here

Test the alert chain end-to-end. Trigger a fake alert; ensure it arrives where humans see it.

## Common monitoring mistakes

- **Setting up Sentry but not filtering** — drowns in noise from user rejections
- **Alerting on every event** — alert fatigue means real alerts get ignored
- **No incident runbook** — every incident becomes ad-hoc
- **No status page** — users have nowhere to look during outage
- **Single RPC provider** — provider outage = your outage
- **No pause-button drill** — first time using `pause()` is during the actual exploit
- **Monitoring deployed but not viewed** — dashboards exist; nobody looks at them
- **No on-call rotation** — alerts arrive at 3am, nobody responds
- **Trusting "no errors in Sentry"** — Sentry only sees what you instrument

## Day-1 checklist

- [ ] Sentry configured with rejection filtering
- [ ] Tenderly Sentinels for owner txs and large transfers
- [ ] Uptime checks every 5 min from 3+ regions
- [ ] `/api/health` endpoint returns subgraph + RPC status
- [ ] RPC latency histogram in Grafana / DataDog / similar
- [ ] PostHog / Vercel Analytics tracking the connect→tx funnel
- [ ] Status page live at known URL, linked from footer
- [ ] Twitter / Discord templates pre-written for incident comms
- [ ] On-call rotation set with phone alerts
- [ ] Pause runbook tested on a fork
- [ ] Multi-sig signer availability matrix (timezones, expected response time)
- [ ] User communication plan (when to email, when to tweet)

## What to read next

- `SKILL.md` — full pre-ship checklist
- `references/error-handling-and-toasts.md` — error discipline that feeds Sentry
- `references/mobile-and-pwa.md` — mobile-specific failures to watch for
- Tenderly Web3 Actions: https://docs.tenderly.co/web3-actions
- OpenZeppelin Defender: https://docs.openzeppelin.com/defender
- Rekt Test (security checklist): https://www.rekttest.com/
