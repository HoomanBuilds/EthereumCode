import { run, which } from "../util/exec.js";
import { loadConfig } from "../util/env.js";
import { CHAINS, type ChainId } from "../chains/registry.js";

export interface DeployResult {
  address: string;
  txHash: string;
  url: string;
  tweet: string;
  ph: string;
  frame: string;
}

// Chain-aware deployer. Wraps `forge script` for the current project.
// Safe by default: testnet is always the fallback if no explicit target.
export async function deploy(opts: { target: "testnet" | "mainnet"; chain?: ChainId }): Promise<DeployResult> {
  const cfg = await loadConfig();
  const chainId = (opts.chain ?? (cfg.chain as ChainId) ?? "base") as ChainId;
  const chain = CHAINS[chainId];
  const net = opts.target === "testnet" ? chain.testnet : chain;

  const forge = await which("forge");
  if (!forge.ok) {
    throw new Error("foundry not installed. run `foundryup`.");
  }

  const rpc = cfg.rpc ?? net.rpcDefault;
  const args = [
    "script",
    "script/Deploy.s.sol",
    "--rpc-url",
    rpc,
    "--broadcast",
    "--slow",
  ];
  if (cfg.walletKeyPath) {
    args.push("--keystore", cfg.walletKeyPath);
    if (cfg.walletPasswordFile) {
      args.push("--password-file", cfg.walletPasswordFile);
    }
  } else {
    throw new Error("no wallet configured. run `cast wallet new` then set wallet_key_path in ~/.ethereum-code/config.toml");
  }
  if (cfg.etherscanKey) {
    args.push("--verify", "--etherscan-api-key", cfg.etherscanKey);
  }

  const r = await run("forge", args);
  if (r.code !== 0) {
    throw new Error(`forge script failed:\n${r.stderr.slice(0, 1200)}`);
  }

  const address = extractAddress(r.stdout);
  const txHash = extractTxHash(r.stdout);
  const explorer = opts.target === "testnet" ? chain.testnet.explorer : chain.explorer;
  const url = `${explorer}/address/${address}`;

  return {
    address,
    txHash,
    url,
    tweet: tweetCopy(address, chain.name),
    ph: phCopy(chain.name),
    frame: frameCopy(address),
  };
}

function extractAddress(out: string): string {
  const m = out.match(/0x[a-fA-F0-9]{40}/);
  return m?.[0] ?? "0x0000000000000000000000000000000000000000";
}

function extractTxHash(out: string): string {
  const m = out.match(/0x[a-fA-F0-9]{64}/);
  return m?.[0] ?? "0x";
}

function tweetCopy(address: string, chainName: string): string {
  return `shipping on ${chainName}.\n\n${address}\n\nbuilt with ethereum-code`;
}

function phCopy(chainName: string): string {
  return `# Launch copy (${chainName})\n\n## Tagline\nTBD — one sentence that cuts.\n\n## Description\nTBD — three sentences, concrete, no buzzwords.\n`;
}

function frameCopy(address: string): string {
  return `# Farcaster frame\n\nPoints to contract \`${address}\`. Customize the action button and image.`;
}
