import corpus from "./corpus.json" with { type: "json" };
import { invoke } from "../agents/runtime.js";

export interface IdeaOut {
  title: string;
  markdown: string;
}

interface CorpusItem {
  id: string;
  title: string;
  chain: string;
  complexity: number;
  vc: number;
  ttsHours: number;
  tags: string[];
}

const IDEAS = corpus as CorpusItem[];

// Curated mode: rank corpus by relevance to the brief, pick the best fit, then have
// Claude flesh out the one-pager grounded on ethskills.
export async function generateIdea(brief: string): Promise<IdeaOut> {
  const ranked = rank(brief);
  const pick = ranked[0];
  if (!pick) {
    throw new Error("no ideas available. corpus is empty.");
  }

  const res = await invoke({
    task: "idea",
    tier: "iterate",
    system:
      "You are a founder writing a one-pager. Sections: Idea, Why now, Why Ethereum, Who it's for, " +
      "GTM, Risks, First-24h plan. No filler. No passive voice. Max 600 words.",
    prompt: [
      `brief: ${brief}`,
      `seed: ${pick.title} (${pick.chain}, complexity ${pick.complexity}/5, vc ${pick.vc}/5)`,
      `tags: ${pick.tags.join(", ")}`,
      "",
      "Adapt the seed to the brief. Stay specific.",
    ].join("\n"),
    maxTokens: 2500,
  });

  return { title: pick.title, markdown: prefix(pick, res.text) };
}

// First-principles mode: 3 sharp questions answered as a synthesis prompt, then one idea.
export async function firstPrinciples(brief: string): Promise<IdeaOut> {
  const res = await invoke({
    task: "idea",
    tier: "architect",
    system:
      "You are ideating from first principles. Start by listing three sharp founder questions " +
      "that would cut to a non-obvious idea. Answer them briefly. Then propose one idea. " +
      "Output a one-pager with sections: Questions, Answers, Idea, Why now, Why Ethereum, " +
      "Who it's for, GTM, Risks, First-24h plan. Max 700 words.",
    prompt: `explore: ${brief}`,
    maxTokens: 3000,
  });

  return { title: "First-principles idea", markdown: res.text };
}

function rank(brief: string): CorpusItem[] {
  const tokens = brief.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const scored = IDEAS.map((i) => {
    let score = 0;
    for (const tok of tokens) {
      if (i.title.toLowerCase().includes(tok)) score += 3;
      for (const tag of i.tags) if (tag.includes(tok)) score += 2;
      if (i.chain.includes(tok)) score += 1;
    }
    return { i, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.i);
}

function prefix(pick: CorpusItem, body: string): string {
  return [
    `# ${pick.title}`,
    "",
    `> chain \`${pick.chain}\` · complexity ${pick.complexity}/5 · vc appetite ${pick.vc}/5 · ~${pick.ttsHours}h to ship`,
    "",
    body.trim(),
  ].join("\n");
}
