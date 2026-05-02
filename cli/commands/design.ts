import { intro, outro, text, step, done } from "../ui/prompt.js";
import { c } from "../ui/theme.js";
import { parseArgs } from "../util/args.js";
import { invoke } from "../agents/runtime.js";
import { writeProjectFile } from "../util/fs.js";
import { appendSection } from "../handoff/context.js";
import { isAgent } from "../util/output.js";

export async function cmdDesign(argv: string[]): Promise<void> {
  const args = parseArgs(argv);
  intro("design");

  const feature = args.feature ?? (await text("what frontend piece needs design?", "a deposit modal with token approval"));

  step("loading frontend design skill");

  const res = await invoke({
    task: "build.frontend.design",
    tier: "iterate",
    system:
      "You are a senior frontend designer specializing in dApps. Provide concrete component patterns, copy rules, " +
      "loading/error states, layout primitives, and accessibility floor. Use Tailwind + shadcn/ui + wagmi defaults. " +
      "Show code, not concepts.",
    prompt: `Design this frontend feature: ${feature}`,
    maxTokens: 4000,
  });

  await writeProjectFile("design.md", res.text);
  done(`wrote ${c.bold("design.md")}`);

  await appendSection("Frontend design", `**Feature:** ${feature}\n\n${res.text}`);

  if (isAgent()) {
    console.log(`  context_loaded: true`);
  }

  outro(`${c.faint("next")}  ${c.bold("eth build")} ${c.faint("to implement it")}`);
}
