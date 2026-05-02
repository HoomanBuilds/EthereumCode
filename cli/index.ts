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
import { cmdSearch } from "./commands/search.js";
import { cmdRepos } from "./commands/repos.js";
import { cmdSkills } from "./commands/skills.js";
import { cmdMcps } from "./commands/mcps.js";
import { cmdCopilot } from "./commands/copilot.js";
import { cmdFeedback } from "./commands/feedback.js";
import { cmdTelemetry } from "./commands/telemetry.js";
import { cmdUninstall } from "./commands/uninstall.js";
import { maybeNudge } from "./util/update-check.js";

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
  search: { run: cmdSearch, summary: "search repos, skills, mcps" },
  repos: { run: cmdRepos, summary: "browse and clone ethereum repos" },
  skills: { run: cmdSkills, summary: "list or show bundled skills" },
  mcps: { run: cmdMcps, summary: "list or install mcp servers" },
  copilot: { run: cmdCopilot, summary: "freeform ethereum dev assistant" },
  feedback: { run: cmdFeedback, summary: "send feedback to the team" },
  telemetry: { run: cmdTelemetry, summary: "manage telemetry data" },
  uninstall: { run: cmdUninstall, summary: "remove skills and config" },
};

function help(): void {
  const lines: string[] = [];
  lines.push(banner());
  lines.push("");
  lines.push(c.faint("  usage"));
  lines.push(`    ${c.bold("eth")} ${c.accent("<command>")} ${c.faint("[options]")}`);
  lines.push("");
  lines.push(c.faint("  commands"));
  const pad = 10;
  for (const [name, meta] of Object.entries(commands)) {
    lines.push(`    ${c.bold(name.padEnd(pad))} ${c.faint(meta.summary)}`);
  }
  lines.push("");
  lines.push(c.faint(`  run ${c.bold("eth new")} to start.`));
  lines.push("");
  console.log(lines.join("\n"));
}

async function getVersion(): Promise<string> {
  const { readFile } = await import("node:fs/promises");
  const { fileURLToPath } = await import("node:url");
  const { dirname, resolve } = await import("node:path");
  const here = dirname(fileURLToPath(import.meta.url));
  try {
    const pkg = JSON.parse(await readFile(resolve(here, "../package.json"), "utf8"));
    return (pkg.version as string) ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const agentIdx = argv.indexOf("--agent");
  if (agentIdx >= 0) {
    argv.splice(agentIdx, 1);
    const { setAgentMode } = await import("./util/output.js");
    setAgentMode(true);
  }
  const [cmd, ...rest] = argv;
  if (!cmd || cmd === "-h" || cmd === "--help" || cmd === "help") {
    help();
    return;
  }
  if (cmd === "-v" || cmd === "--version") {
    console.log(await getVersion());
    return;
  }
  const entry = commands[cmd];
  if (!entry) {
    console.error(`  ${c.bad(g.cross)} unknown command: ${c.bold(cmd)}`);
    console.error(`  ${c.faint("run")} ${c.bold("eth --help")}`);
    process.exit(1);
  }

  const start = Date.now();
  let exitCode = 0;
  try {
    await entry.run(rest);
  } catch (err) {
    exitCode = 1;
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`\n  ${c.bad(g.cross)} ${msg}\n`);
  }
  const duration = Date.now() - start;
  const version = await getVersion();
  const { log } = await import("./telemetry.js");
  await log({ command: cmd, args: rest, exit_code: exitCode, duration_ms: duration, version });
  maybeNudge(version).catch(() => {});
  if (exitCode !== 0) process.exit(1);
}

main();
