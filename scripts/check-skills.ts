// scripts/check-skills.ts
import { readdir, readFile, stat } from "node:fs/promises";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SKILLS } from "../cli/skills/registry.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "skills");

interface Frontmatter {
  name?: string;
  description?: string;
}

function parseFrontmatter(md: string): Frontmatter {
  const m = md.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const fm: Frontmatter = {};
  for (const line of m[1]!.split("\n")) {
    const [k, ...v] = line.split(":");
    if (!k) continue;
    fm[k.trim() as keyof Frontmatter] = v.join(":").trim();
  }
  return fm;
}

async function main(): Promise<void> {
  const phases = await readdir(root, { withFileTypes: true });
  const slugs = new Map<string, string>();
  let errors = 0;

  for (const phase of phases) {
    if (!phase.isDirectory()) continue;
    const phaseDir = join(root, phase.name);
    for (const slug of await readdir(phaseDir, { withFileTypes: true })) {
      if (!slug.isDirectory()) continue;
      const skillFile = join(phaseDir, slug.name, "SKILL.md");
      try {
        await stat(skillFile);
      } catch {
        console.error(`✗ missing SKILL.md: ${skillFile}`);
        errors++;
        continue;
      }
      if (slugs.has(slug.name)) {
        console.error(`✗ duplicate slug "${slug.name}" in ${phase.name} and ${slugs.get(slug.name)}`);
        errors++;
      }
      slugs.set(slug.name, phase.name);
      const md = await readFile(skillFile, "utf8");
      const fm = parseFrontmatter(md);
      if (!fm.name) {
        console.error(`✗ missing frontmatter "name" in ${skillFile}`);
        errors++;
      }
      if (!fm.description) {
        console.error(`✗ missing frontmatter "description" in ${skillFile}`);
        errors++;
      }
      if (fm.name && fm.name !== slug.name) {
        console.error(`✗ frontmatter name "${fm.name}" != dir "${slug.name}"`);
        errors++;
      }
    }
  }

  const registrySlugs = new Set(Object.values(SKILLS).flat());
  for (const s of registrySlugs) {
    if (!slugs.has(s)) {
      console.error(`✗ registry slug "${s}" not found on disk`);
      errors++;
    }
  }

  if (errors > 0) {
    console.error(`\n${errors} error(s)`);
    process.exit(1);
  }
  console.log(`✓ ${slugs.size} skills, all registry slugs resolve, frontmatter ok`);
}

main();
