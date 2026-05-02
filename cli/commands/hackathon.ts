import { intro, outro, text, step, done } from "../ui/prompt.js";
import { c } from "../ui/theme.js";
import { parseArgs } from "../util/args.js";
import { invoke } from "../agents/runtime.js";
import { writeProjectFile } from "../util/fs.js";
import { appendSection } from "../handoff/context.js";
import { isAgent } from "../util/output.js";

export async function cmdHackathon(argv: string[]): Promise<void> {
  const args = parseArgs(argv);
  intro("hackathon");

  const project = args.project ?? (await text("what are you building?", "a yield aggregator on Base"));
  const hackathon = args.hackathon ?? (await text("which hackathon?", "ETHGlobal"));

  step("loading hackathon submission skill");

  const res = await invoke({
    task: "launch.hackathon",
    tier: "iterate",
    system:
      "You are a hackathon judge and coach. Optimize the submission for 3-minute judge review cycles. " +
      "Focus on: README structure, 90-second demo script, repo packaging, sponsor prize alignment. " +
      "Be blunt about what would get skipped.",
    prompt: `project: ${project}\nhackathon: ${hackathon}`,
    maxTokens: 4000,
  });

  await writeProjectFile("hackathon.md", res.text);
  done(`wrote ${c.bold("hackathon.md")}`);

  await appendSection("Hackathon submission", `**Project:** ${project}\n**Hackathon:** ${hackathon}\n\n${res.text}`);

  if (isAgent()) {
    console.log(`  context_loaded: true`);
  }

  outro(`${c.faint("next")}  ${c.bold("eth grant")} ${c.faint("if you win")}`);
}
