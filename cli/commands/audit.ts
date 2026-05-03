import { intro, outro, step, done, fail } from "../ui/prompt.js";
import { c } from "../ui/theme.js";
import { parseArgs } from "../util/args.js";
import { runAuditor } from "../agents/auditor.js";
import { writeProjectFile } from "../util/fs.js";
import { appendSection, readContext } from "../handoff/context.js";
import { isAgent } from "../util/output.js";
import { which } from "../util/exec.js";

export async function cmdAudit(argv: string[]): Promise<void> {
  const _args = parseArgs(argv);
  intro("audit");

  const ctx = await readContext();
  if (isAgent()) {
    console.log(`  context_loaded: ${ctx !== null}`);
  }

  const slither = await which("slither");
  if (slither.ok) step("running slither");
  else step("slither not installed — static analysis skipped");

  step("running ethskills checklist");

  const report = await runAuditor();

  await writeProjectFile("audit.md", report.markdown);

  const auditBody = `**Highs:** ${report.highs}\n**Mediums:** ${report.mediums}\n**Lows:** ${report.lows}\n\n${report.markdown}`;
  await appendSection("Audit findings", auditBody);

  if (report.highs > 0) {
    fail(`${report.highs} high-severity findings  ${c.faint("see audit.md")}`);
  } else {
    done(`0 highs · ${report.mediums} mediums · ${report.lows} lows`);
  }

  outro(`${c.faint("next")}  ${c.bold("eth ship")}`);
}
