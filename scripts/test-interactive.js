#!/usr/bin/env node
// Automated test suite for CLI commands.
// Non-interactive commands: spawn with pipe (works fine).
// Interactive commands: expect with timed sends (pseudo-TTY).

import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DIST = join(ROOT, "dist", "index.js");
const RESULTS_DIR = join(ROOT, "docs");
const RESULTS_FILE = join(RESULTS_DIR, "test-results.md");
const TEST_TEMP = join(ROOT, "test-temp");

const results = [];

function log(level, msg) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${level.padEnd(5)} ${msg}`);
}

// Run non-interactive command via spawn (piped stdio).
async function runSpawnTest(name, args, opts = {}) {
    const {
    timeout = 15000,
    expectExitZero = !opts.expectExitNonZero,
    expectContains,
    expectNotContains,
    expectExitNonZero = false,
    cwd = ROOT,
    description = name,
    category = "general",
  } = opts;

  log("TEST", `${name}`);

  return new Promise((resolve) => {
    const child = spawn("node", [DIST, ...args], {
      cwd,
      env: { ...process.env, ANTHROPIC_API_KEY: "" },
      stdio: ["pipe", "pipe", "pipe"],
      timeout,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));

    child.on("close", (code) => {
      const issues = [];

      if (expectExitZero && code !== 0) {
        issues.push(`Exit code ${code}, expected 0`);
      }
      if (expectExitNonZero && code === 0) {
        issues.push(`Exit code 0, expected non-zero`);
      }
      if (expectContains && !stdout.includes(expectContains) && !stderr.includes(expectContains)) {
        issues.push(`Expected "${expectContains}" not found in output`);
      }
      if (expectNotContains && (stdout.includes(expectNotContains) || stderr.includes(expectNotContains))) {
        issues.push(`Did not expect "${expectNotContains}" in output`);
      }

      const output = stdout + stderr;
      if (output.includes("TypeError") && !output.includes("stub")) {
        issues.push("Unhandled TypeError in output");
      }
      if (output.includes("Cannot read properties of undefined")) {
        issues.push("Undefined property access");
      }
      if (output.includes("unhandled rejection") || output.includes("Unhandled promise")) {
        issues.push("Unhandled promise rejection");
      }
      if (output.includes("ENOENT") && !output.includes("optional")) {
        issues.push("File not found error");
      }

      const status = issues.length === 0 ? "PASS" : "FAIL";
      const result = {
        category,
        name,
        description,
        status,
        issue: issues.length > 0 ? issues.join("; ") : null,
        exitCode: code,
        stdout: stdout.slice(0, 800),
        stderr: stderr.slice(0, 800),
      };

      results.push(result);
      log(status, `${name}: ${issues.length > 0 ? issues.join("; ") : "OK"}`);
      resolve(result);
    });
  });
}

// Run interactive command via expect (pseudo-TTY).
async function runExpectTest(name, expectScript, opts = {}) {
    const {
    timeout = 30000,
    expectExitZero = !opts.expectExitNonZero,
    expectContains,
    expectNotContains,
    cwd = ROOT,
    description = name,
    category = "general",
  } = opts;

  log("TEST", `${name}`);

  return new Promise((resolve) => {
    const child = spawn("expect", ["-f", "-"], {
      cwd,
      env: { ...process.env, ANTHROPIC_API_KEY: "" },
      stdio: ["pipe", "pipe", "pipe"],
      timeout,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));

    // Write expect script to stdin
    child.stdin.write(expectScript);
    child.stdin.end();

    child.on("close", (code) => {
      const issues = [];

      if (expectExitZero && code !== 0) {
        issues.push(`Exit code ${code}, expected 0`);
      }
      if (expectContains && !stdout.includes(expectContains) && !stderr.includes(expectContains)) {
        issues.push(`Expected "${expectContains}" not found in output`);
      }
      if (expectNotContains && (stdout.includes(expectNotContains) || stderr.includes(expectNotContains))) {
        issues.push(`Did not expect "${expectNotContains}" in output`);
      }

      const output = stdout + stderr;
      if (output.includes("TypeError") && !output.includes("stub")) {
        issues.push("Unhandled TypeError in output");
      }
      if (output.includes("Cannot read properties of undefined")) {
        issues.push("Undefined property access");
      }
      if (output.includes("unhandled rejection") || output.includes("Unhandled promise")) {
        issues.push("Unhandled promise rejection");
      }

      const status = issues.length === 0 ? "PASS" : "FAIL";
      const result = {
        category,
        name,
        description,
        status,
        issue: issues.length > 0 ? issues.join("; ") : null,
        exitCode: code,
        stdout: stdout.slice(0, 800),
        stderr: stderr.slice(0, 800),
      };

      results.push(result);
      log(status, `${name}: ${issues.length > 0 ? issues.join("; ") : "OK"}`);
      resolve(result);
    });
  });
}

async function setupTestDir() {
  if (existsSync(TEST_TEMP)) rmSync(TEST_TEMP, { recursive: true, force: true });
  mkdirSync(TEST_TEMP, { recursive: true });

  writeFileSync(join(TEST_TEMP, "foundry.toml"), `[profile.default]\nsrc = 'src'\nout = 'out'\nlibs = ['lib']\n`);
  mkdirSync(join(TEST_TEMP, "src"), { recursive: true });
  writeFileSync(join(TEST_TEMP, "src", "StableVault.sol"), `// SPDX-License-Identifier: MIT\npragma solidity ^0.8.24;\ncontract StableVault {}\n`);
  mkdirSync(join(TEST_TEMP, "test"), { recursive: true });
  writeFileSync(join(TEST_TEMP, "test", "StableVault.t.sol"), `// SPDX-License-Identifier: MIT\npragma solidity ^0.8.24;\nimport "forge-std/Test.sol";\ncontract StableVaultTest is Test {}\n`);

  const ctxDir = join(TEST_TEMP, ".ethereum-code");
  mkdirSync(ctxDir, { recursive: true });
  writeFileSync(join(ctxDir, "idea-context.md"), `## Idea\nA stablecoin vault on Base\n\n## Architecture\n**Chain:** base\n\n## Audit findings\n**Highs:** 0\n\n## Ship status\n**Target:** testnet\n`);

  writeFileSync(join(TEST_TEMP, "idea.md"), `# Stablecoin Vault\n\nA yield vault for stablecoin LPs on Base.\n`);
}

