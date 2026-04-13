# defi-vault · frontend

Drop this page into a Scaffold-ETH 2 app at `packages/nextjs/app/page.tsx`.

## patterns enforced

- Three-button flow: switch → approve → deposit. Never shown together.
- Exact allowance (`parseUnits(amount, 6)`) — never `type(uint256).max`.
- Reads via `useScaffoldReadContract`, writes via `useScaffoldWriteContract`. No raw wagmi calls.
- Human-readable amounts via `formatUnits`. No raw bigints in the UI.

## what's next

- Wire `deployedContracts.ts` by running the Deploy script — it'll populate automatically.
- Add an `externalContracts.ts` entry for the real USDC address on your target chain.
- Remove `MockUSDC` from the flow before mainnet.
