import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { homedir } from "node:os";
import { c } from "../ui/theme.js";
import { emit } from "../util/output.js";
import { readFileSync, existsSync } from "node:fs";

const CONFIG_DIR = resolve(homedir(), ".ethereum.new");
const CONFIG_FILE = resolve(CONFIG_DIR, "config.toml");

function readConfigRaw(): string | null {
  try {
    return readFileSync(CONFIG_FILE, "utf8");
  } catch {
    return null;
  }
}

async function writeConfigLine(key: string, value: string): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });
  let content = "";
  try {
    content = await readFile(CONFIG_FILE, "utf8");
  } catch { /* file doesn't exist yet */ }

  const lines = content.split("\n");
  let found = false;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i]!.trim();
    if (trimmed.startsWith(key + " ") || trimmed.startsWith(key + "=")) {
      lines[i] = `${key} = "${value}"`;
      found = true;
    }
  }
  if (!found) {
    lines.push(`${key} = "${value}"`);
  }
  await writeFile(CONFIG_FILE, lines.join("\n") + "\n");
}

export async function cmdTelemetry(argv: string[]): Promise<void> {
  if (argv[0] === "--help" || argv[0] === "-h") {
    console.log("usage: eth telemetry [show|clear|disable|enable]");
    return;
  }

  const sub = argv[0];

  if (sub === "show") {
    const { readTelemetryLog } = await import("../telemetry.js");
    const log = await readTelemetryLog();
    emit(
      () => {
        if (!log) {
          console.log(c.faint("  no telemetry data yet."));
          return;
        }
        const lines = log.trim().split("\n");
        console.log(c.bold(`  ${lines.length} events`));
        for (const line of lines.slice(-20)) {
          const entry = JSON.parse(line) as { command: string; args_hash: string; exit_code: number; duration_ms: number; ts: string };
          console.log(`  ${c.faint(entry.ts.slice(0, 19).replace("T", " "))}  ${c.bold(entry.command.padEnd(12))}  code=${entry.exit_code}  ${entry.duration_ms}ms`);
        }
      },
      { command: "telemetry.show", events: log ? log.trim().split("\n").map(l => JSON.parse(l)) : [] }
    );
    return;
  }

  if (sub === "clear") {
    const { clearTelemetryLog } = await import("../telemetry.js");
    const ok = await clearTelemetryLog();
    emit(
      () => console.log(ok ? c.faint("  telemetry log cleared.") : c.faint("  nothing to clear.")),
      { command: "telemetry.clear", cleared: ok }
    );
    return;
  }

  if (sub === "disable") {
    await writeConfigLine("telemetry", "false");
    emit(
      () => console.log(c.faint("  telemetry disabled. set ETH_TELEMETRY=1 or edit config.toml to re-enable.")),
      { command: "telemetry.disable", enabled: false }
    );
    return;
  }

  if (sub === "enable") {
    await writeConfigLine("telemetry", "true");
    emit(
      () => console.log(c.faint("  telemetry enabled.")),
      { command: "telemetry.enable", enabled: true }
    );
    return;
  }

  console.log("usage: eth telemetry [show|clear|disable|enable]");
}
