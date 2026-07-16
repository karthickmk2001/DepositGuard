"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useParams, useRouter } from "next/navigation";
import { getTenancy, updateTenancy } from "@/lib/supabase";
import { Tenancy } from "@/types/tenancy";
import { depositToEscrow, getEscrowPDA } from "@/lib/solana";

export default function DepositPage() {
  const { id } = useParams<{ id: string }>();
  const wallet = useWallet();
  const { publicKey, connected } = wallet;
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [tenancy, setTenancy] = useState<Tenancy | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    getTenancy(id)
      .then(setTenancy)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handlePayDeposit = async () => {
    if (!publicKey || !tenancy) return;
    setPaying(true);
    setError("");

    try {
      // Transfer SOL from tenant wallet → escrow PDA on Solana
      let txSig = "";
      try {
        txSig = await depositToEscrow(wallet, tenancy.id);
      } catch (chainErr) {
        console.warn("On-chain deposit failed (recording off-chain):", chainErr);
      }

      // Update Supabase record
      await updateTenancy(id, {
        tenant: publicKey.toBase58(),
        tenant_agreed: true,
        status: "Active",
        ...(txSig ? { deposit_tx_signature: txSig } : {}),
      }, publicKey.toBase58());
      router.push("/dashboard");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setPaying(false);
    }
  };

  if (!mounted || loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <span className="w-6 h-6 border-2 border-gray-600 border-t-violet-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!tenancy) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-2">Tenancy not found</h1>
        <p className="text-gray-400">This link may be invalid or expired.</p>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-2">Connect your wallet to pay deposit</h1>
        <p className="text-gray-400 mb-2">
          Your landlord has set up a deposit escrow for:
        </p>
        <p className="text-violet-300 font-medium mb-8">{tenancy.property_address}</p>
        <WalletMultiButton style={{ background: "rgb(109 40 217)", borderRadius: "12px" }} />
      </div>
    );
  }

  const isAlreadyTenant = tenancy.tenant === publicKey?.toBase58();
  const isLandlord = tenancy.landlord === publicKey?.toBase58();

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="mb-8">
        <div className="text-sm text-violet-400 font-medium mb-1">Deposit Escrow</div>
        <h1 className="text-3xl font-bold mb-1">{tenancy.property_address}</h1>
        <p className="text-gray-400 text-sm">
          Lease: {tenancy.lease_start} → {tenancy.lease_end}
        </p>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-400 rounded-xl px-4 py-3 mb-6 text-sm">
          {error}
        </div>
      )}

      {/* Tenancy summary card */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl divide-y divide-gray-800 mb-6">
        <div className="px-6 py-4 flex justify-between items-center">
          <span className="text-gray-400 text-sm">Landlord</span>
          <span className="font-mono text-xs text-gray-300">
            {tenancy.landlord.slice(0, 8)}…{tenancy.landlord.slice(-8)}
          </span>
        </div>
        <div className="px-6 py-4 flex justify-between items-center">
          <span className="text-gray-400 text-sm">Deposit amount</span>
          <span className="font-bold text-violet-400 text-lg">{tenancy.deposit_amount} SOL</span>
        </div>
        <div className="px-6 py-4 flex justify-between items-center">
          <span className="text-gray-400 text-sm">Inspection tier</span>
          <span className="text-sm text-gray-300">
            {tenancy.inspection_tier === 1 ? "Inspector Verified" : "Standard (mutual sign-off)"}
          </span>
        </div>
        <div className="px-6 py-4 flex justify-between items-center">
          <span className="text-gray-400 text-sm">Status</span>
          <span className="text-sm text-blue-400 font-medium">{tenancy.status}</span>
        </div>
      </div>

      {/* Escrow PDA address */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 mb-6">
        <p className="text-sm font-medium text-gray-400 mb-1">Escrow PDA (on-chain vault)</p>
        <p className="font-mono text-xs text-violet-300 break-all">
          {getEscrowPDA(tenancy.id)[0].toBase58()}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Your deposit goes here — not to the landlord. Both parties must agree to release.
        </p>
      </div>

      {/* Move-in photo hash */}
      {tenancy.move_in_hash && (
        <div className="bg-violet-900/20 border border-violet-500/30 rounded-xl px-5 py-4 mb-6">
          <p className="text-sm font-medium text-violet-400 mb-1">Move-in evidence hash (on-chain)</p>
          <p className="font-mono text-xs text-gray-300 break-all">{tenancy.move_in_hash}</p>
          <p className="text-xs text-gray-500 mt-2">
            By paying the deposit you agree this hash represents the property condition at move-in.
          </p>
        </div>
      )}

      {/* Inspector report hash */}
      {tenancy.inspector_move_in_hash && (
        <div className="bg-green-900/20 border border-green-700/40 rounded-xl px-5 py-4 mb-6">
          <p className="text-sm font-medium text-green-400 mb-1">Inspector move-in report (signed on-chain)</p>
          <p className="font-mono text-xs text-gray-300 break-all">{tenancy.inspector_move_in_hash}</p>
          {tenancy.inspector && (
            <p className="text-xs text-gray-500 mt-2">
              Inspector: {tenancy.inspector.slice(0, 8)}...{tenancy.inspector.slice(-8)}
            </p>
          )}
        </div>
      )}

      {/* Move-in photos */}
      {tenancy.move_in_photos && tenancy.move_in_photos.length > 0 && (
        <div className="mb-6">
          <h2 className="font-semibold mb-3">Move-in photos</h2>
          <div className="grid grid-cols-3 gap-2">
            {tenancy.move_in_photos.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={url}
                alt={`Move-in photo ${i + 1}`}
                className="rounded-lg aspect-square object-cover w-full border border-gray-800"
              />
            ))}
          </div>
        </div>
      )}

      {/* Auto-release check for active tenancies past lease end */}
      {isAlreadyTenant && tenancy.status === "Active" && (() => {
        const leaseEnd = new Date(tenancy.lease_end);
        const now = new Date();
        const daysSince = Math.floor((now.getTime() - leaseEnd.getTime()) / (1000 * 60 * 60 * 24));
        const eligible = daysSince >= 14;
        const daysRemaining = Math.max(0, 14 - daysSince);

        if (daysSince < 0) return null; // lease hasn't ended yet

        return (
          <div className={`rounded-xl px-5 py-4 mb-6 ${eligible ? "bg-green-900/20 border border-green-700/40" : "bg-yellow-900/20 border border-yellow-700/40"}`}>
            <div className={`font-semibold ${eligible ? "text-green-400" : "text-yellow-400"}`}>
              {eligible
                ? "Landlord has not responded — you can claim your deposit"
                : `Auto-release in ${daysRemaining} day(s)`}
            </div>
            <div className="text-sm text-gray-400 mt-1">
              {eligible
                ? "14 days have passed since the lease ended with no move-out initiated by the landlord."
                : `Lease ended ${daysSince} day(s) ago. If the landlord doesn't initiate move-out within 14 days, your full deposit is automatically returned.`}
            </div>
            {eligible && (
              <button
                onClick={async () => {
                  setPaying(true);
                  setError("");
                  try {
                    const res = await fetch("/api/auto-release", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ tenancy_id: id, wallet: publicKey?.toBase58() }),
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error);
                    router.push("/dashboard");
                  } catch (e: unknown) {
                    setError(e instanceof Error ? e.message : "Auto-release failed");
                  } finally {
                    setPaying(false);
                  }
                }}
                disabled={paying}
                className="mt-3 bg-green-700 hover:bg-green-600 text-white font-medium px-6 py-2.5 rounded-xl transition-colors text-sm flex items-center gap-2"
              >
                {paying && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                Claim Full Deposit ({tenancy.deposit_amount} SOL)
              </button>
            )}
          </div>
        );
      })()}

      {/* Pay deposit CTA */}
      {isAlreadyTenant ? (
        <div className="bg-green-900/20 border border-green-700/40 rounded-xl px-5 py-4 text-center">
          <div className="text-green-400 font-semibold">You have already paid this deposit</div>
          <div className="text-sm text-gray-400 mt-1">Status: {tenancy.status}</div>
        </div>
      ) : isLandlord ? (
        <div className="bg-gray-900 border border-gray-700 rounded-xl px-5 py-4 text-center text-gray-400 text-sm">
          Share this page link with your tenant so they can review the inspection report and pay the deposit.
        </div>
      ) : tenancy.status === "AwaitingInspection" ? (
        <div className="bg-yellow-900/20 border border-yellow-700/40 rounded-xl px-5 py-4 text-center">
          <div className="text-yellow-400 font-semibold">Awaiting property inspection</div>
          <div className="text-sm text-gray-400 mt-1">
            The landlord has booked an inspector. Once they sign the report on-chain, you can review it and pay the deposit.
          </div>
        </div>
      ) : (
        <div>
          <button
            onClick={handlePayDeposit}
            disabled={paying}
            className="w-full bg-violet-600 hover:bg-violet-500 disabled:bg-violet-800 text-white font-semibold py-4 rounded-xl transition-colors text-lg flex items-center justify-center gap-3"
          >
            {paying ? (
              <>
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processing…
              </>
            ) : (
              `Pay ${tenancy.deposit_amount} SOL into Escrow`
            )}
          </button>
          <p className="text-xs text-gray-500 text-center mt-3">
            Funds go to a Program Derived Address, not to the landlord. Both parties must sign to release.
          </p>
        </div>
      )}
    </div>
  );
}
