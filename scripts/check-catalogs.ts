import { readFile, access } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

const REPO_CATEGORIES = new Set([
  "defi-primitives", "accounts-aa", "infra", "l2-frameworks",
  "zk", "indexing", "mev", "tooling",
]);
const PHASES = new Set(["idea", "build", "audit", "ship", "launch"]);
const TRANSPORTS = new Set(["stdio", "http"]);

let errors = 0;
const fail = (m: string) => { console.error(`✗ ${m}`); errors++; };

async function loadJson<T>(path: string): Promise<T | null> {
  try {
    await access(path);
  } catch {
    fail(`missing ${path}`);
    return null;
  }
  return JSON.parse(await readFile(path, "utf8")) as T;
}

async function main(): Promise<void> {
  const repos = await loadJson<unknown[]>(resolve(root, "cli/data/clonable-repos.json"));
  if (Array.isArray(repos)) {
    for (const r of repos) {
      const o = r as Record<string, unknown>;
      if (typeof o.slug !== "string") fail(`repo missing slug: ${JSON.stringify(o)}`);
      if (typeof o.name !== "string") fail(`repo ${o.slug}: name not string`);
      if (typeof o.repo !== "string") fail(`repo ${o.slug}: repo not string`);
      if (typeof o.description !== "string") fail(`repo ${o.slug}: description not string`);
      if (!REPO_CATEGORIES.has(o.category as string)) fail(`repo ${o.slug}: bad category ${o.category}`);
      if (!Array.isArray(o.tags)) fail(`repo ${o.slug}: tags not array`);
      if (!Array.isArray(o.stack)) fail(`repo ${o.slug}: stack not array`);
      if (!Array.isArray(o.chains)) fail(`repo ${o.slug}: chains not array`);
    }
    console.log(`  ${repos.length} repos`);
  }

  const skills = await loadJson<unknown[]>(resolve(root, "cli/data/eth-skills.json"));
  if (Array.isArray(skills)) {
    for (const s of skills) {
      const o = s as Record<string, unknown>;
      if (typeof o.slug !== "string") fail(`skill missing slug`);
      if (!PHASES.has(o.phase as string)) fail(`skill ${o.slug}: bad phase ${o.phase}`);
      if (typeof o.name !== "string") fail(`skill ${o.slug}: name not string`);
      if (typeof o.description !== "string") fail(`skill ${o.slug}: description not string`);
      if (typeof o.official !== "boolean") fail(`skill ${o.slug}: official not boolean`);
      if (typeof o.source !== "string") fail(`skill ${o.slug}: source not string`);
    }
    console.log(`  ${skills.length} skills`);
  }

  const mcps = await loadJson<unknown[]>(resolve(root, "cli/data/eth-mcps.json"));
  if (Array.isArray(mcps)) {
    for (const m of mcps) {
      const o = m as Record<string, unknown>;
      if (typeof o.name !== "string") fail(`mcp missing name`);
      if (typeof o.repo !== "string") fail(`mcp ${o.name}: repo not string`);
      if (typeof o.description !== "string") fail(`mcp ${o.name}: description not string`);
      if (!TRANSPORTS.has(o.transport as string)) fail(`mcp ${o.name}: bad transport ${o.transport}`);
      if (!Array.isArray(o.tools)) fail(`mcp ${o.name}: tools not array`);
    }
    console.log(`  ${mcps.length} mcps`);
  }

  if (errors > 0) {
    console.error(`\n${errors} error(s)`);
    process.exit(1);
  }
  console.log("✓ catalogs ok");
}

main();
