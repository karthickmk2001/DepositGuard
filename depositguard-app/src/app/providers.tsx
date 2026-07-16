"use client";

import { useCallback, useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletAdapterNetwork, WalletError, WalletNotReadyError } from "@solana/wallet-adapter-base";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { clusterApiUrl } from "@solana/web3.js";

import "@solana/wallet-adapter-react-ui/styles.css";

export function DepositGuardProviders({ children }: { children: React.ReactNode }) {
  const network = WalletAdapterNetwork.Devnet;
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

  // Wallet not installed / autoConnect with no extension present is an
  // expected state (not a bug) — don't let it surface as a console error,
  // but still send the user to install the wallet, same as the adapter's
  // default behavior.
  const onError = useCallback((error: WalletError, adapter?: { url: string }) => {
    if (error instanceof WalletNotReadyError) {
      if (typeof window !== "undefined" && adapter) {
        window.open(adapter.url, "_blank");
      }
      return;
    }
    console.error(error);
  }, []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} onError={onError} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
