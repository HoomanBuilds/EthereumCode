import { appendFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { homedir } from "node:os";
import { c } from "../ui/theme.js";
import { emit } from "../util/output.js";

export async function cmdFeedback(argv: string[]): Promise<void> {
  if (argv.length === 0 || argv[0] === "--help") {
    console.log("usage: eth feedback \"<text>\"");
    return;
  }
  const text = argv.join(" ");
  const dir = resolve(homedir(), ".ethereum.new");
  await mkdir(dir, { recursive: true });
  const line = JSON.stringify({ ts: new Date().toISOString(), text }) + "\n";
  await appendFile(resolve(dir, "feedback.jsonl"), line);
  emit(
    () => console.log(c.faint("  thanks. saved locally; will sync when wired.")),
    { command: "feedback", saved: true }
  );
}
