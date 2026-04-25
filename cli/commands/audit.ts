import { intro, outro, step, done, fail } from "../ui/prompt.js";
import { c } from "../ui/theme.js";
import { parseArgs } from "../util/args.js";
import { runAuditor } from "../agents/auditor.js";
import { writeProjectFile } from "../util/fs.js";

export async function cmdAudit(argv: string[]): Promise<void> {
  const _args = parseArgs(argv);
  intro("audit");

  step("loading audit/ security/ skills");
  step("running slither");
  step("running ethskills checklist");

  const report = await runAuditor();

  await writeProjectFile("audit.md", report.markdown);

  if (report.highs > 0) {
    fail(`${report.highs} high-severity findings  ${c.faint("see audit.md")}`);
  } else {
    done(`0 highs · ${report.mediums} mediums · ${report.lows} lows`);
  }

  outro(`${c.faint("next")}  ${c.bold("eth ship")}`);
}
