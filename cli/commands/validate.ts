import { intro, outro, text, step, done } from "../ui/prompt.js";
import { c } from "../ui/theme.js";
import { parseArgs } from "../util/args.js";
import { invoke } from "../agents/runtime.js";
import { writeProjectFile } from "../util/fs.js";
import { appendSection } from "../handoff/context.js";
import { isAgent } from "../util/output.js";

export async function cmdValidate(argv: string[]): Promise<void> {
  const args = parseArgs(argv);
  intro("validate");

  const idea = args.idea ?? (await text("what's the idea?", "a decentralized yield aggregator for idle stablecoins"));

  step("loading validate-idea skill");

  const res = await invoke({
    task: "idea.validate",
    tier: "architect",
    system:
      "You are a ruthless idea validator. Refuse to discuss contract design until the idea is validated. " +
      "Ask the four questions: who is the user, what are they doing today, why switch, what's the cheapest test. " +
      "Identify the riskiest assumption. Force a falsifiable experiment.",
    prompt: `Idea: ${idea}`,
    maxTokens: 4000,
  });

  await writeProjectFile("validate.md", res.text);
  done(`wrote ${c.bold("validate.md")}`);

  await appendSection("Idea validation", `**Idea:** ${idea}\n\n${res.text}`);

  if (isAgent()) {
    console.log(`  context_loaded: true`);
  }

  outro(`${c.faint("next")}  ${c.bold("eth idea")} ${c.faint("if validated")}  ${c.bold("eth beginner")} ${c.faint("if you're still learning")}`);
}
