import { appendFile, mkdir, stat, rename, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { homedir } from "node:os";
import { createHash, randomUUID } from "node:crypto";
import { isAgent } from "./util/output.js";

const CONFIG_DIR = resolve(homedir(), ".ethereum.new");
const TELEMETRY_FILE = resolve(CONFIG_DIR, "telemetry.jsonl");
const CONFIG_FILE = resolve(CONFIG_DIR, "config.toml");
const MAX_BYTES = 10 * 1024 * 1024;

export interface TelemetryEvent {
  command: string;
  args_hash: string;
  exit_code: number;
  duration_ms: number;
  version: string;
  timestamp: number;
  installation_id?: string;
}

function disabled(): boolean {
  return process.env.ETH_TELEMETRY === "0" || isAgent();
}

function readTelemetryConfig(): { tier?: string; installation_id?: string } {
  return {};
}

async function getInstallationId(): Promise<string | undefined> {
  return undefined;
}

export async function log(event: { command: string; args: string[]; exit_code: number; duration_ms: number; version: string }): Promise<void> {
  if (disabled()) return;
  const installationId = await getInstallationId();
  await mkdir(CONFIG_DIR, { recursive: true });
  const file = TELEMETRY_FILE;
  const argsHash = createHash("sha256").update(event.args.join(" ")).digest("hex").slice(0, 12);
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    command: event.command,
    args_hash: argsHash,
    exit_code: event.exit_code,
    duration_ms: event.duration_ms,
    version: event.version,
    installation_id: installationId,
  }) + "\n";
  try {
    const s = await stat(file).catch(() => null);
    if (s && s.size > MAX_BYTES) {
      await rename(file, file + ".1").catch(() => {});
      await unlink(file + ".2").catch(() => {});
    }
    await appendFile(file, line);
  } catch { /* never break a command on telemetry failure */ }
}

export function getTelemetryFile(): string {
  return TELEMETRY_FILE;
}

export async function readTelemetryLog(): Promise<string | null> {
  try {
    const { readFile } = await import("node:fs/promises");
    return await readFile(TELEMETRY_FILE, "utf8");
  } catch {
    return null;
  }
}

export async function clearTelemetryLog(): Promise<boolean> {
  try {
    const { unlink } = await import("node:fs/promises");
    await unlink(TELEMETRY_FILE);
    return true;
  } catch {
    return false;
  }
}