async function runAllTests() {
  log("INFO", "=== CLI Test Suite ===\n");
  await setupTestDir();

  // ─── HELP & VERSION ──────────────────────────────────
  await runSpawnTest("help", ["--help"], {
    description: "Show help banner and command list",
    category: "core",
    expectExitZero: true,
    expectContains: "ethereum-code",
  });

  await runSpawnTest("version", ["--version"], {
    description: "Show version number",
    category: "core",
    expectExitZero: true,
  });

  // ─── IDEA (expect - TTY required) ────────────────────
  await runExpectTest("idea (curated)", `
set timeout 20
spawn node ${DIST} idea
sleep 2
send "a yield vault for stablecoins on Base\\r"
sleep 2
send "\\r"
sleep 8
expect eof
`, {
    description: "Generate idea in curated mode",
    category: "core",
    expectExitZero: true,
    expectContains: "idea.md",
  });

  await runExpectTest("idea (first-principles)", `
set timeout 20
spawn node ${DIST} idea
sleep 2
send "agent wallet for AI agents\\r"
sleep 2
send "\\033\\[B"
sleep 1
send "\\r"
sleep 8
expect eof
`, {
    description: "Generate idea in first-principles mode",
    category: "core",
    expectExitZero: true,
    expectContains: "idea.md",
  });

  await runExpectTest("idea (empty brief)", `
set timeout 10
spawn node ${DIST} idea
sleep 2
send "\\r"
sleep 2
expect {
  "required" {
    send "something\\r"
    exp_continue
  }
  eof
}
`, {
    description: "Idea with empty input then valid input",
    category: "edge",
    expectExitZero: true,
  });

  // ─── BUILD (expect - TTY required) ───────────────────
  await runExpectTest("build", `
set timeout 30
spawn node ${DIST} build
sleep 2
send "a lending protocol on Base\\r"
sleep 2
send "\\r"
sleep 15
expect eof
`, {
    description: "Build contracts + frontend from brief",
    category: "core",
    expectExitZero: true,
    expectContains: "scaffolded",
  });

  // ─── AUDIT ───────────────────────────────────────────
  await runSpawnTest("audit", ["audit"], {
    description: "Run security audit",
    category: "core",
    cwd: TEST_TEMP,
    expectExitZero: true,
    expectContains: "0 highs",
  });

  // ─── RAISE ───────────────────────────────────────────
  await runSpawnTest("raise", ["raise"], {
    description: "Generate fundraising materials",
    category: "core",
    cwd: TEST_TEMP,
    expectExitZero: true,
    expectContains: "raise",
  });

  // ─── SHIP (expect - TTY required) ────────────────────
  await runExpectTest("ship (testnet)", `
set timeout 30
spawn node ${DIST} ship --testnet
sleep 2
send "\\r"
sleep 5
expect eof
`, {
    description: "Deploy to testnet with wallet prompt",
    category: "core",
    cwd: TEST_TEMP,
    expectExitZero: false,
  });

  // ─── JOURNEY ─────────────────────────────────────────
  await runExpectTest("journey (agent mode)", `
set timeout 25
spawn node ${DIST} journey --agent
sleep 3
send "q"
sleep 2
expect eof
`, {
    description: "Interactive journey - quit immediately",
    category: "core",
    expectExitZero: true,
  });

  // ─── DOCTOR ──────────────────────────────────────────
  await runSpawnTest("doctor", ["doctor"], {
    description: "Verify toolchain",
    category: "config",
    expectExitZero: false,
    expectContains: "blocker",
  });

  // ─── INIT ────────────────────────────────────────────
  await runSpawnTest("init", ["init"], {
    description: "Install skills into agent dirs",
    category: "config",
    expectExitZero: true,
    expectContains: "installed",
  });

  // ─── REPOS ───────────────────────────────────────────
  await runSpawnTest("repos (list all)", ["repos"], {
    description: "List all repos",
    category: "data",
    expectExitZero: true,
    expectContains: "uniswap",
  });

  await runSpawnTest("repos (category filter)", ["repos", "--category", "defi-primitives"], {
    description: "Filter repos by category",
    category: "data",
    expectExitZero: true,
    expectContains: "uniswap",
  });

  await runSpawnTest("repos (clone nonexistent)", ["repos", "--clone", "does-not-exist"], {
    description: "Clone nonexistent repo should fail gracefully",
    category: "data",
    expectExitNonZero: true,
  });

  await runSpawnTest("repos (clone no arg)", ["repos", "--clone"], {
    description: "Clone with no slug should show usage",
    category: "data",
    expectExitNonZero: true,
    expectContains: "usage",
  });

  // ─── SKILLS ──────────────────────────────────────────
  await runSpawnTest("skills (list)", ["skills"], {
    description: "List all skills",
    category: "data",
    expectExitZero: true,
    expectContains: "official",
  });

  await runSpawnTest("skills show security", ["skills", "show", "security"], {
    description: "Show a specific skill",
    category: "data",
    expectExitZero: true,
    expectContains: "security",
  });

  await runSpawnTest("skills show nonexistent", ["skills", "show", "nonexistent-skill"], {
    description: "Show nonexistent skill should fail gracefully",
    category: "data",
    expectExitNonZero: true,
  });

  // ─── MCPS ────────────────────────────────────────────
  await runSpawnTest("mcps (list)", ["mcps"], {
    description: "List all MCP servers",
    category: "data",
    expectExitZero: true,
    expectContains: "foundry-mcp",
  });

  await runSpawnTest("mcps install", ["mcps", "install", "foundry-mcp"], {
    description: "Show install snippet for an MCP",
    category: "data",
    expectExitZero: true,
    expectContains: "mcpServers",
  });

  await runSpawnTest("mcps install nonexistent", ["mcps", "install", "nonexistent-mcp"], {
    description: "Install nonexistent MCP should fail",
    category: "data",
    expectExitNonZero: true,
  });

  // ─── SEARCH ──────────────────────────────────────────
  await runSpawnTest("search (with results)", ["search", "uniswap"], {
    description: "Search repos, skills, mcps",
    category: "data",
    expectExitZero: true,
    expectContains: "uniswap",
  });

  await runSpawnTest("search (no results)", ["search", "xyznonexistent123"], {
    description: "Search with no matches",
    category: "data",
    expectExitZero: true,
    expectContains: "0 repos",
  });

  await runSpawnTest("search (no query)", ["search"], {
    description: "Search without query should show usage",
    category: "data",
    expectExitZero: true,
  });

  // ─── COPILOT ─────────────────────────────────────────
  await runSpawnTest("copilot", ["copilot", "what is reentrancy"], {
    description: "Freeform assistant (stub mode)",
    category: "core",
    expectExitZero: true,
    expectContains: "copilot",
  });

  await runSpawnTest("copilot (no topic)", ["copilot"], {
    description: "Copilot without topic shows usage",
    category: "core",
    expectExitZero: true,
    expectContains: "usage",
  });

  // ─── CONFIG ──────────────────────────────────────────
  await runSpawnTest("config show", ["config"], {
    description: "Show config values",
    category: "config",
    expectExitZero: true,
    expectContains: "anthropic_key",
  });

  await runSpawnTest("config set/unset", ["config", "set", "telemetry", "true"], {
    description: "Set a config value",
    category: "config",
    expectExitZero: true,
    expectContains: "telemetry",
  });

  await runSpawnTest("config unset", ["config", "unset", "telemetry"], {
    description: "Unset a config value",
    category: "config",
    expectExitZero: true,
    expectContains: "removed",
  });

  // ─── VALIDATE (expect - TTY required) ────────────────
  await runExpectTest("validate", `
set timeout 15
spawn node ${DIST} validate
sleep 2
send "a decentralized yield aggregator\\r"
sleep 8
expect eof
`, {
    description: "Validate an idea",
    category: "learning",
    expectExitZero: true,
    expectContains: "validate",
  });

  // ─── DESIGN (expect - TTY required) ──────────────────
  await runExpectTest("design", `
set timeout 15
spawn node ${DIST} design
sleep 2
send "a swap page with token approval flow\\r"
sleep 8
expect eof
`, {
    description: "Get design patterns",
    category: "learning",
    expectExitZero: true,
    expectContains: "design",
  });

  // ─── REVIEW (expect - TTY required) ──────────────────
  await runExpectTest("review", `
set timeout 15
spawn node ${DIST} review
sleep 2
send "my deployed vault contract\\r"
sleep 8
expect eof
`, {
    description: "Product review",
    category: "learning",
    expectExitZero: true,
    expectContains: "review",
  });

  // ─── DEBUG (expect - TTY required) ───────────────────
  await runExpectTest("debug", `
set timeout 15
spawn node ${DIST} debug
sleep 2
send "revert: insufficient balance\\r"
sleep 8
expect eof
`, {
    description: "Debug contracts",
    category: "learning",
    expectExitZero: true,
    expectContains: "debug",
  });

  // ─── BEGINNER (expect - TTY required) ────────────────
  await runExpectTest("beginner", `
set timeout 15
spawn node ${DIST} beginner
sleep 2
send "what is gas\\r"
sleep 8
expect eof
`, {
    description: "Learn ethereum fundamentals",
    category: "learning",
    expectExitZero: true,
    expectContains: "beginner",
  });

  // ─── HACKATHON (expect - TTY required) ───────────────
  await runExpectTest("hackathon", `
set timeout 15
spawn node ${DIST} hackathon
sleep 2
send "a yield aggregator on Base\\r"
sleep 1
send "ETHGlobal\\r"
sleep 8
expect eof
`, {
    description: "Prepare hackathon submission",
    category: "learning",
    expectExitZero: true,
    expectContains: "hackathon",
  });

  // ─── GRANT (expect - TTY required) ───────────────────
  await runExpectTest("grant", `
set timeout 15
spawn node ${DIST} grant
sleep 2
send "a public goods indexer for L2s\\r"
sleep 1
send "Optimism RPGF\\r"
sleep 8
expect eof
`, {
    description: "Apply for a grant program",
    category: "learning",
    expectExitZero: true,
    expectContains: "grant",
  });

  // ─── FEEDBACK ────────────────────────────────────────
  await runSpawnTest("feedback", ["feedback", "--message", "test feedback", "--contact", "test@example.com"], {
    description: "Send feedback",
    category: "config",
    expectExitZero: true,
    expectContains: "thanks",
  });

  // ─── TELEMETRY ───────────────────────────────────────
  await runSpawnTest("telemetry show", ["telemetry", "show"], {
    description: "Show telemetry events",
    category: "config",
    expectExitZero: true,
  });

  // ─── COMPLETION ──────────────────────────────────────
  await runSpawnTest("completion bash", ["completion", "bash"], {
    description: "Generate bash completion",
    category: "config",
    expectExitZero: true,
    expectContains: "_eth()",
  });

  // ─── UNINSTALL ───────────────────────────────────────
  await runSpawnTest("uninstall", ["uninstall"], {
    description: "Remove skills and config",
    category: "config",
    expectExitZero: true,
    expectContains: "removed",
  });

  // ─── UNKNOWN COMMAND ─────────────────────────────────
  await runSpawnTest("unknown command", ["nonexistent-cmd"], {
    description: "Unknown command should fail gracefully",
    category: "error",
    expectExitNonZero: true,
    expectContains: "unknown command",
  });
}

