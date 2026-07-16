"use client";

import { useEffect, useState, Suspense } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import Link from "next/link";
import WalletGuard from "@/components/WalletGuard";
import { useSearchParams } from "next/navigation";
import { getTenanciesForWallet } from "@/lib/supabase";
import { Tenancy, TenancyStatus } from "@/types/tenancy";

const STATUS_CONFIG: Record<TenancyStatus, { label: string; color: string }> = {
  AwaitingInspection: { label: "Awaiting Inspection", color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30" },
  AwaitingDeposit:    { label: "Awaiting Deposit",    color: "text-blue-400 bg-blue-400/10 border-blue-400/30" },
  Active:             { label: "Active",              color: "text-green-400 bg-green-400/10 border-green-400/30" },
  MoveOutProposed:    { label: "Move-out Proposed",   color: "text-orange-400 bg-orange-400/10 border-orange-400/30" },
  Disputed:           { label: "Disputed",            color: "text-red-400 bg-red-400/10 border-red-400/30" },
  Arbitration:        { label: "In Arbitration",      color: "text-red-400 bg-red-400/10 border-red-400/30" },
  Completed:          { label: "Completed",           color: "text-gray-400 bg-gray-400/10 border-gray-400/30" },
  AutoReleased:       { label: "Auto-Released",       color: "text-gray-400 bg-gray-400/10 border-gray-400/30" },
  Cancelled:          { label: "Cancelled",           color: "text-gray-600 bg-gray-600/10 border-gray-600/30" },
};

function getActionForStatus(tenancy: Tenancy, walletAddr: string) {
  const isLandlord = tenancy.landlord === walletAddr;
  const isTenant = tenancy.tenant === walletAddr;
  const isInspector = tenancy.inspector === walletAddr;

  switch (tenancy.status) {
    case "AwaitingInspection":
      if (isInspector) return { label: "Start Inspection", href: `/inspect/${tenancy.id}` };
      return null;
    case "AwaitingDeposit":
      if (isTenant || !isLandlord) return { label: "Pay Deposit", href: `/deposit/${tenancy.id}` };
      return null;
    case "Active":
      if (isLandlord) return { label: "Initiate Move-out", href: `/resolve/${tenancy.id}` };
      if (isTenant) return { label: "View Tenancy", href: `/deposit/${tenancy.id}` };
      return null;
    case "MoveOutProposed":
      return { label: "Review & Resolve", href: `/resolve/${tenancy.id}` };
    case "Disputed":
      return { label: "View Dispute", href: `/arbitrate/${tenancy.id}` };
    default:
      return { label: "View Details", href: `/deposit/${tenancy.id}` };
  }
}

function DashboardContent() {
  const { publicKey, connected } = useWallet();
  const searchParams = useSearchParams();
  const createdId = searchParams.get("created");

  const [tenancies, setTenancies] = useState<Tenancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!publicKey) return;
    setLoading(true);
    getTenanciesForWallet(publicKey.toBase58())
      .then(setTenancies)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [publicKey]);

  return (
    <WalletGuard message="Connect your wallet" sub="Your dashboard shows all tenancies linked to your Phantom wallet.">
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">
            {publicKey?.toBase58().slice(0, 8)}…{publicKey?.toBase58().slice(-8)}
          </p>
        </div>
        <Link
          href="/create"
          className="bg-violet-600 hover:bg-violet-500 text-white font-medium px-5 py-2.5 rounded-xl transition-colors text-sm"
        >
          + New Tenancy
        </Link>
      </div>

      {/* Success banner */}
      {createdId && (
        <div className="bg-green-900/30 border border-green-700/50 text-green-400 rounded-xl px-5 py-4 mb-6 flex items-center justify-between">
          <div>
            <strong>Tenancy created!</strong> Share the deposit link with your tenant.
          </div>
          <Link
            href={`/deposit/${createdId}`}
            className="text-sm underline hover:text-green-300"
          >
            Copy tenant link →
          </Link>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-3 text-gray-400 py-12 justify-center">
          <span className="w-5 h-5 border-2 border-gray-600 border-t-violet-500 rounded-full animate-spin" />
          Loading your tenancies…
        </div>
      )}

      {!loading && error && (
        <div className="bg-red-900/30 border border-red-700 text-red-400 rounded-xl px-4 py-3 text-sm">{error}</div>
      )}

      {!loading && !error && tenancies.length === 0 && (
        <div className="border border-dashed border-gray-800 rounded-xl py-16 px-6">
          <div className="max-w-sm mx-auto text-center mb-10">
            <h2 className="text-lg font-semibold mb-1">No tenancies yet</h2>
            <p className="text-gray-500 text-sm">Your tenancies will appear here once created or shared with you.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4 max-w-lg mx-auto">
            <Link
              href="/create"
              className="bg-violet-600 hover:bg-violet-500 text-white font-medium px-5 py-3 rounded-xl transition-colors text-center text-sm"
            >
              I&apos;m a Landlord
              <span className="block text-violet-200/70 text-xs font-normal mt-0.5">Create a tenancy</span>
            </Link>
            <div className="border border-gray-700 rounded-xl px-5 py-3 text-center text-sm text-gray-400">
              I&apos;m a Tenant
              <span className="block text-gray-600 text-xs font-normal mt-0.5">Open the link your landlord sent</span>
            </div>
          </div>
        </div>
      )}

      {!loading && tenancies.length > 0 && (
        <div className="space-y-4">
          {tenancies.map((t) => {
            const statusCfg = STATUS_CONFIG[t.status] ?? STATUS_CONFIG.Cancelled;
            const action = publicKey ? getActionForStatus(t, publicKey.toBase58()) : null;
            const role =
              t.landlord === publicKey?.toBase58()
                ? "Landlord"
                : t.tenant === publicKey?.toBase58()
                ? "Tenant"
                : t.inspector === publicKey?.toBase58()
                ? "Inspector"
                : "—";

            return (
              <div
                key={t.id}
                className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${statusCfg.color}`}>
                      {statusCfg.label}
                    </span>
                    <span className="text-xs text-gray-500">{role}</span>
                  </div>
                  <h3 className="font-medium text-gray-100 truncate">{t.property_address}</h3>
                  <div className="flex items-center gap-4 mt-1.5 text-sm text-gray-500">
                    <span>{t.deposit_amount} SOL</span>
                    <span>·</span>
                    <span>{t.lease_start} → {t.lease_end}</span>
                    <span>·</span>
                    <span>{t.inspection_tier === 1 ? "Inspector Verified" : "Standard"}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {t.move_in_hash && (
                    <span className="text-xs text-violet-400 font-mono hidden sm:block">
                      {t.move_in_hash.slice(0, 8)}…
                    </span>
                  )}
                  {action && (
                    <Link
                      href={action.href}
                      className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
                    >
                      {action.label}
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
    </WalletGuard>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center py-24">
        <span className="w-6 h-6 border-2 border-gray-600 border-t-violet-500 rounded-full animate-spin" />
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
