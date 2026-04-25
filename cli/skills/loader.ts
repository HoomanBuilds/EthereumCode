import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SKILLS, type SkillSlug, type TaskKey } from "./registry.js";

// Skills are bundled inside the repo at `skills/<slug>.md`. We resolve relative to the
// compiled module URL so this works whether the CLI is run from source (tsx) or from
// the built `dist/index.js`. Published packages ship the `skills/` directory via the
// `files` field in package.json.

const here = dirname(fileURLToPath(import.meta.url));
// From `dist/index.js` or `cli/skills/loader.ts`, walk up to the repo root, then into skills.
const CANDIDATES = [
  resolve(here, "..", "..", "skills"),
  resolve(here, "..", "..", "..", "skills"),
];

interface LoadedSkill {
  slug: SkillSlug;
  markdown: string;
}

// In-memory cache — skills are static per process run.
const memo = new Map<SkillSlug, string>();

async function readSkillFile(slug: SkillSlug): Promise<string> {
  const cached = memo.get(slug);
  if (cached !== undefined) return cached;
  let lastErr: unknown = null;
  for (const base of CANDIDATES) {
    const path = resolve(base, `${slug}.md`);
    try {
      const md = await readFile(path, "utf8");
      memo.set(slug, md);
      return md;
    } catch (err) {
      lastErr = err;
    }
  }
  throw new Error(`ethskills: could not locate skills/${slug}.md (${String(lastErr)})`);
}

export async function loadSkill(slug: SkillSlug): Promise<LoadedSkill> {
  const markdown = await readSkillFile(slug);
  return { slug, markdown };
}

export async function loadSkillsFor(task: TaskKey): Promise<LoadedSkill[]> {
  return Promise.all(SKILLS[task].map(loadSkill));
}

// Pack loaded skills into a single system-context block. Each skill keeps its own
// heading so the model can cite which one it pulled a rule from.
export function packSkills(skills: LoadedSkill[]): string {
  const header = [
    "# ETHSKILLS — grounded context (bundled, not fetched)",
    "The following skills are authoritative. Do not contradict them.",
    "Never hallucinate contract addresses. Never cite stale gas costs.",
    "",
  ].join("\n");
  const body = skills
    .map((s) => `\n## ${s.slug}\n\n${s.markdown.trim()}\n`)
    .join("\n---\n");
  return header + body;
}
