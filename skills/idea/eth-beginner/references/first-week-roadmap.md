# First-Week Roadmap

A concrete, sequenced 7-day plan for a developer who's new to Ethereum and wants to ship something. Each day has a clear deliverable. No skipping. The cumulative effect is "I built a working dApp" by the end.

For terminology, see `references/glossary.md`. For the full lifecycle once you're past the first week, see `ship/SKILL.md`.

## Prerequisites

You should be comfortable with:
- A terminal (bash/zsh)
- JavaScript or TypeScript at a basic level
- Git
- Installing things via Homebrew / apt / similar

You don't need to know Solidity yet. You'll learn the basics on day 3.

## Day 1: Wallet, address, first transaction

**Goal:** Have a wallet, hold some testnet ETH, send a transaction.

1. **Install MetaMask** (or Rainbow). Browser extension is fine.
2. **Back up the seed phrase.** Write it on paper. Don't screenshot.
3. **Switch to Sepolia testnet.** In MetaMask: Settings → Networks → Show test networks.
4. **Get Sepolia ETH** from a faucet:
   - https://sepoliafaucet.com (Alchemy)
   - https://www.infura.io/faucet/sepolia
   - Google "Sepolia faucet" — there are several
5. **Send 0.01 Sepolia ETH** to another address (any address — even back to yourself from a different wallet). Watch it on https://sepolia.etherscan.io/.

**Checkpoint:** You can read your address, your balance, and a transaction on a block explorer.

## Day 2: RPC, viewing chain state

**Goal:** Talk to the chain without a wallet.

1. **Sign up for Alchemy** (free tier). Create an app on Sepolia. Copy the RPC URL.
2. **Install foundry:**
   ```bash
   curl -L https://foundry.paradigm.xyz | bash
   foundryup
   ```
3. **Use `cast`** to query the chain:
   ```bash
   cast block-number --rpc-url $SEPOLIA_RPC
   cast balance YOUR_ADDRESS --rpc-url $SEPOLIA_RPC
   cast call USDC_ADDRESS "balanceOf(address)(uint256)" YOUR_ADDRESS --rpc-url $MAINNET_RPC
   ```
4. **Read a contract's storage:**
   ```bash
   cast storage 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 0 --rpc-url $MAINNET_RPC
   ```
   This is USDC's storage slot 0 on mainnet. Look up what's there.

**Checkpoint:** You understand that the chain is a public database; you don't need a wallet to read it.

## Day 3: First Solidity contract

**Goal:** Write, compile, deploy a contract.

1. **Initialize a Foundry project:**
   ```bash
   forge init my-first-contract
   cd my-first-contract
   ```
2. **Read the default `src/Counter.sol`.** Notice: `pragma`, `contract`, `function`, public state variable.
3. **Modify it.** Add a `string public name;` and a setter. Recompile.
   ```bash
   forge build
   ```
4. **Run the tests.**
   ```bash
   forge test -vv
   ```
5. **Deploy to Sepolia:**
   ```bash
   forge create src/Counter.sol:Counter \
     --rpc-url $SEPOLIA_RPC \
     --private-key $YOUR_TESTNET_KEY
   ```
6. **Verify it on Etherscan.** Go to Sepolia Etherscan, search the address, click "Verify and Publish".

**Checkpoint:** You have a deployed contract you can interact with via Etherscan's "Read" / "Write" tabs.

## Day 4: ERC-20 token

**Goal:** Deploy a token that follows the standard.

1. **Add OpenZeppelin contracts:**
   ```bash
   forge install OpenZeppelin/openzeppelin-contracts
   ```
2. **Write a token:**
   ```solidity
   pragma solidity ^0.8.27;
   import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

   contract MyToken is ERC20 {
       constructor() ERC20("MyToken", "MTK") {
           _mint(msg.sender, 1_000_000 ether);
       }
   }
   ```
3. **Test it:**
   ```solidity
   function test_InitialSupply() public {
       MyToken token = new MyToken();
       assertEq(token.balanceOf(address(this)), 1_000_000 ether);
   }
   ```
4. **Deploy and verify on Sepolia.**
5. **Send some tokens** to another address using Etherscan's "Write" tab.

**Checkpoint:** You've used a battle-tested base contract from OpenZeppelin, not invented your own ERC-20.

## Day 5: Frontend with Scaffold-ETH 2

**Goal:** A web page that talks to your contract.

1. **Clone SE2:**
   ```bash
   git clone https://github.com/scaffold-eth/scaffold-eth-2.git
   cd scaffold-eth-2
   yarn install
   ```
2. **Run it locally:**
   ```bash
   yarn chain     # local chain
   yarn deploy    # deploys default contracts
   yarn start     # frontend on localhost:3000
   ```
3. **Connect a burner wallet.** Click "Connect Wallet" → use the burner.
4. **Read the contract.** Type a value, click "Send", watch it update.
5. **Modify the deployed contract** (in `packages/foundry/contracts/`). Redeploy. The frontend auto-updates.

**Checkpoint:** You see how SE2 wires `useScaffoldReadContract` and `useScaffoldWriteContract` to your deployed addresses.

## Day 6: Connect to a real chain

**Goal:** Deploy your token to Sepolia and interact via your frontend.

1. **Update `packages/foundry/foundry.toml`** with Sepolia RPC.
2. **Deploy to Sepolia:**
   ```bash
   yarn deploy --network sepolia
   ```
3. **Switch the frontend's target chain** to Sepolia in `packages/nextjs/scaffold.config.ts`.
4. **Open the app**, connect MetaMask (Sepolia), and call your contract.

**Checkpoint:** You've done the full loop — write contract, deploy to a real (test) chain, talk to it from a web frontend.

## Day 7: One real thing

**Goal:** Build something tiny that's actually useful.

Pick one:

- **A mood token** — every user can `mint(uint8 mood)` once a day; mood is logged as an event.
- **A guestbook** — every visitor can `sign(string message)`; the frontend lists the last 50 signatures.
- **A coin flip** — uses `block.prevrandao` for "randomness" (don't do this in production, but it's instructive).
- **A wishlist** — add ERC-721 tokens to a list of "things I want", visible publicly.

The actual app doesn't matter. What matters: you wrote contract logic, tested it, deployed it, built a UI, connected the UI, and watched it work end to end.

## What to do next

You're past beginner. Pick a path:

| Interest | Skill to fetch |
|---|---|
| Build a real product | `validate-idea/SKILL.md` then `ship/SKILL.md` |
| Go deep on contracts | `standards/SKILL.md`, `security/SKILL.md` |
| Go deep on frontend | `frontend-ux/SKILL.md`, `frontend-playbook/SKILL.md` |
| Understand L2s | `l2s/SKILL.md` |
| Build a privacy app | `noir/SKILL.md` |
| Audit your code | `audit/SKILL.md` |

## Common week-1 mistakes

- **Trying to learn everything before building.** You learn by shipping. Day 7 is non-negotiable.
- **Deploying to mainnet too early.** Sepolia first. Always.
- **Hardcoding the testnet private key in code.** Use env vars or a `.env` file. Add `.env` to `.gitignore`.
- **Skipping tests.** Every contract you write should have at least one test. Foundry makes this easy.
- **Reinventing ERC-20.** Use OpenZeppelin. Always.
- **Building without a plan.** Even on day 7, write down what you're building before you code.
- **Asking "is this idea good?" before validating.** That's the next skill (`validate-idea`).

## What to read next

- `references/glossary.md` — definitions
- `concepts/SKILL.md` — full mental model
- `tools/SKILL.md` — Foundry deeper
- `validate-idea/SKILL.md` — when ready to build something for users
