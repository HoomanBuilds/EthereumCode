import { intro, outro, text, step, done } from "../ui/prompt.js";
import { c } from "../ui/theme.js";
import { parseArgs } from "../util/args.js";
import { invoke } from "../agents/runtime.js";
import { writeProjectFile } from "../util/fs.js";
import { appendSection } from "../handoff/context.js";
import { isAgent } from "../util/output.js";

export async function cmdDebug(argv: string[]): Promise<void> {
  const args = parseArgs(argv);
  intro("debug");

  const error = args.error ?? (await text("what's failing?", "forge test reverts with no reason"));

  step("loading debug-contract skill");

  const res = await invoke({
    task: "build.debug",
    tier: "iterate",
    system:
      "You are a senior Solidity debugger. Reproduce the failure, read the actual revert reason with forge test -vvvv, " +
      "isolate the failing call, form a hypothesis, verify with one cheap test, then fix. " +
      "Don't guess from error codes. Use traces, fork tests, and cast call.",
    prompt: `Error: ${error}`,
    maxTokens: 4000,
  });

  await writeProjectFile("debug.md", res.text);
  done(`wrote ${c.bold("debug.md")}`);

  await appendSection("Debug session", `**Error:** ${error}\n\n${res.text}`);

  if (isAgent()) {
    console.log(`  context_loaded: true`);
  }

  outro(`${c.faint("next")}  ${c.bold("eth audit")} ${c.faint("once it passes")}  ${c.bold("eth build")} ${c.faint("to implement the fix")}`);
}
