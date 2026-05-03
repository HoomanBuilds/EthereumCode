import { intro, outro, text, select, step, done, warnApiKey } from "../ui/prompt.js";
import { c } from "../ui/theme.js";
import { parseArgs } from "../util/args.js";
import { generateIdea, firstPrinciples } from "../ideas/engine.js";
import { writeProjectFile } from "../util/fs.js";
import { appendSection } from "../handoff/context.js";
import { isAgent } from "../util/output.js";

export async function cmdIdea(argv: string[]): Promise<void> {
  const args = parseArgs(argv);
  await warnApiKey();
  intro("idea");

  const brief = args.brief ?? (await text("what are you exploring?", "ethereum-native agent wallets"));

  const mode = await select<"curated" | "first-principles">("how do you want to ideate?", [
    { value: "curated", label: "curated", hint: "pull from 500+ tagged eth-native ideas" },
    { value: "first-principles", label: "first principles", hint: "3 sharp questions → something non-obvious" },
  ]);

  step("grounding on ethskills");
  step("thinking");

  const idea =
    mode === "curated" ? await generateIdea(brief) : await firstPrinciples(brief);

  await writeProjectFile("idea.md", idea.markdown);
  done(`wrote ${c.bold("idea.md")}`);

  const ideaBody = `**Brief:** ${brief}\n**Mode:** ${mode}\n\n${idea.markdown}`;
  await appendSection("Idea", ideaBody);
  await appendSection("Open questions", "- What is the unique insight?\n- What are the key technical risks?\n- What is the go-to-market?");

  if (isAgent()) {
    console.log(`  context_loaded: true`);
  }

  outro(`${c.faint("next")}  ${c.bold("eth build")}`);
}
