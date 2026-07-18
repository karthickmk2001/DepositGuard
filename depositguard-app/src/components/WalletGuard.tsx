"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

interface Props {
  children: React.ReactNode;
  message?: string;
  sub?: string;
}

/**
 * Renders children only when a wallet is connected.
 * Handles the SSR hydration issue by deferring wallet state to the client.
 */
export default function WalletGuard({ children, message, sub }: Props) {
  const { connected } = useWallet();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  if (!connected) {
    return (
      <div className="max-w-lg mx-auto px-4 py-24 text-center">
        <h1 className="text-2xl font-bold mb-4">
          {message ?? "Connect your wallet to continue"}
        </h1>
        {sub && <p className="text-slate-400 mb-8">{sub}</p>}
        <WalletMultiButton
          style={{ background: "rgb(15 118 110)", borderRadius: "12px" }}
        />
      </div>
    );
  }

  return <>{children}</>;
}
