export type RepoCategory =
  | "defi-primitives"
  | "accounts-aa"
  | "infra"
  | "l2-frameworks"
  | "zk"
  | "indexing"
  | "mev"
  | "tooling";

export type RepoStack =
  | "solidity"
  | "vyper"
  | "noir"
  | "foundry"
  | "hardhat"
  | "scaffold-eth"
  | "wagmi"
  | "viem";

export type RepoChain =
  | "mainnet"
  | "base"
  | "arbitrum"
  | "optimism"
  | "zksync"
  | "any-evm";

export interface Repo {
  slug: string;
  name: string;
  repo: string;
  description: string;
  category: RepoCategory;
  tags: string[];
  stack: RepoStack[];
  chains: RepoChain[];
}

export type SkillPhase = "idea" | "build" | "audit" | "ship" | "launch";

export interface SkillEntry {
  slug: string;
  phase: SkillPhase;
  name: string;
  description: string;
  official: boolean;
  source: string;
}

export type McpTransport = "stdio" | "http";

export interface Mcp {
  name: string;
  repo: string;
  description: string;
  transport: McpTransport;
  tools: string[];
}
