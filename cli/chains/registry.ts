// Opinionated chain registry. One source of truth for RPC, explorer, bridge, and superpower.
// Every new chain must answer: "what's its superpower?" — not just "it's cheaper".

export type ChainId = "mainnet" | "base" | "arbitrum" | "optimism" | "zksync";

export interface ChainConfig {
  id: ChainId;
  name: string;
  chainId: number;
  rpcEnv: string;
  rpcDefault: string;
  explorer: string;
  blockscout?: string;
  currency: "ETH";
  superpower: string;
  testnet: {
    name: string;
    chainId: number;
    rpcDefault: string;
    explorer: string;
    faucet: string;
  };
}

export const CHAINS: Record<ChainId, ChainConfig> = {
  mainnet: {
    id: "mainnet",
    name: "Ethereum",
    chainId: 1,
    rpcEnv: "MAINNET_RPC",
    rpcDefault: "https://cloudflare-eth.com",
    explorer: "https://etherscan.io",
    currency: "ETH",
    superpower: "credibly neutral settlement",
    testnet: {
      name: "Sepolia",
      chainId: 11155111,
      rpcDefault: "https://ethereum-sepolia.publicnode.com",
      explorer: "https://sepolia.etherscan.io",
      faucet: "https://sepoliafaucet.com",
    },
  },
  base: {
    id: "base",
    name: "Base",
    chainId: 8453,
    rpcEnv: "BASE_RPC",
    rpcDefault: "https://mainnet.base.org",
    explorer: "https://basescan.org",
    blockscout: "https://base.blockscout.com",
    currency: "ETH",
    superpower: "consumer onboarding · coinbase distribution",
    testnet: {
      name: "Base Sepolia",
      chainId: 84532,
      rpcDefault: "https://sepolia.base.org",
      explorer: "https://sepolia.basescan.org",
      faucet: "https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet",
    },
  },
  arbitrum: {
    id: "arbitrum",
    name: "Arbitrum One",
    chainId: 42161,
    rpcEnv: "ARBITRUM_RPC",
    rpcDefault: "https://arb1.arbitrum.io/rpc",
    explorer: "https://arbiscan.io",
    currency: "ETH",
    superpower: "defi composability · deepest L2 liquidity",
    testnet: {
      name: "Arbitrum Sepolia",
      chainId: 421614,
      rpcDefault: "https://sepolia-rollup.arbitrum.io/rpc",
      explorer: "https://sepolia.arbiscan.io",
      faucet: "https://faucet.quicknode.com/arbitrum/sepolia",
    },
  },
  optimism: {
    id: "optimism",
    name: "Optimism",
    chainId: 10,
    rpcEnv: "OPTIMISM_RPC",
    rpcDefault: "https://mainnet.optimism.io",
    explorer: "https://optimistic.etherscan.io",
    currency: "ETH",
    superpower: "public goods funding · retro rewards",
    testnet: {
      name: "OP Sepolia",
      chainId: 11155420,
      rpcDefault: "https://sepolia.optimism.io",
      explorer: "https://sepolia-optimism.etherscan.io",
      faucet: "https://www.optimism.io/faucet",
    },
  },
  zksync: {
    id: "zksync",
    name: "zkSync Era",
    chainId: 324,
    rpcEnv: "ZKSYNC_RPC",
    rpcDefault: "https://mainnet.era.zksync.io",
    explorer: "https://explorer.zksync.io",
    currency: "ETH",
    superpower: "native account abstraction · zk validity",
    testnet: {
      name: "zkSync Sepolia",
      chainId: 300,
      rpcDefault: "https://sepolia.era.zksync.dev",
      explorer: "https://sepolia.explorer.zksync.io",
      faucet: "https://faucet.triangleplatform.com/zksync/sepolia",
    },
  },
};

export function chain(id: ChainId): ChainConfig {
  return CHAINS[id];
}
