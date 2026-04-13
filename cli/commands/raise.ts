import { intro, outro, step, done } from "../ui/prompt.js";
import { c } from "../ui/theme.js";
import { parseArgs } from "../util/args.js";
import { runRaise } from "../agents/raise.js";
import { writeProjectFile } from "../util/fs.js";

export async function cmdRaise(argv: string[]): Promise<void> {
  const args = parseArgs(argv);
  intro("raise");

  step("mapping competitive landscape");
  step("drafting investor-grade deck");
  step("scoring eth-native funds by thesis");

  const result = await runRaise({ brief: args.brief ?? "" });

  await writeProjectFile("raise/deck.md", result.deck);
  await writeProjectFile("raise/investors.md", result.investors);
  await writeProjectFile("raise/landscape.md", result.landscape);

  done(`${result.funds} funds matched`);
  outro(`${c.faint("wrote")}  ${c.bold("./raise")}`);
}
