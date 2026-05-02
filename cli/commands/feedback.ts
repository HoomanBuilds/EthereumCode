import { appendFile, mkdir, readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { c } from "../ui/theme.js";
import { emit } from "../util/output.js";

const CONFIG_DIR = resolve(homedir(), ".ethereum-code");
const FEEDBACK_FILE = resolve(CONFIG_DIR, "feedback.jsonl");
const CONFIG_FILE = resolve(CONFIG_DIR, "config.toml");
const __dirname = dirname(fileURLToPath(import.meta.url));

function getVersion(): string {
  for (const rel of ["../package.json", "../../package.json"]) {
    try {
      const pkg = JSON.parse(readFileSync(resolve(__dirname, rel), "utf8"));
      return (pkg.version as string) ?? "0.0.0";
    } catch { /* try next */ }
  }
  return "0.0.0";
}

async function readConfigValue(key: string): Promise<string | null> {
  try {
    const content = await readFile(CONFIG_FILE, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith(key + " ") || trimmed.startsWith(key + "=")) {
        const m = trimmed.match(/^[\w.]+\s*=\s*"(.*)"$/);
        if (m && m[1] !== undefined) return m[1];
      }
    }
  } catch { /* no config file */ }
  return null;
}

async function submitToConvex(message: string, contact?: string): Promise<boolean> {
  const url = process.env.CONVEX_URL ?? (await readConfigValue("convex_url"));
  if (!url) return false;
  try {
    const res = await fetch(`${url}/api/mutation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: "feedback:submit",
        args: {
          message,
          contact: contact || undefined,
          version: getVersion(),
          platform: `${process.platform}-${process.arch}`,
          timestamp: Date.now(),
        },
      }),
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function cmdFeedback(argv: string[]): Promise<void> {
  if (argv.length === 0 || argv[0] === "--help") {
    console.log('usage: eth feedback "<text>" [--contact <email>] [--convex]');
    return;
  }

  let message = "";
  let contact: string | undefined;
  let useConvex = false;

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === "--contact") {
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        contact = next;
        i++;
      }
      continue;
    }
    if (token === "--convex") {
      useConvex = true;
      continue;
    }
    if (token?.startsWith("--")) continue;
    message += token + " ";
  }
  message = message.trim();

  if (!message) {
    console.log("  message is required.");
    return;
  }

  await mkdir(CONFIG_DIR, { recursive: true });
  const line = JSON.stringify({ ts: new Date().toISOString(), text: message, contact }) + "\n";
  await appendFile(FEEDBACK_FILE, line);

  if (useConvex) {
    const ok = await submitToConvex(message, contact);
    emit(
      () => console.log(ok ? c.faint("  sent to convex. thanks.") : c.faint("  saved locally; convex sync failed.")),
      { command: "feedback", saved: true, convex: ok }
    );
    return;
  }

  emit(
    () => console.log(c.faint("  thanks. saved locally; will sync when wired.")),
    { command: "feedback", saved: true }
  );
}
