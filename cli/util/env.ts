import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";

export interface Config {
  chain: string;
  rpc?: string;
  anthropicKey?: string;
  walletKeyPath?: string;
  walletPasswordFile?: string;
  etherscanKey?: string;
}

// Global config lives at ~/.ethereum.new/config.toml. Never inside a project.
// Minimal TOML — key = "value" only. We don't need sections for v1.
export async function loadConfig(): Promise<Config> {
  const path = resolve(homedir(), ".ethereum.new", "config.toml");
  let raw = "";
  try {
    raw = await readFile(path, "utf8");
  } catch {
    return { chain: "base" };
  }
  const map: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("[")) continue;
    const m = trimmed.match(/^([a-zA-Z_][\w]*)\s*=\s*"(.*)"$/);
    if (m && m[1] !== undefined) map[m[1]] = m[2] ?? "";
  }
  return {
    chain: map.chain ?? "base",
    rpc: map.rpc,
    anthropicKey: map.anthropic_key,
    walletKeyPath: map.wallet_key_path,
    walletPasswordFile: map.wallet_password_file,
    etherscanKey: map.etherscan_key,
  };
}

// Secret scanner. Runs before every file write. Conservative — false positives are fine,
// false negatives are not.
const SECRET_PATTERNS: { name: string; re: RegExp }[] = [
  { name: "ethereum private key", re: /0x[a-fA-F0-9]{64}\b/ },
  { name: "anthropic api key", re: /sk-ant-[A-Za-z0-9_\-]{20,}/ },
  { name: "openai api key", re: /sk-[A-Za-z0-9]{20,}/ },
  { name: "alchemy key in url", re: /alchemy\.com\/v2\/[A-Za-z0-9_\-]{20,}/ },
  { name: "infura key in url", re: /infura\.io\/v3\/[a-f0-9]{20,}/ },
  { name: "etherscan api key", re: /etherscan\.io\/api.*apikey=[A-Z0-9]{20,}/i },
  { name: "aws access key", re: /AKIA[0-9A-Z]{16}/ },
  { name: "generic bearer token", re: /Bearer\s+[A-Za-z0-9_\-.]{20,}/ },
];

export function scanForSecrets(content: string): string | null {
  for (const p of SECRET_PATTERNS) {
    if (p.re.test(content)) return p.name;
  }
  return null;
}
