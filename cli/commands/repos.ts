import { c } from "../ui/theme.js";
import { emit } from "../util/output.js";
import { getRepos } from "../data/loader.js";
import { spawn } from "node:child_process";

export async function cmdRepos(argv: string[]): Promise<void> {
  if (argv[0] === "--help") {
    console.log("usage: eth repos [--category <c>] [--clone <slug>]");
    return;
  }
  const repos = await getRepos();
  let filtered = repos;
  const catIdx = argv.indexOf("--category");
  if (catIdx >= 0) {
    const cat = argv[catIdx + 1];
    if (cat) filtered = filtered.filter(r => r.category === cat);
  }
  const cloneIdx = argv.indexOf("--clone");
  if (cloneIdx >= 0) {
    const slug = argv[cloneIdx + 1];
    const r = repos.find(x => x.slug === slug);
    if (!r) {
      console.error(c.bold(`unknown repo: ${slug}`));
      process.exit(1);
    }
    const url = `https://github.com/${r.repo}.git`;
    await new Promise<void>((res, rej) => {
      const p = spawn("git", ["clone", url], { stdio: "inherit" });
      p.on("exit", code => code === 0 ? res() : rej(new Error(`clone failed: ${code}`)));
    });
    return;
  }
  emit(
    () => {
      for (const r of filtered) {
        console.log(`  ${c.bold(r.slug.padEnd(28))} ${c.faint(r.category.padEnd(18))} ${r.description}`);
      }
    },
    { command: "repos", count: filtered.length, repos: filtered }
  );
}
