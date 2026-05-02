import { intro, outro, text, step, done } from "../ui/prompt.js";
import { c } from "../ui/theme.js";
import { parseArgs } from "../util/args.js";
import { invoke } from "../agents/runtime.js";
import { writeProjectFile } from "../util/fs.js";
import { appendSection } from "../handoff/context.js";
import { isAgent } from "../util/output.js";

export async function cmdGrant(argv: string[]): Promise<void> {
  const args = parseArgs(argv);
  intro("grant");

  const project = args.project ?? (await text("what are you building?", "a public goods indexer for L2s"));
  const program = args.program ?? (await text("target grant program?", "Optimism RPGF"));

  step("loading grant application skill");

  const res = await invoke({
    task: "launch.grant",
    tier: "architect",
    system:
      "You are a grant reviewer who has seen 200+ applications. Structure the proposal for alignment scoring: " +
      "program fit, team capability, technical feasibility, budget reasonableness, measurable milestones. " +
      "Write milestones that are one deliverable each with acceptance criteria.",
    prompt: `project: ${project}\ntarget program: ${program}`,
    maxTokens: 5000,
  });

  await writeProjectFile("grant.md", res.text);
  done(`wrote ${c.bold("grant.md")}`);

  await appendSection("Grant application", `**Project:** ${project}\n**Program:** ${program}\n\n${res.text}`);

  if (isAgent()) {
    console.log(`  context_loaded: true`);
  }

  outro(`${c.faint("next")}  ${c.bold("eth raise")} ${c.faint("if you need VC funding instead")}`);
}
