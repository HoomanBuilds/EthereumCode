import { cp, mkdir, readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { intro, outro } from "../ui/prompt.js";
import { c, g } from "../ui/theme.js";
import { parseArgs } from "../util/args.js";

const here = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT_CANDIDATES = [
  resolve(here, "..", "skills"),
  resolve(here, "..", "..", "skills"),
  resolve(here, "..", "..", "..", "skills"),
];

interface Skill {
  slug: string;
  srcDir: string;
}

async function findSkillsRoot(): Promise<string> {
  for (const base of SKILL_ROOT_CANDIDATES) {
    try {
      await stat(base);
      return base;
    } catch {
      // try next
    }
  }
  throw new Error("skills bundle missing. reinstall ethereum.new.");
}

async function discoverSkills(root: string): Promise<Skill[]> {
  const skills: Skill[] = [];
  const phases = await readdir(root, { withFileTypes: true });
  for (const phase of phases) {
    if (!phase.isDirectory()) continue;
    const phaseDir = join(root, phase.name);
    const slugs = await readdir(phaseDir, { withFileTypes: true });
    for (const slugEntry of slugs) {
      if (!slugEntry.isDirectory()) continue;
      const skillFile = join(phaseDir, slugEntry.name, "SKILL.md");
      try {
        await stat(skillFile);
        skills.push({ slug: slugEntry.name, srcDir: join(phaseDir, slugEntry.name) });
      } catch {
        // not a skill folder
      }
    }
  }
  skills.sort((a, b) => a.slug.localeCompare(b.slug));
  return skills;
}

interface InstallResult {
  installed: string[];
  skipped: string[];
}

async function installInto(targets: string[], skills: Skill[], force: boolean): Promise<InstallResult> {
  const installed: string[] = [];
  const skipped: string[] = [];
  for (const skill of skills) {
    let copiedAny = false;
    for (const target of targets) {
      const dest = join(target, skill.slug);
      let exists = false;
      try {
        await stat(dest);
        exists = true;
      } catch {
        // missing
      }
      if (exists && !force) continue;
      await mkdir(dirname(dest), { recursive: true });
      await cp(skill.srcDir, dest, { recursive: true, force: true });
      copiedAny = true;
    }
    if (copiedAny) installed.push(skill.slug);
    else skipped.push(skill.slug);
  }
  return { installed, skipped };
}

export async function cmdInit(argv: string[]): Promise<void> {
  const args = parseArgs(argv);
  const force = args.force === true;
  const agent = args.agent === true;

  const root = await findSkillsRoot();
  const skills = await discoverSkills(root);

  const targets = [
    join(homedir(), ".claude", "skills"),
    join(homedir(), ".codex", "skills"),
  ];
  for (const t of targets) await mkdir(t, { recursive: true });

  const { installed, skipped } = await installInto(targets, skills, force);

  if (agent) {
    console.log(`eth init — ${skills.length} skills`);
    if (installed.length) {
      console.log(`installed (${installed.length}):`);
      for (const s of installed) console.log(`  + ${s}`);
    }
    if (skipped.length) {
      console.log(`skipped (${skipped.length}):`);
      for (const s of skipped) console.log(`  = ${s}`);
    }
    return;
  }

  intro("init");
  for (const s of installed) {
    process.stdout.write(`  ${c.good(g.tick)} ${c.bold(s.padEnd(22))} ${c.faint("installed")}\n`);
  }
  for (const s of skipped) {
    process.stdout.write(`  ${c.faint(g.dot)} ${c.bold(s.padEnd(22))} ${c.faint("already present")}\n`);
  }
  process.stdout.write("\n");
  process.stdout.write(`  ${c.faint("targets")}  ~/.claude/skills/  ~/.codex/skills/\n`);
  outro(c.good(`${installed.length} installed · ${skipped.length} skipped`));
}
