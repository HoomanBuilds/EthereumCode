import { intro, outro, select, step, done, confirm, text, warnApiKey } from "../ui/prompt.js";
import { c } from "../ui/theme.js";
import { parseArgs } from "../util/args.js";
import { runReviewer } from "../agents/reviewer.js";
import { deploy } from "../deploy/deploy.js";
import { writeProjectFile } from "../util/fs.js";
import { appendSection, readContext } from "../handoff/context.js";
import { isAgent } from "../util/output.js";
import { loadConfig } from "../util/env.js";
import { execSync } from "node:child_process";
import { readdirSync, existsSync, mkdirSync, statSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { writeConfigValue } from "./config.js";
import { findProjectRoot } from "../deploy/deploy.js";

export async function cmdShip(argv: string[]): Promise<void> {
  const args = parseArgs(argv);
  await warnApiKey();
  intro("ship");

  const ctx = await readContext();
  if (isAgent()) {
    console.log(`  context_loaded: ${ctx !== null}`);
  }

  const target = args.testnet
    ? "testnet"
    : args.mainnet
      ? "mainnet"
      : await select<"testnet" | "mainnet">("deploy target", [
          { value: "testnet", label: "testnet", hint: "base sepolia" },
          { value: "mainnet", label: "mainnet", hint: "real funds" },
        ]);

  step("reviewer qa pass");
  const review = await runReviewer();
  if (!review.ok) {
    throw new Error(`reviewer blocked: ${review.reason}`);
  }
  done("qa green");

  let cfg = await loadConfig();
  if (!cfg.walletKeyPath) {
    await setupWalletPrompt();
    cfg = await loadConfig();
    if (!cfg.walletKeyPath) {
      throw new Error("wallet not configured — cannot deploy. run eth doctor --init to set it up.");
    }
  }

  const projectRoot = findProjectRoot(process.cwd());
  if (!projectRoot) {
    throw new Error("no foundry project found. run eth build first, or cd into your project directory.");
  }

  const envValues = await gatherDeployEnv(projectRoot);
  step(`deploying to ${c.bold(target)}`);
  const result = await deploy({ target, env: envValues });
  done(`contract at ${c.bold(result.address)}`);

  step("generating launch pack");
  await writeProjectFile("launch/tweet.md", result.tweet);
  await writeProjectFile("launch/ph.md", result.ph);
  await writeProjectFile("launch/frame.md", result.frame);
  done("launch pack written to ./launch");

  const shipBody = `**Target:** ${target}\n**Address:** ${result.address}\n**URL:** ${result.url}\n\nQA: ${review.ok ? "green" : review.reason}`;
  await appendSection("Ship status", shipBody);

  outro(`${c.faint("shipped.")}  ${c.bold(result.url)}`);
}

async function gatherDeployEnv(projectRoot: string) {
  const envFile = join(projectRoot, "deploy.env");
  const existing: Record<string, string> = {};

  if (existsSync(envFile)) {
    const raw = readFileSync(envFile, "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq > 0) {
        existing[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
      }
    }
  }

  const vaultAsset = existing["VAULT_ASSET"] ?? await text("underlying asset address", "ERC-20 address (e.g. USDC)");
  const vaultName = existing["VAULT_NAME"] ?? await text("vault name", "Stablecoin Yield Vault");
  const vaultSymbol = existing["VAULT_SYMBOL"] ?? await text("vault symbol", "scUSDC");
  const vaultCap = existing["VAULT_CAP"] ?? await text("deposit cap", "1000000");
  const vaultOwner = existing["VAULT_OWNER"] ?? await text("owner address", "your address");

  const lines = [
    `VAULT_ASSET=${vaultAsset}`,
    `VAULT_NAME=${vaultName}`,
    `VAULT_SYMBOL=${vaultSymbol}`,
    `VAULT_CAP=${vaultCap}`,
    `VAULT_OWNER=${vaultOwner}`,
    "",
  ].join("\n");

  writeFileSync(envFile, lines);

  return {
    vaultAsset,
    vaultName,
    vaultSymbol,
    vaultCap,
    vaultOwner,
  };
}

function getKeystoreDir(): string {
  return join(homedir(), ".foundry", "keystores");
}

function getLatestKeystore(): string | null {
  const dir = getKeystoreDir();
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir).filter((f) => !f.startsWith("."));
  if (files.length === 0) return null;
  const withStat = files.map((f) => ({ name: f, mtime: statSync(join(dir, f)).mtimeMs }));
  withStat.sort((a, b) => b.mtime - a.mtime);
  return join(dir, withStat[0]!.name);
}

async function setupWalletPrompt(): Promise<void> {
  console.log("");
  console.log(c.faint("  no wallet configured."));
  console.log("");

  const dir = getKeystoreDir();
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => !f.startsWith(".")) : [];

  if (files.length > 0) {
    step(`found ${files.length} keystore(s) in ~/.foundry/keystores`);
    const options = files.map((f) => ({ value: join(dir, f), label: f }));
    const choice = await select<string>("pick a keystore", options);
    await writeConfigValue("wallet_key_path", choice);
    done(`wallet set to ${c.bold(choice)}`);
    return;
  }

  const hasCast = (() => { try { execSync("which cast", { stdio: "pipe" }); return true; } catch { return false; } })();

  if (hasCast) {
    const wantNew = await confirm("create a new wallet?", true);
    if (wantNew) {
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      step("creating keystore (enter a password when prompted)");
      execSync(`cast wallet new "${dir}"`, { stdio: "inherit" });

      const path = getLatestKeystore();
      if (path) {
        await writeConfigValue("wallet_key_path", path);
        done(`wallet set to ${c.bold(path)}`);
        return;
      }
    }
  }

  const path = await text("wallet key path", "path to keystore or private key file");
  if (path) {
    await writeConfigValue("wallet_key_path", path);
    done(`wallet set to ${c.bold(path)}`);
  }
}
