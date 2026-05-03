import { invoke } from "./runtime.js";
import { run, which } from "../util/exec.js";
import type { ChainId } from "../chains/registry.js";
import type { Plan } from "./architect.js";
import { writeProjectFile } from "../util/fs.js";
import { copyTemplate } from "../templates/copy.js";

// The builder forks the chosen template and asks Claude to adapt it to the brief.
// It never writes files directly — every write goes through writeProjectFile, which
// runs the secret scanner.

export interface BuildOutput {
  contracts: string[];
  tests: number;
  pages: number;
}

function parseGeneratedFiles(text: string): Array<{ path: string; content: string }> {
  const files: Array<{ path: string; content: string }> = [];
  const regex = /===\s*([^\n]+?)\s*===\s*\n([\s\S]*?)(?===\s*[^\n]+?\s*===\s*\n|$)/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    const path = m[1]?.trim();
    const content = m[2]?.trimEnd();
    if (path && content) files.push({ path, content });
  }
  return files;
}

export async function runBuilder(input: {
  brief: string;
  chain: ChainId;
  plan: Plan;
}): Promise<BuildOutput> {
  // Step 1: copy the template skeleton to ./<project>.
  const copy = await copyTemplate(input.plan.template, { chain: input.chain });

  // Step 1b: init git and install forge dependencies (lib/ not shipped in npm package).
  const forge = await which("forge");
  const git = await which("git");
  if (forge.ok && git.ok) {
    await run("git", ["init"], { cwd: copy.root });
    await run("git", ["add", "-A"], { cwd: copy.root });
    await run("forge", ["install", "foundry-rs/forge-std@v1.8.0"], { cwd: copy.root });
    await run("forge", ["install", "OpenZeppelin/openzeppelin-contracts@v5.0.0"], { cwd: copy.root });
  }

  // Step 1c: install 0G SDK if building on 0G chain.
  if (input.chain === "0g") {
    const npm = await which("npm");
    if (npm.ok) {
      await run("npm", ["install", "@0gfoundation/0g-storage-ts-sdk"], { cwd: copy.root });
    }
  }

  // Step 2: ask Claude to generate contract + test edits.
  const res = await invoke({
    task: "build.contracts",
    tier: "iterate",
    system:
      "You are the builder. Adapt the chosen template to match the brief. Use OpenZeppelin, Checks-Effects-Interactions, " +
      "emit events, verified addresses only. Output every file you change as `=== path/to/file ===\\n<content>` blocks. " +
      "Use paths relative to the project root. Example: === src/StableVault.sol ===\\n<solidity code>",
    prompt: [
      `brief: ${input.brief}`,
      `chain: ${input.chain}`,
      `template: ${input.plan.template}`,
      `integrations: ${input.plan.integrations.join(", ") || "(none)"}`,
      "",
      "Output ONLY file blocks. No explanations.",
    ].join("\n"),
    maxTokens: 8192,
  });

  const generatedFiles = parseGeneratedFiles(res.text);
  const contracts: string[] = [];
  let tests = 0;

  for (const file of generatedFiles) {
    await writeProjectFile(`${copy.root}/${file.path}`, file.content);
    if (file.path.startsWith("src/") && file.path.endsWith(".sol")) contracts.push(file.path);
    if ((file.path.startsWith("test/") || file.path.startsWith("script/")) && file.path.endsWith(".sol")) tests++;
  }

  if (generatedFiles.length === 0) {
    await writeProjectFile(`${copy.root}/BUILD_NOTES.md`, res.text);
  }

  // Step 3: scaffold-eth 2 frontend adaptation.
  await invoke({
    task: "build.frontend",
    tier: "iterate",
    system:
      "You are the frontend builder. Use Scaffold-ETH 2 hooks (useScaffoldReadContract, useScaffoldWriteContract). " +
      "Follow the three-button flow: switch network → approve → execute. No infinite approvals. No placeholder branding. " +
      "Output every file as `=== path/to/file ===\\n<content>` blocks.",
    prompt: `adapt the ${input.plan.template} frontend to: ${input.brief}`,
  });

  return {
    contracts: contracts.length > 0 ? contracts : copy.contracts,
    tests: tests > 0 ? tests : copy.tests,
    pages: copy.pages,
  };
}
