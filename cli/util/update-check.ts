import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { homedir } from "node:os";
import { isAgent } from "./output.js";

const TTL_MS = 24 * 60 * 60 * 1000;

interface CacheEntry { checkedAt: number; latest: string }

export async function maybeNudge(currentVersion: string): Promise<void> {
  if (isAgent()) return;
  if (process.env.ETH_TELEMETRY === "0") return;
  const dir = resolve(homedir(), ".ethereum.new");
  const cacheFile = resolve(dir, "update-check.json");
  let cache: CacheEntry | null = null;
  try { cache = JSON.parse(await readFile(cacheFile, "utf8")); } catch { /* fresh */ }
  const now = Date.now();
  let latest: string | null = cache?.latest ?? null;
  if (!cache || now - cache.checkedAt > TTL_MS) {
    try {
      const res = await fetch("https://registry.npmjs.org/ethereum.new/latest", { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        const j = await res.json() as { version: string };
        latest = j.version;
        await mkdir(dir, { recursive: true });
        await writeFile(cacheFile, JSON.stringify({ checkedAt: now, latest }));
      }
    } catch { /* offline; skip silently */ }
  }
  if (latest && latest !== currentVersion) {
    process.stderr.write(`\n  update available: ${currentVersion} → ${latest}  ·  npm i -g ethereum.new\n`);
  }
}
