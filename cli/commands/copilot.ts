import { invoke } from "../agents/runtime.js";
import { c } from "../ui/theme.js";

export async function cmdCopilot(argv: string[]): Promise<void> {
  if (argv.length === 0 || argv[0] === "--help") {
    console.log("usage: eth copilot <topic>");
    return;
  }
  const topic = argv.join(" ");
  const out = await invoke({
    task: "idea",
    tier: "iterate",
    system: "You are a senior Ethereum founder/engineer assistant. Be concrete. No fluff.",
    prompt: `User asks: ${topic}\n\nGive a tight, actionable answer grounded in the loaded skills.`,
  });
  console.log(c.faint("\n  copilot\n"));
  console.log(out.text);
}
