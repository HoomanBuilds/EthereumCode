import { invoke } from "./runtime.js";
import type { ChainId } from "../chains/registry.js";
import type { Plan } from "./architect.js";
import { writeProjectFile } from "../util/fs.js";
import { copyTemplate } from "../templates/copy.js";

// The builder forks the chosen template and asks Claude to adapt it to the brief.
// It never writes files directly — every write goes through writeProjectFile, which
// runs the secret scanner.

export interface BuildOutput {
  contracts: string[];
  tests: number;
  pages: number;
}

export async function runBuilder(input: {
  brief: string;
  chain: ChainId;
  plan: Plan;
}): Promise<BuildOutput> {
  // Step 1: copy the template skeleton to ./<project>.
  const copy = await copyTemplate(input.plan.template, { chain: input.chain });

  // Step 2: ask Claude to generate contract + test edits grounded in security/addresses skills.
  const res = await invoke({
    task: "build.contracts",
    tier: "iterate",
    system:
      "You are the builder. Adapt the chosen template to match the brief. Use OpenZeppelin, Checks-Effects-Interactions, " +
      "emit events, verified addresses only. Output a unified list of file writes as `=== path/to/file ===\\n<content>`.",
    prompt: [
      `brief: ${input.brief}`,
      `chain: ${input.chain}`,
      `template: ${input.plan.template}`,
      `integrations: ${input.plan.integrations.join(", ") || "(none)"}`,
      "",
      "List every file you need to change. Keep the diff small. No README edits.",
    ].join("\n"),
    maxTokens: 8192,
  });

  await writeProjectFile(`${copy.root}/BUILD_NOTES.md`, res.text);

  // Step 3: scaffold-eth 2 frontend adaptation.
  await invoke({
    task: "build.frontend",
    tier: "iterate",
    system:
      "You are the frontend builder. Use Scaffold-ETH 2 hooks (useScaffoldReadContract, useScaffoldWriteContract). " +
      "Follow the three-button flow: switch network → approve → execute. No infinite approvals. No placeholder branding.",
    prompt: `adapt the ${input.plan.template} frontend to: ${input.brief}`,
  });

  return {
    contracts: copy.contracts,
    tests: copy.tests,
    pages: copy.pages,
  };
}
