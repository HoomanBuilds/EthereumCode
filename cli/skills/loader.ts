import { readFile, readdir, stat } from "node:fs/promises";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SKILLS, type SkillSlug, type TaskKey } from "./registry.js";

const here = dirname(fileURLToPath(import.meta.url));
// Resolve `skills/` from both source layout (cli/skills/loader.ts → ../../skills)
// and bundled dist layout (dist/index.js → ../skills).
const CANDIDATES = [
  resolve(here, "..", "skills"),
  resolve(here, "..", "..", "skills"),
  resolve(here, "..", "..", "..", "skills"),
];

interface LoadedSkill {
  slug: SkillSlug;
  markdown: string;
}

const memo = new Map<SkillSlug, string>();
let pathIndex: Map<string, string> | null = null;

async function buildPathIndex(): Promise<Map<string, string>> {
  if (pathIndex) return pathIndex;
  let lastErr: unknown = null;
  for (const base of CANDIDATES) {
    try {
      const phases = await readdir(base, { withFileTypes: true });
      const idx = new Map<string, string>();
      for (const phase of phases) {
        if (!phase.isDirectory()) continue;
        const phaseDir = join(base, phase.name);
        const slugs = await readdir(phaseDir, { withFileTypes: true });
        for (const slugEntry of slugs) {
          if (!slugEntry.isDirectory()) continue;
          const skillPath = join(phaseDir, slugEntry.name, "SKILL.md");
          try {
            await stat(skillPath);
          } catch {
            continue;
          }
          if (idx.has(slugEntry.name)) {
            throw new Error(
              `ethskills: duplicate slug "${slugEntry.name}" in skills/`
            );
          }
          idx.set(slugEntry.name, skillPath);
        }
      }
      if (idx.size === 0) {
        lastErr = new Error(`no skills found under ${base}`);
        continue;
      }
      pathIndex = idx;
      return idx;
    } catch (err) {
      lastErr = err;
    }
  }
  throw new Error(`ethskills: could not locate skills/ directory (${String(lastErr)})`);
}

async function readSkillFile(slug: SkillSlug): Promise<string> {
  const cached = memo.get(slug);
  if (cached !== undefined) return cached;
  const idx = await buildPathIndex();
  const path = idx.get(slug);
  if (!path) {
    throw new Error(`ethskills: skill "${slug}" not found in skills/`);
  }
  const md = await readFile(path, "utf8");
  memo.set(slug, md);
  return md;
}

export async function loadSkill(slug: SkillSlug): Promise<LoadedSkill> {
  const markdown = await readSkillFile(slug);
  return { slug, markdown };
}

export async function loadSkillsFor(task: TaskKey): Promise<LoadedSkill[]> {
  return Promise.all(SKILLS[task].map(loadSkill));
}

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
