import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { homedir } from "node:os";
import { c } from "../ui/theme.js";
import { emit } from "../util/output.js";
import { loadConfig } from "../util/env.js";

const CONFIG_DIR = resolve(homedir(), ".ethereum.new");
const CONFIG_FILE = resolve(CONFIG_DIR, "config.toml");

interface ConfigEntry {
  key: string;
  label: string;
  description: string;
  sensitive?: boolean;
}

const KNOWN_KEYS: ConfigEntry[] = [
  { key: "chain", label: "default chain", description: "mainnet, base, arbitrum, optimism, zksync" },
  { key: "anthropic_key", label: "anthropic key", description: "sk-ant-...", sensitive: true },
  { key: "rpc", label: "rpc override", description: "custom RPC endpoint" },
  { key: "wallet_key_path", label: "wallet key path", description: "path to wallet key file" },
  { key: "wallet_password_file", label: "wallet password", description: "path to wallet password file" },
  { key: "etherscan_key", label: "etherscan key", description: "Etherscan API key for verification" },
  { key: "telemetry", label: "telemetry", description: "true or false" },
];

async function readConfigRaw(): Promise<string> {
  try {
    return await readFile(CONFIG_FILE, "utf8");
  } catch {
    return "";
  }
}

function parseConfigValue(content: string, key: string): string | null {
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#") || !trimmed) continue;
    const m = trimmed.match(/^([a-zA-Z_][\w]*)\s*=\s*"(.*)"$/);
    if (m && m[1] === key && m[2] !== undefined) return m[2];
  }
  return null;
}

async function writeConfigValue(key: string, value: string): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });
  const content = await readConfigRaw();
  const lines = content.split("\n");
  let found = false;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i]!.trim();
    if (trimmed.startsWith("#") || !trimmed) continue;
    const m = trimmed.match(/^([a-zA-Z_][\w]*)\s*=\s*".*"$/);
    if (m && m[1] === key) {
      lines[i] = `${key} = "${value}"`;
      found = true;
      break;
    }
  }
  if (!found) {
    if (content.length > 0 && !content.endsWith("\n")) lines.push("");
    lines.push(`${key} = "${value}"`);
  }
  await writeFile(CONFIG_FILE, lines.join("\n") + "\n");
}

function maskValue(value: string): string {
  if (value.length <= 8) return "****";
  return value.slice(0, 4) + "..." + value.slice(-4);
}

export async function cmdConfig(argv: string[]): Promise<void> {
  if (argv[0] === "--help") {
    console.log("usage: eth config [show|set <key> <value>|unset <key>]");
    return;
  }

  const sub = argv[0];

  if (!sub || sub === "show") {
    const config = await loadConfig();
    const content = await readConfigRaw();

    emit(
      () => {
        console.log(c.bold(`  config`));
        console.log(c.faint(`  ${CONFIG_FILE}`));
        console.log("");
        for (const entry of KNOWN_KEYS) {
          const raw = parseConfigValue(content, entry.key);
          const value = raw
            ? (entry.sensitive ? maskValue(raw) : raw)
            : c.faint("(not set)");
          console.log(`  ${c.bold(entry.key.padEnd(22))} ${value}`);
        }
      },
      { command: "config.show", config },
    );
    return;
  }

  if (sub === "set") {
    const key = argv[1];
    const value = argv[2];
    if (!key || !value) {
      console.error("usage: eth config set <key> <value>");
      return;
    }
    await writeConfigValue(key, value);
    const found = KNOWN_KEYS.find((e) => e.key === key);
    const display = found?.sensitive ? maskValue(value) : value;
    emit(
      () => console.log(c.faint(`  ${key} = "${display}"`)),
      { command: "config.set", key, value },
    );
    return;
  }

  if (sub === "unset") {
    const key = argv[1];
    if (!key) {
      console.error("usage: eth config unset <key>");
      return;
    }
    const content = await readConfigRaw();
    const lines = content.split("\n").filter((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("#") || !trimmed) return true;
      const m = trimmed.match(/^([a-zA-Z_][\w]*)\s*=\s*".*"$/);
      return m?.[1] !== key;
    });
    await writeFile(CONFIG_FILE, lines.join("\n") + "\n");
    emit(
      () => console.log(c.faint(`  ${key} removed.`)),
      { command: "config.unset", key },
    );
    return;
  }

  console.log("usage: eth config [show|set <key> <value>|unset <key>]");
}
