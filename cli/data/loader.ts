import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Repo, SkillEntry, Mcp } from "./types.js";

const here = dirname(fileURLToPath(import.meta.url));
const CANDIDATES = [
  resolve(here, "..", "cli", "data"),
  resolve(here, "..", "data"),
  resolve(here, "..", "..", "cli", "data"),
];

let repos: Repo[] | null = null;
let skills: SkillEntry[] | null = null;
let mcps: Mcp[] | null = null;

async function readJson<T>(name: string): Promise<T> {
  let lastErr: unknown = null;
  for (const base of CANDIDATES) {
    try {
      const path = resolve(base, name);
      const txt = await readFile(path, "utf8");
      return JSON.parse(txt) as T;
    } catch (err) {
      lastErr = err;
    }
  }
  throw new Error(`could not load ${name}: ${String(lastErr)}`);
}

export async function getRepos(): Promise<Repo[]> {
  if (!repos) repos = await readJson<Repo[]>("clonable-repos.json");
  return repos;
}

export async function getSkills(): Promise<SkillEntry[]> {
  if (!skills) skills = await readJson<SkillEntry[]>("eth-skills.json");
  return skills;
}

export async function getMcps(): Promise<Mcp[]> {
  if (!mcps) mcps = await readJson<Mcp[]>("eth-mcps.json");
  return mcps;
}
