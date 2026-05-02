import { existsSync, rmSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { c } from "../ui/theme.js";
import { emit } from "../util/output.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function getSkillsRoot(): string {
  const devPath = join(__dirname, "..", "..", "skills");
  if (existsSync(devPath)) return devPath;
  const distPath = join(__dirname, "..", "..", "..", "skills");
  if (existsSync(distPath)) return distPath;
  return "";
}

function discoverExpectedSkills(): string[] {
  const root = getSkillsRoot();
  if (!root) return [];
  const phases = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const skills: string[] = [];
  for (const phase of phases) {
    const phaseDir = join(root, phase);
    if (!existsSync(phaseDir)) continue;
    for (const entry of readdirSync(phaseDir, { withFileTypes: true })) {
      if (entry.isDirectory() && existsSync(join(phaseDir, entry.name, "SKILL.md"))) {
        skills.push(entry.name);
      }
    }
  }
  return skills;
}

export async function cmdUninstall(argv: string[]): Promise<void> {
  const hasYes = argv.includes("--yes") || argv.includes("-y");
  const expected = discoverExpectedSkills();
  const claudeSkillsDir = join(homedir(), ".claude", "skills");
  const codexSkillsDir = join(homedir(), ".codex", "skills");
  const configDir = join(homedir(), ".ethereum.new");
  const removedClaude: string[] = [];
  const removedCodex: string[] = [];
  const removedAny = new Set<string>();

  for (const skill of expected) {
    const claudePath = join(claudeSkillsDir, skill);
    if (existsSync(claudePath)) {
      rmSync(claudePath, { recursive: true, force: true });
      removedClaude.push(skill);
      removedAny.add(skill);
    }
    const codexPath = join(codexSkillsDir, skill);
    if (existsSync(codexPath)) {
      rmSync(codexPath, { recursive: true, force: true });
      removedCodex.push(skill);
      removedAny.add(skill);
    }
  }

  if (existsSync(configDir)) {
    rmSync(configDir, { recursive: true, force: true });
  }

  if (removedAny.size === 0 && !existsSync(configDir)) {
    emit(
      () => console.log(c.faint("  nothing to uninstall.")),
      { command: "uninstall", removed: [] }
    );
    return;
  }

  emit(
    () => {
      console.log(c.bold(`  removed ${removedAny.size} skills:`));
      if (removedClaude.length > 0) {
        console.log(c.bold(`  ~/.claude/skills/`));
        for (const s of removedClaude) console.log(`    - ${s}`);
        console.log("");
      }
      if (removedCodex.length > 0) {
        console.log(c.bold(`  ~/.codex/skills/`));
        for (const s of removedCodex) console.log(`    - ${s}`);
        console.log("");
      }
      console.log(c.faint("  run ") + c.bold("eth init") + c.faint(" to reinstall."));
    },
    { command: "uninstall", removed: [...removedAny] }
  );
}
