"use client";

import { useState } from "react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import {
  useScaffoldReadContract,
  useScaffoldWriteContract,
} from "~~/hooks/scaffold-eth";

// Three-button flow: Switch Network → Approve → Deposit.
// Never show approve and deposit at the same time.
// Never request infinite allowance.

const TARGET_CHAIN_ID = 84532; // Base Sepolia — swap to your target chain

export default function VaultPage() {
  const { address } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const [amount, setAmount] = useState("");
  const [phase, setPhase] = useState<"switch" | "approve" | "deposit">("switch");

  const { data: totalAssets } = useScaffoldReadContract({
    contractName: "StableVault",
    functionName: "totalAssets",
  });

  const { data: myShares } = useScaffoldReadContract({
    contractName: "StableVault",
    functionName: "balanceOf",
    args: [address],
  });

  const { writeContractAsync: approve } = useScaffoldWriteContract({
    contractName: "MockUSDC",
  });

  const { writeContractAsync: deposit } = useScaffoldWriteContract({
    contractName: "StableVault",
  });

  const onAction = async () => {
    if (chainId !== TARGET_CHAIN_ID) {
      switchChain({ chainId: TARGET_CHAIN_ID });
      return;
    }
    const parsed = parseUnits(amount || "0", 6);
    if (phase === "switch") {
      setPhase("approve");
      return;
    }
    if (phase === "approve") {
      await approve({
        functionName: "approve",
        args: ["0x0000000000000000000000000000000000000000", parsed],
      });
      setPhase("deposit");
      return;
    }
    await deposit({
      functionName: "deposit",
      args: [parsed, address],
    });
    setAmount("");
    setPhase("switch");
  };

  const buttonLabel =
    chainId !== TARGET_CHAIN_ID
      ? "Switch network"
      : phase === "approve"
        ? "Approve USDC"
        : phase === "deposit"
          ? "Deposit"
          : "Continue";

  return (
    <main className="mx-auto max-w-md py-16 font-mono">
      <h1 className="text-2xl tracking-tight">stable vault</h1>
      <p className="mt-1 text-sm opacity-60">
        deposit usdc. earn yield. withdraw anytime.
      </p>

      <div className="mt-8 space-y-4 rounded-xl border border-white/10 p-6">
        <div className="flex justify-between text-sm opacity-70">
          <span>tvl</span>
          <span>{totalAssets ? formatUnits(totalAssets, 6) : "—"} USDC</span>
        </div>
        <div className="flex justify-between text-sm opacity-70">
          <span>your shares</span>
          <span>{myShares ? formatUnits(myShares, 6) : "—"}</span>
        </div>

        <input
          type="number"
          inputMode="decimal"
          placeholder="amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="mt-4 w-full rounded-lg bg-white/5 px-4 py-3 outline-none focus:bg-white/10"
        />

        <button
          onClick={onAction}
          disabled={!amount && phase !== "switch"}
          className="w-full rounded-lg bg-white py-3 text-sm text-black transition disabled:opacity-40"
        >
          {buttonLabel}
        </button>
      </div>

      <footer className="mt-12 text-xs opacity-40">
        shipped with{" "}
        <a href="https://ethereum.new" className="underline">
          ethereum.new
        </a>
      </footer>
    </main>
  );
}