function generateReport() {
  const byCategory = {};
  for (const r of results) {
    if (!byCategory[r.category]) byCategory[r.category] = [];
    byCategory[r.category].push(r);
  }

  const passCount = results.filter((r) => r.status === "PASS").length;
  const failCount = results.filter((r) => r.status === "FAIL").length;
  const crashCount = results.filter((r) => r.status === "CRASH").length;

  let md = `# CLI Test Results\n\n`;
  md += `Generated: ${new Date().toISOString()}\n\n`;
  md += `## Summary\n\n`;
  md += `| Status | Count |\n|--------|-------|\n`;
  md += `| PASS | ${passCount} |\n`;
  md += `| FAIL | ${failCount} |\n`;
  md += `| CRASH | ${crashCount} |\n`;
  md += `| **Total** | **${results.length}** |\n\n`;

  for (const [cat, tests] of Object.entries(byCategory)) {
    const catPass = tests.filter((t) => t.status === "PASS").length;
    md += `### ${cat}: ${catPass}/${tests.length}\n\n`;
  }
  md += `\n`;

  const failures = results.filter((r) => r.status !== "PASS");
  if (failures.length > 0) {
    md += `## Failed Tests\n\n`;
    for (const r of failures) {
      md += `### ${r.name}\n\n`;
      md += `- **Category**: ${r.category}\n`;
      md += `- **Description**: ${r.description}\n`;
      md += `- **Status**: ${r.status}\n`;
      md += `- **Issue**: ${r.issue}\n`;
      if (r.exitCode !== undefined) md += `- **Exit Code**: ${r.exitCode}\n`;
      if (r.stderr) md += `- **Stderr**: ${r.stderr.slice(0, 300)}\n`;
      md += `\n<details>\n<summary>Stdout</summary>\n\n\`\`\`\n${r.stdout}\n\`\`\`\n\n</details>\n\n`;
    }
  }

  md += `## All Results\n\n`;
  md += `| Command | Description | Category | Status | Issue |\n`;
  md += `|---------|-------------|----------|--------|-------|\n`;
  for (const r of results) {
    const issueCell = r.issue ? r.issue.slice(0, 60) : "—";
    md += `| \`${r.name}\` | ${r.description} | ${r.category} | ${r.status} | ${issueCell} |\n`;
  }

  return md;
}

async function main() {
  if (!existsSync(RESULTS_DIR)) mkdirSync(RESULTS_DIR, { recursive: true });

  await runAllTests();

  const report = generateReport();
  writeFileSync(RESULTS_FILE, report, "utf8");

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Report: ${RESULTS_FILE}`);
  console.log(`Total: ${results.length} | Pass: ${results.filter((r) => r.status === "PASS").length} | Fail: ${results.filter((r) => r.status === "FAIL").length} | Crash: ${results.filter((r) => r.status === "CRASH").length}`);

  const failures = results.filter((r) => r.status !== "PASS");
  if (failures.length > 0) {
    console.log("\nFailing tests:");
    for (const f of failures) {
      console.log(`  - [${f.category}] ${f.name}: ${f.issue}`);
    }
    process.exit(1);
  }

  console.log("\nAll tests passed.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Test runner crashed:", err);
  process.exit(2);
});
