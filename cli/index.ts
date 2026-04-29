import { banner } from "./ui/banner.js";
import { c, g } from "./ui/theme.js";
import { cmdNew } from "./commands/new.js";
import { cmdIdea } from "./commands/idea.js";
import { cmdBuild } from "./commands/build.js";
import { cmdShip } from "./commands/ship.js";
import { cmdAudit } from "./commands/audit.js";
import { cmdRaise } from "./commands/raise.js";
import { cmdDoctor } from "./commands/doctor.js";
import { cmdInit } from "./commands/init.js";

type Cmd = (argv: string[]) => Promise<void>;

const commands: Record<string, { run: Cmd; summary: string }> = {
  new: { run: cmdNew, summary: "guided flow: idea → build → ship" },
  idea: { run: cmdIdea, summary: "generate a fundable ethereum idea" },
  build: { run: cmdBuild, summary: "contracts + frontend from a brief" },
  audit: { run: cmdAudit, summary: "security pass before you ship" },
  ship: { run: cmdShip, summary: "deploy + verify + launch pack" },
  raise: { run: cmdRaise, summary: "deck + investor map for your round" },
  doctor: { run: cmdDoctor, summary: "verify your toolchain" },
  init: { run: cmdInit, summary: "install skills into ~/.claude and ~/.codex" },
};

function help(): void {
  const lines: string[] = [];
  lines.push(banner());
  lines.push("");
  lines.push(c.faint("  usage"));
  lines.push(`    ${c.bold("eth")} ${c.accent("<command>")} ${c.faint("[options]")}`);
  lines.push("");
  lines.push(c.faint("  commands"));
  const pad = 8;
  for (const [name, meta] of Object.entries(commands)) {
    lines.push(`    ${c.bold(name.padEnd(pad))} ${c.faint(meta.summary)}`);
  }
  lines.push("");
  lines.push(c.faint(`  run ${c.bold("eth new")} to start.`));
  lines.push("");
  console.log(lines.join("\n"));
}

async function main(): Promise<void> {
  const [, , cmd, ...rest] = process.argv;
  if (!cmd || cmd === "-h" || cmd === "--help" || cmd === "help") {
    help();
    return;
  }
  if (cmd === "-v" || cmd === "--version") {
    // Version is the only place where we allow a plain number.
    const { readFile } = await import("node:fs/promises");
    const { fileURLToPath } = await import("node:url");
    const { dirname, resolve } = await import("node:path");
    const here = dirname(fileURLToPath(import.meta.url));
    try {
      const pkg = JSON.parse(await readFile(resolve(here, "../package.json"), "utf8"));
      console.log(pkg.version);
    } catch {
      console.log("0.0.0");
    }
    return;
  }
  const entry = commands[cmd];
  if (!entry) {
    console.error(`  ${c.bad(g.cross)} unknown command: ${c.bold(cmd)}`);
    console.error(`  ${c.faint("run")} ${c.bold("eth --help")}`);
    process.exit(1);
  }
  try {
    await entry.run(rest);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`\n  ${c.bad(g.cross)} ${msg}\n`);
    process.exit(1);
  }
}

main();
