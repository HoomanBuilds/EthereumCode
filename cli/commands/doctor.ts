import { intro, outro } from "../ui/prompt.js";
import { c, g } from "../ui/theme.js";
import { which, run } from "../util/exec.js";
import { loadConfig } from "../util/env.js";

interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

export async function cmdDoctor(_argv: string[]): Promise<void> {
  intro("doctor");

  const checks: Check[] = [];

  const node = process.versions.node;
  checks.push({ name: "node", ok: Number(node.split(".")[0]) >= 20, detail: `v${node}` });

  const forge = await which("forge");
  checks.push({ name: "foundry", ok: forge.ok, detail: forge.ok ? await forgeVersion() : "not installed · run foundryup" });

  const git = await which("git");
  checks.push({ name: "git", ok: git.ok, detail: git.ok ? "ok" : "missing" });

  const slither = await which("slither");
  checks.push({ name: "slither", ok: slither.ok, detail: slither.ok ? "ok" : "optional · pip install slither-analyzer" });

  const cfg = await loadConfig();
  checks.push({
    name: "rpc",
    ok: Boolean(cfg.rpc),
    detail: cfg.rpc ? `${cfg.chain} · ${mask(cfg.rpc)}` : "not configured · run eth doctor --init",
  });
  checks.push({
    name: "anthropic",
    ok: Boolean(process.env.ANTHROPIC_API_KEY ?? cfg.anthropicKey),
    detail: process.env.ANTHROPIC_API_KEY ?? cfg.anthropicKey ? "ok" : "set ANTHROPIC_API_KEY",
  });

  const pad = 10;
  for (const ch of checks) {
    const glyph = ch.ok ? c.good(g.tick) : c.warn(g.cross);
    process.stdout.write(`  ${glyph} ${c.bold(ch.name.padEnd(pad))} ${c.faint(ch.detail)}\n`);
  }

  const blocked = checks.filter((ch) => !ch.ok && ch.name !== "slither");
  if (blocked.length > 0) {
    outro(c.warn(`${blocked.length} blocker(s). fix and re-run.`));
    process.exit(1);
  }
  outro(c.good("all green."));
}

async function forgeVersion(): Promise<string> {
  const out = await run("forge", ["--version"]).catch(() => ({ stdout: "unknown" }));
  return out.stdout.trim().split("\n")[0] ?? "ok";
}

function mask(s: string): string {
  if (s.length < 12) return "***";
  return s.slice(0, 8) + "…" + s.slice(-4);
}
