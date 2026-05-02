import { c } from "../ui/theme.js";
import { emit } from "../util/output.js";
import { getSkills } from "../data/loader.js";
import { loadSkill } from "../skills/loader.js";
import type { SkillSlug } from "../skills/registry.js";

export async function cmdSkills(argv: string[]): Promise<void> {
  if (argv[0] === "--help") {
    console.log("usage: eth skills [list|show <slug>]");
    return;
  }
  if (argv[0] === "show" && argv[1]) {
    try {
      const md = await loadSkill(argv[1] as SkillSlug);
      console.log(md.markdown);
    } catch {
      console.error(c.bad(`  unknown skill: ${c.bold(argv[1])}`));
      process.exit(1);
    }
    return;
  }
  const skills = await getSkills();
  emit(
    () => {
      for (const s of skills) {
        const tag = s.official ? c.bold("[official]") : c.faint("[community]");
        console.log(`  ${tag} ${c.bold(s.slug.padEnd(32))} ${c.faint(s.description)}`);
      }
    },
    { command: "skills", count: skills.length, skills }
  );
}
