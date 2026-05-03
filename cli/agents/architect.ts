import { invoke } from "./runtime.js";
import type { ChainId } from "../chains/registry.js";
import { chain } from "../chains/registry.js";

// The architect decides shape, not substance. It reads ship/concepts/l2s/standards and
// returns: contract count, template to fork, integration list, and a short why.

export interface Plan {
  contracts: number;
  template: "defi-vault" | "nft-drop" | "dao-governance" | "agent-wallet" | "rwa-issuance" | "zk-privacy" | "0g-agent";
  integrations: string[];
  chainWhy: string;
  raw: string;
}

export async function runArchitect(input: { brief: string; chain: ChainId }): Promise<Plan> {
  const ch = chain(input.chain);
  const res = await invoke({
    task: "architect",
    tier: "architect",
    system:
      "You are the architect for ethereum-code. Decide the minimum contract set (1-3), the template to fork, " +
      "and the integrations. Be specific to the chosen chain. No generic advice. No filler. Output JSON only.",
    prompt: [
      `brief: ${input.brief}`,
      `chain: ${ch.name} (${ch.id}, chainId ${ch.chainId})`,
      `chain superpower: ${ch.superpower}`,
      "",
      "Return JSON with keys: contracts (number 1-3), template (one of: defi-vault, nft-drop, dao-governance, agent-wallet, rwa-issuance, zk-privacy, 0g-agent), integrations (string[]), chainWhy (string, <= 120 chars).",
    ].join("\n"),
  });

  const plan = parsePlan(res.text);
  return { ...plan, raw: res.text };
}

function parsePlan(text: string): Omit<Plan, "raw"> {
  // Try to extract JSON from the model output. If parsing fails, fall back to a safe default.
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const obj = JSON.parse(match[0]) as Partial<Plan>;
      return {
        contracts: clamp(obj.contracts ?? 1, 1, 3),
        template: obj.template ?? "defi-vault",
        integrations: obj.integrations ?? [],
        chainWhy: obj.chainWhy ?? "",
      };
    }
  } catch {
    /* fall through */
  }
  return { contracts: 1, template: "defi-vault", integrations: [], chainWhy: "" };
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
