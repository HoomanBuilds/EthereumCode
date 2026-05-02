import { invoke } from "./runtime.js";

export interface RaiseResult {
  deck: string;
  investors: string;
  landscape: string;
  funds: number;
}

export async function runRaise(input: { brief: string }): Promise<RaiseResult> {
  const [deck, investors, landscape] = await Promise.all([
    invoke({
      task: "launch.deck",
      tier: "architect",
      system:
        "You are a founder writing a seed deck. Ten slides. Problem, solution, why now, why Ethereum, " +
        "traction hooks, GTM, market, team, ask. No buzzwords. No filler. Output markdown.",
      prompt: `brief: ${input.brief}`,
      maxTokens: 4000,
    }),
    invoke({
      task: "architect",
      tier: "iterate",
      system:
        "Match this idea to 15 eth-native funds by thesis alignment. Include Paradigm, Variant, 1kx, Robot, " +
        "Electric Capital, Archetype, Placeholder, Bain Crypto, Dragonfly, Multicoin, a16z crypto, Coinbase Ventures, " +
        "Framework, Hack VC, Pantera. Score each 1-5 with a one-line why. No generic blurbs.",
      prompt: `brief: ${input.brief}`,
      maxTokens: 3000,
    }),
    invoke({
      task: "architect",
      tier: "iterate",
      system:
        "Map the competitive landscape for this idea. 5-8 live competitors. Each with: name, what they do, " +
        "TVL or users if known, what you'd do differently. Be honest if the space is crowded.",
      prompt: `brief: ${input.brief}`,
      maxTokens: 3000,
    }),
  ]);

  const funds = (investors.text.match(/^\s*[-*]\s/gm) ?? []).length;
  return {
    deck: deck.text,
    investors: investors.text,
    landscape: landscape.text,
    funds,
  };
}
