import { intro, outro, text, confirm, select } from "../ui/prompt.js";
import { c, g } from "../ui/theme.js";
import { which, run } from "../util/exec.js";
import { loadConfig } from "../util/env.js";
import { writeConfigValue } from "./config.js";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

export async function cmdDoctor(argv: string[]): Promise<void> {
  intro("doctor");

  if (argv.includes("--init")) {
    await runSetup();
    return;
  }

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
    detail: cfg.rpc ? `${cfg.chain} · ${mask(cfg.rpc)}` : "not configured",
  });
  checks.push({
    name: "wallet",
    ok: Boolean(cfg.walletKeyPath),
    detail: cfg.walletKeyPath ? cfg.walletKeyPath : "not configured",
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
    throw new Error("doctor checks failed");
  }
  outro(c.good("all green."));
}

async function runSetup(): Promise<void> {
  intro("setup");

  const cfg = await loadConfig();

  if (!process.env.ANTHROPIC_API_KEY && !cfg.anthropicKey) {
    const key = await text("anthropic api key", "sk-ant-...");
    await writeConfigValue("anthropic_key", key);
  }

  if (!cfg.rpc) {
    const rpc = await text("rpc url", "https://mainnet.infura.io/v3/... or leave blank for default");
    if (rpc) {
      await writeConfigValue("rpc", rpc);
    }
  }

  const keystoreDir = join(homedir(), ".foundry", "keystores");
  if (!cfg.walletKeyPath) {
    if (existsSync(keystoreDir)) {
      const files = readdirSync(keystoreDir).filter((f) => !f.startsWith("."));
      if (files.length > 0) {
        const options = files.map((f) => ({ value: join(keystoreDir, f), label: f }));
        const choice = await select<string>("pick a keystore", options);
        await writeConfigValue("wallet_key_path", choice);
      } else {
        const wantNew = await confirm("create a new wallet?", true);
        if (wantNew) {
          const path = await text("wallet key path", "path to keystore file");
          if (path) await writeConfigValue("wallet_key_path", path);
        }
      }
    } else {
      const path = await text("wallet key path", "path to keystore file");
      if (path) await writeConfigValue("wallet_key_path", path);
    }
  }

  outro(c.good("setup complete. run eth new to start."));
}

async function forgeVersion(): Promise<string> {
  const out = await run("forge", ["--version"]).catch(() => ({ stdout: "unknown" }));
  return out.stdout.trim().split("\n")[0] ?? "ok";
}

function mask(s: string): string {
  if (s.length < 12) return "***";
  return s.slice(0, 8) + "…" + s.slice(-4);
}
