import process from "node:process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { c } from "../ui/theme.js";

const CLEAR_SCREEN = "\x1b[2J";
const ALT_SCREEN_ON = "\x1b[?1049h";
const ALT_SCREEN_OFF = "\x1b[?1049l";
const CURSOR_HIDE = "\x1b[?25l";
const CURSOR_SHOW = "\x1b[?25h";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST_INDEX = join(__dirname, "../../dist/index.js");

const ICONS = {
  diamond: "◆",
  cube: "◈",
  shield: "◇",
  rocket: "▸",
  target: "◎",
};

interface JourneyPhase {
  label: string;
  icon: string;
  skills: JourneySkill[];
}

interface JourneySkill {
  name: string;
  description: string;
  command: string;
  args: string[];
  taskKey?: string;
}

function detectPhase(): number {
  const cwd = process.cwd();
  const contextDir = `${cwd}/.ethereum.new`;

  if (existsSync(`${contextDir}/idea-context.md`)) {
    try {
      const ctx = readFileSync(`${contextDir}/idea-context.md`, "utf8");
      if (ctx.includes("## Ship status")) return 3;
      if (ctx.includes("## Audit findings")) return 2;
      if (ctx.includes("## Architecture")) return 1;
      if (ctx.includes("## Idea")) return 0;
    } catch { /* ignore */ }
  }

  const buildSignals = [
    "foundry.toml", "hardhat.config.ts", "hardhat.config.js",
    "remappings.txt", "package.json", "src", "test", "script",
    "frontend", "pages", "app",
  ];
  const hasBuildFiles = buildSignals.some((f) => existsSync(`${cwd}/${f}`));
  if (hasBuildFiles) return 1;

  try {
    const entries = readdirSync(cwd).filter((e) => !e.startsWith("."));
    if (entries.length > 0) return 1;
  } catch { /* ignore */ }

  return 0;
}

const PHASES: JourneyPhase[] = [
  {
    label: "Idea — Discovery & Planning",
    icon: ICONS.diamond,
    skills: [
      { name: "eth new", description: "guided flow: idea to ship", command: "new", args: [] },
      { name: "eth idea", description: "generate a fundable idea from your brief", command: "idea", args: [] },
      { name: "eth copilot <topic>", description: "freeform assistant for your question", command: "copilot", args: [] },
    ],
  },
  {
    label: "Build — Contracts + Frontend",
    icon: ICONS.cube,
    skills: [
      { name: "eth build", description: "contracts + frontend from a brief", command: "build", args: [] },
      { name: "eth search", description: "find repos, skills, MCPs for your stack", command: "search", args: [] },
      { name: "eth repos", description: "browse and clone ethereum repos", command: "repos", args: [] },
    ],
  },
  {
    label: "Audit — Security Review",
    icon: ICONS.shield,
    skills: [
      { name: "eth audit", description: "slither + ethskills checklist audit", command: "audit", args: [] },
      { name: "eth skills show security", description: "review security patterns", command: "skills", args: ["show", "security"] },
    ],
  },
  {
    label: "Ship — Deploy & Launch",
    icon: ICONS.rocket,
    skills: [
      { name: "eth ship", description: "deploy + verify + launch pack", command: "ship", args: [] },
      { name: "eth skills show ship", description: "review deployment patterns", command: "skills", args: ["show", "ship"] },
    ],
  },
  {
    label: "Raise — Funding & Growth",
    icon: ICONS.target,
    skills: [
      { name: "eth raise", description: "deck + investor map for your round", command: "raise", args: [] },
    ],
  },
];

function padFooter(lines: string[], footer: string[], rows: number): string[] {
  while (lines.length < rows - footer.length) lines.push("");
  lines.push(...footer);
  return lines.slice(0, rows);
}

function buildScreen(selectedPhase: number, selectedSkill: number, rows: number): string[] {
  const lines: string[] = [];

  lines.push("");
  lines.push(`  ${c.accent("ethereum.new")}  ${c.bold("Developer Journey")}  ${c.faint("idea → build → audit → ship → raise")}`);
  lines.push("");
  lines.push(`  ${c.faint("navigate with ↑↓, press enter to run command, q/esc to quit")}`);
  lines.push("");

  for (let p = 0; p < PHASES.length; p++) {
    const phase = PHASES[p]!;
    const isActivePhase = p === selectedPhase;
    const phaseColor = isActivePhase ? c.accent : c.faint;

    lines.push(`  ${phaseColor(phase.icon)} ${c.bold(phase.label)}`);

    for (let s = 0; s < phase.skills.length; s++) {
      const skill = phase.skills[s]!;
      const isSelected = p === selectedPhase && s === selectedSkill;
      const pointer = isSelected ? `${c.accent("❯")} ` : "  ";
      const nameColor = isSelected ? c.bold : isActivePhase ? (s: string) => s : c.faint;
      const descColor = isSelected ? c.dim : c.faint;

      lines.push(`${pointer}${nameColor(skill.name)}`);
      if (isSelected) {
        lines.push(`    ${descColor(skill.description)}`);
      }
    }
    lines.push("");
  }

  const footer = [
    `  ${c.bold("enter")} ${c.faint("run command")}  ${c.bold("↑↓")} ${c.faint("navigate")}  ${c.faint("q/esc quit")}`,
  ];
  return padFooter(lines, footer, rows);
}

export async function interactiveJourney(_argv: string[]): Promise<void> {
  const stdin = process.stdin;
  const stdout = process.stdout;

  if (!stdin.isTTY) return;

  let selectedPhase = detectPhase();
  let selectedSkill = 0;

  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");

  stdout.write(ALT_SCREEN_ON);
  stdout.write(CURSOR_HIDE);

  function getRows(): number { return stdout.rows || 24; }

  function draw() {
    const screen = buildScreen(selectedPhase, selectedSkill, getRows());
    stdout.write(`${CLEAR_SCREEN}${screen.join("\n")}`);
  }

  draw();

  const onResize = () => draw();
  stdout.on("resize", onResize);

  return new Promise((resolve) => {
    function cleanup() {
      stdout.removeListener("resize", onResize);
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener("data", onData);
      stdout.write(CURSOR_SHOW);
      stdout.write(ALT_SCREEN_OFF);
    }

    function onData(key: string) {
      if (key === "\x03") { cleanup(); throw new Error("interrupted"); }
      if (key === "\x1b" || key === "q" || key === "Q") { cleanup(); resolve(); return; }

      if (key === "\r" || key === "\n") {
        const skill = PHASES[selectedPhase]!.skills[selectedSkill];
        if (!skill) return;
        cleanup();
        const child = spawn("node", [DIST_INDEX, skill.command, ...skill.args], {
          stdio: "inherit",
        });
        child.on("close", () => resolve());
        child.on("error", () => { resolve(); });
        return;
      }

      if (key === "\x1b[A") {
        selectedSkill--;
        if (selectedSkill < 0) {
          selectedPhase--;
          if (selectedPhase < 0) {
            selectedPhase = PHASES.length - 1;
            selectedSkill = PHASES[selectedPhase]!.skills.length - 1;
          } else {
            selectedSkill = PHASES[selectedPhase]!.skills.length - 1;
          }
        }
        draw();
        return;
      }

      if (key === "\x1b[B") {
        selectedSkill++;
        if (selectedSkill >= PHASES[selectedPhase]!.skills.length) {
          selectedPhase++;
          selectedSkill = 0;
          if (selectedPhase >= PHASES.length) {
            selectedPhase = 0;
            selectedSkill = 0;
          }
        }
        draw();
        return;
      }
    }

    stdin.on("data", onData);
  });
}
