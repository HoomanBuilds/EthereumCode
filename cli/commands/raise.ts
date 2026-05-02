import { intro, outro, step, done } from "../ui/prompt.js";
import { c } from "../ui/theme.js";
import { parseArgs } from "../util/args.js";
import { runRaise } from "../agents/raise.js";
import { writeProjectFile } from "../util/fs.js";
import { appendSection, readContext } from "../handoff/context.js";
import { isAgent } from "../util/output.js";

export async function cmdRaise(argv: string[]): Promise<void> {
  const args = parseArgs(argv);
  intro("raise");

  const ctx = await readContext();
  if (isAgent()) {
    console.log(`  context_loaded: ${ctx !== null}`);
  }

  step("mapping competitive landscape");
  step("drafting investor-grade deck");
  step("scoring eth-native funds by thesis");

  const result = await runRaise({ brief: args.brief ?? "" });

  await writeProjectFile("raise/deck.md", result.deck);
  await writeProjectFile("raise/investors.md", result.investors);
  await writeProjectFile("raise/landscape.md", result.landscape);

  const raiseBody = `**Funds matched:** ${result.funds}\n\n## Deck\n\n${result.deck}\n\n## Investors\n\n${result.investors}\n\n## Landscape\n\n${result.landscape}`;
  await appendSection("Raise results", raiseBody);

  done(`${result.funds} funds matched`);
  outro(`${c.faint("wrote")}  ${c.bold("./raise")}`);
}
