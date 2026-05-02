import { intro, outro, text, step, done } from "../ui/prompt.js";
import { c } from "../ui/theme.js";
import { parseArgs } from "../util/args.js";
import { invoke } from "../agents/runtime.js";
import { writeProjectFile } from "../util/fs.js";
import { appendSection } from "../handoff/context.js";
import { isAgent } from "../util/output.js";

export async function cmdReview(argv: string[]): Promise<void> {
  const args = parseArgs(argv);
  intro("review");

  const target = args.target ?? (await text("what to review?", "my deployed vault contract and landing page"));

  step("loading roast-my-product skill");

  const res = await invoke({
    task: "build.review",
    tier: "architect",
    system:
      "You are a brutal product reviewer. No flattery, no encouragement — actionable critique. " +
      "Score issues by severity: CRITICAL (kills adoption), HIGH (drops users), MEDIUM (degrades trust), LOW (polish). " +
      "Walk the funnel like a real user. Lead with the one most damaging issue.",
    prompt: `Review this: ${target}`,
    maxTokens: 4000,
  });

  await writeProjectFile("review.md", res.text);
  done(`wrote ${c.bold("review.md")}`);

  await appendSection("Project review", `**Target:** ${target}\n\n${res.text}`);

  if (isAgent()) {
    console.log(`  context_loaded: true`);
  }

  outro(`${c.faint("next")}  ${c.bold("eth build")} ${c.faint("to fix the issues")}  ${c.bold("eth design")} ${c.faint("for frontend guidance")}`);
}
