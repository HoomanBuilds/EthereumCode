import type { ChainId } from "./registry.js";
import { CHAINS } from "./registry.js";

// Lightweight use-case → chain heuristic. The goal isn't to be clever — it's to never
// give generic "deploy on mainnet" advice when the use case obviously belongs elsewhere.
// The real reasoning happens inside the architect agent with ethskills loaded; this is
// the fast local hint shown before the architect runs.

interface Rule {
  id: ChainId;
  weight: number;
  patterns: RegExp[];
  why: string;
}

const RULES: Rule[] = [
  {
    id: "base",
    weight: 3,
    patterns: [
      /\bconsumer\b/i,
      /\bsocial\b/i,
      /\bfarcaster\b/i,
      /\bmini\s*app\b/i,
      /\bonramp\b/i,
      /\bcoinbase\b/i,
      /\bnft\b/i,
      /\bdrop\b/i,
      /\bframe\b/i,
      /\bpayments?\b/i,
    ],
    why: "consumer onboarding + coinbase distribution",
  },
  {
    id: "arbitrum",
    weight: 3,
    patterns: [
      /\bperps?\b/i,
      /\bvault\b/i,
      /\blend(ing)?\b/i,
      /\boption\b/i,
      /\bderivatives?\b/i,
      /\bamm\b/i,
      /\bdex\b/i,
      /\byield\b/i,
      /\brestak/i,
    ],
    why: "deepest L2 defi liquidity and composability",
  },
  {
    id: "optimism",
    weight: 2,
    patterns: [/\bpublic\s*good/i, /\bgrant/i, /\bdao\b/i, /\bgovernance\b/i, /\bretro/i],
    why: "public goods funding and retro rewards culture",
  },
  {
    id: "zksync",
    weight: 2,
    patterns: [/\baa\b/i, /\baccount\s*abstraction/i, /\bsmart\s*wallet/i, /\bzk\b/i, /\bprivac/i],
    why: "native account abstraction + zk validity",
  },
  {
    id: "0g",
    weight: 4,
    patterns: [
      /\b0g\b/i,
      /\bzero\s*gravity\b/i,
      /\bagents?\b/i,
      /\bai\b/i,
      /\binference\b/i,
      /\bcompute\b/i,
      /\bdecentralized\s*(storage|compute|ai)\b/i,
      /\bpersistent\s*memory\b/i,
      /\bonchain\s*memory\b/i,
      /\bautonomous\s*agent\b/i,
    ],
    why: "decentralized AI stack with onchain storage and compute",
  },
  {
    id: "mainnet",
    weight: 1,
    patterns: [/\bens\b/i, /\brestak/i, /\bmev\b/i, /\bblue\s*chip/i, /\binstitutional/i],
    why: "credibly neutral settlement for high-value state",
  },
];

export interface ChainRec {
  id: ChainId;
  why: string;
}

export function recommendChain(brief: string): ChainRec {
  const scores = new Map<ChainId, number>();
  const reasons = new Map<ChainId, string>();
  for (const rule of RULES) {
    let hits = 0;
    for (const re of rule.patterns) if (re.test(brief)) hits++;
    if (hits === 0) continue;
    const score = hits * rule.weight;
    scores.set(rule.id, (scores.get(rule.id) ?? 0) + score);
    reasons.set(rule.id, rule.why);
  }
  if (scores.size === 0) {
    // Default: base. It's the safest taste-forward starting point for a new founder.
    return { id: "base", why: CHAINS.base.superpower };
  }
  const [topId] = [...scores.entries()].sort((a, b) => b[1] - a[1])[0]!;
  return { id: topId, why: reasons.get(topId) ?? CHAINS[topId].superpower };
}
