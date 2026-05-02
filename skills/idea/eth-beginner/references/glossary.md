# Beginner Glossary

Definitions written so a first-timer can read them without hitting another undefined term mid-sentence. Each entry: one-line plain definition, a concrete example, and a hint of where it shows up.

For the full mental model, see `concepts/SKILL.md`. For the build sequence, see `references/first-week-roadmap.md`.

## Account model

**Address** — A 42-character string starting with `0x`. It's your account number on Ethereum. Public; you share it to receive funds.
*Example: `0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045` (Vitalik's address).*

**Private key** — A 64-character secret that controls an address. Whoever has the private key can move the funds. Losing it = losing access. Sharing it = losing money.

**Wallet** — Software that holds your private keys and signs transactions. MetaMask, Rainbow, Coinbase Wallet. The wallet doesn't "hold" your tokens — the tokens live on the chain; the wallet just holds the key that controls them.

**Seed phrase / mnemonic** — 12 or 24 words that can regenerate your private key. Back this up offline. Anyone with the phrase has your wallet.

**EOA (Externally Owned Account)** — An account controlled by a private key. What you have when you install MetaMask.

**Smart contract account** — An account whose "code" is a program. It has a balance and an address but no private key. It moves funds based on its programmed rules.

## Transactions and gas

**Transaction** — A message you sign with your private key that asks the network to do something: send ETH, call a contract, deploy a contract.

**Gas** — The unit of computation cost. Every operation has a gas cost; you pay for it in ETH. Sending ETH costs ~21,000 gas. A swap costs ~150,000. Complex actions cost more.

**Gas price (gwei)** — How much you're willing to pay per unit of gas. Measured in gwei (1 ETH = 1,000,000,000 gwei). Higher gas price = your tx gets included faster.

**Gas fee** — `gas used × gas price`, paid in ETH. Even failed transactions cost gas.

**Nonce** — A counter for your account, starting at 0, incrementing with each transaction you send. Prevents replay; ensures order.

**Block** — A bundle of transactions confirmed together. Ethereum has a new block every ~12 seconds.

**Mempool** — The waiting room for transactions. After you sign and broadcast, the tx sits in the mempool until a block builder picks it.

## Code on chain

**Smart contract** — A program deployed at an address. Anyone can call its functions by sending a transaction. The code is public; the state is public.

**Solidity** — The most common language for writing smart contracts. Looks like JavaScript with types.

**EVM (Ethereum Virtual Machine)** — The runtime that executes smart contracts. Every Ethereum-compatible chain runs the EVM.

**Bytecode** — The compiled form of a contract; what actually lives on chain. You write Solidity; the compiler emits bytecode.

**ABI (Application Binary Interface)** — A JSON describing a contract's functions and events. Frontends and tools use it to know how to call the contract.

**Function selector** — The first 4 bytes of `keccak256(functionSignature)`. How the EVM dispatches calls.

**Event / log** — Something a contract emits to record what happened. Indexers read events to build a searchable history.

**Storage slot** — A 32-byte location where a contract stores state. Solidity variables compile down to storage slots.

## Standards

**ERC-20** — The fungible token standard (USDC, DAI, the token someone launched yesterday). Defines `transfer`, `approve`, `balanceOf`.

**ERC-721** — The NFT standard. One token per ID. Each token is unique.

**ERC-1155** — Multi-token standard. One contract holds many token types, each with a supply > 0.

**ERC-4626** — The vault standard. A vault wraps a yield-bearing strategy and gives you shares.

**ERC-4337** — Account abstraction. Smart-contract wallets that act like EOAs.

**EIP** — Ethereum Improvement Proposal. The format for proposing changes to the protocol or new standards.

## Dapps and tooling

**dApp** — A website that talks to a smart contract through your wallet. The contract logic is on chain; the UI is a normal web page.

**RPC (Remote Procedure Call)** — How your frontend talks to the chain. You hit an HTTP endpoint, send `{method, params}`, get back data. Alchemy, Infura, QuickNode, your own node.

**Provider** — In wagmi/viem terms: the object that knows how to talk to an RPC endpoint.

**Wallet provider** — In dApp terms: the wallet plugin (MetaMask) that injects `window.ethereum`.

**WalletConnect** — A protocol for connecting a mobile wallet to a desktop dApp via QR code.

**Wagmi** — A React library for wallet connection and contract reads/writes.

**Viem** — A TypeScript library for Ethereum primitives. Newer/cleaner alternative to ethers.

**Foundry** — A Rust-based toolkit for Solidity development. `forge` (compile/test), `cast` (CLI), `anvil` (local node).

**Hardhat** — Older JavaScript toolkit. Foundry has largely replaced it for new projects.

**Scaffold-ETH 2 (SE2)** — A starter kit that bundles Foundry + Next.js + wagmi + viem + RainbowKit. Best way to start.

## Chains

**Mainnet** — Ethereum L1. The main network, where real ETH lives.

**Testnet** — A practice chain. Sepolia is the current default. Same software, fake money.

**L1 (Layer 1)** — The base chain. Ethereum mainnet.

**L2 (Layer 2)** — A chain that runs on top of Ethereum, batching transactions and posting them back. Cheaper, faster. Base, Arbitrum, Optimism, zkSync.

**Rollup** — The most common kind of L2. Two flavors: optimistic (Arbitrum, Optimism) and ZK (zkSync, Scroll, Linea).

**Bridge** — A contract on two chains that lets you move tokens between them. High-risk surface; bridges have been the most common exploit target historically.

**Block explorer** — A website that lets you look up addresses, transactions, contracts. Etherscan (mainnet), Basescan (Base), Arbiscan (Arbitrum).

## DeFi vocabulary

**DEX (Decentralized Exchange)** — A contract that lets users swap tokens. Uniswap is the canonical one.

**AMM (Automated Market Maker)** — A type of DEX that uses a formula (e.g., `x * y = k`) instead of an order book.

**Liquidity pool** — Two tokens locked in an AMM contract. LPs (liquidity providers) deposit; traders pay fees that go back to LPs.

**Slippage** — The difference between the price you expected and the price you got. Caused by your trade moving the AMM curve.

**Lending protocol** — A contract that lets users deposit assets to earn yield, or borrow against collateral. Aave, Compound, Morpho.

**Stablecoin** — A token pegged to a fiat currency (usually USD). USDC, DAI, USDT.

**Yield** — Return on assets. Could come from lending interest, AMM fees, staking, etc.

**TVL (Total Value Locked)** — The total dollar value held in a protocol's contracts. The DeFi vanity metric.

## Security and risk

**Reentrancy** — A bug where a contract calls another contract, which calls back into the original before state is updated. The classic Ethereum exploit.

**Oracle** — A contract that publishes external data (like a price feed) on chain. Chainlink is the standard.

**Multisig (multi-signature wallet)** — A wallet where N-of-M signatures are required to send a transaction. Gnosis Safe is the standard. Used to remove single-key risk.

**Audit** — A security review by a third party before deploying to mainnet. Spearbit, Cantina, OpenZeppelin, Trail of Bits.

**Bug bounty** — A program that pays researchers for finding vulnerabilities. Immunefi is the platform.

**Pause** — An owner-only function that halts a contract during an emergency. Centralization smell — accept it for an MVP, sunset it later.

**Rugpull** — A team that disappears with users' funds. Usually via an admin key the team kept.

## Things you don't need to know yet

- Merkle trees (you'll use Merkle proofs but rarely build them)
- KZG commitments / EIP-4844 (matters for L2 builders, not most app builders)
- MEV (matters when shipping a DEX or large trades)
- Account abstraction internals (use a library, don't implement)
- Yellow Paper math (genuinely never)

When in doubt, learn the thing when you need it, not before.

## What to read next

- `references/first-week-roadmap.md` — sequenced first-week plan
- `concepts/SKILL.md` — full mental model
- `l2s/SKILL.md` — how to pick a chain
