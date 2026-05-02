import { intro, outro, text, step, done } from "../ui/prompt.js";
import { c } from "../ui/theme.js";
import { parseArgs } from "../util/args.js";
import { invoke } from "../agents/runtime.js";
import { writeProjectFile } from "../util/fs.js";
import { appendSection } from "../handoff/context.js";
import { isAgent } from "../util/output.js";

export async function cmdBeginner(argv: string[]): Promise<void> {
  const args = parseArgs(argv);
  intro("beginner");

  const question = args.question ?? (await text("what's confusing you?", "what is gas"));

  step("loading eth-beginner skill");

  const res = await invoke({
    task: "idea.beginner",
    tier: "iterate",
    system:
      "You are a patient Ethereum teacher. Use the layered mental model: wallets → transactions → gas → contracts → dApps → L2s. " +
      "Anchor in concrete examples, not abstractions. Avoid jargon until it's earned.",
    prompt: `User question: ${question}`,
    maxTokens: 3000,
  });

  await writeProjectFile("beginner.md", res.text);
  done(`wrote ${c.bold("beginner.md")}`);

  await appendSection("Beginner Q&A", `**Q:** ${question}\n\n${res.text}`);

  if (isAgent()) {
    console.log(`  context_loaded: true`);
  }

  outro(`${c.faint("next")}  ${c.bold("eth idea")} ${c.faint("when you're ready")}`);
}
