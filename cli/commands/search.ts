import { c } from "../ui/theme.js";
import { emit } from "../util/output.js";
import { getRepos, getSkills, getMcps } from "../data/loader.js";

export async function cmdSearch(argv: string[]): Promise<void> {
  if (argv.length === 0 || argv[0] === "--help") {
    console.log("usage: eth search <query>");
    return;
  }
  const q = argv.join(" ").toLowerCase();
  const [repos, skills, mcps] = await Promise.all([getRepos(), getSkills(), getMcps()]);

  const matchRepo = repos.filter(r =>
    r.slug.includes(q) || r.name.toLowerCase().includes(q) ||
    r.description.toLowerCase().includes(q) || r.tags.some(t => t.includes(q))
  );
  const matchSkill = skills.filter(s =>
    s.slug.includes(q) || s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
  );
  const matchMcp = mcps.filter(m =>
    m.name.toLowerCase().includes(q) || m.description.toLowerCase().includes(q)
  );

  emit(
    () => {
      console.log(c.bold(`\n  ${matchRepo.length} repos · ${matchSkill.length} skills · ${matchMcp.length} mcps\n`));
      for (const r of matchRepo) console.log(`  ${c.bold(r.slug.padEnd(28))} ${c.faint(r.description)}`);
      for (const s of matchSkill) console.log(`  ${c.bold(s.slug.padEnd(28))} ${c.faint(s.description)}`);
      for (const m of matchMcp) console.log(`  ${c.bold(m.name.padEnd(28))} ${c.faint(m.description)}`);
    },
    { command: "search", query: q, repos: matchRepo, skills: matchSkill, mcps: matchMcp }
  );
}
