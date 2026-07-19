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
  Completed:          { label: "Completed",           color: "text-slate-400 bg-slate-400/10 border-slate-400/30" },
  AutoReleased:       { label: "Auto-Released",       color: "text-slate-400 bg-slate-400/10 border-slate-400/30" },
  Cancelled:          { label: "Cancelled",           color: "text-slate-600 bg-slate-600/10 border-slate-600/30" },
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
  const { publicKey } = useWallet();
  const searchParams = useSearchParams();
  const createdId = searchParams.get("created");

  const [tenancies, setTenancies] = useState<Tenancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!publicKey) return;
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
          <p className="text-slate-400 text-sm mt-1">
            {publicKey?.toBase58().slice(0, 8)}…{publicKey?.toBase58().slice(-8)}
          </p>
        </div>
        <Link
          href="/create"
          className="bg-teal-600 hover:bg-teal-500 text-white font-medium px-5 py-2.5 rounded-xl transition-colors text-sm"
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
        <div className="flex items-center gap-3 text-slate-400 py-12 justify-center">
          <span className="w-5 h-5 border-2 border-slate-600 border-t-teal-500 rounded-full animate-spin" />
          Loading your tenancies…
        </div>
      )}

      {!loading && error && (
        <div className="bg-red-900/30 border border-red-700 text-red-400 rounded-xl px-4 py-3 text-sm">{error}</div>
      )}

      {!loading && !error && tenancies.length === 0 && (
        <div className="border border-dashed border-slate-800 rounded-xl py-16 px-6">
          <div className="max-w-sm mx-auto text-center mb-10">
            <h2 className="text-lg font-semibold mb-1">No tenancies yet</h2>
            <p className="text-slate-500 text-sm">Your tenancies will appear here once created or shared with you.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4 max-w-lg mx-auto">
            <Link
              href="/create"
              className="bg-teal-600 hover:bg-teal-500 text-white font-medium px-5 py-3 rounded-xl transition-colors text-center text-sm"
            >
              I&apos;m a Landlord
              <span className="block text-teal-200/70 text-xs font-normal mt-0.5">Create a tenancy</span>
            </Link>
            <div className="border border-slate-700 rounded-xl px-5 py-3 text-center text-sm text-slate-400">
              I&apos;m a Tenant
              <span className="block text-slate-600 text-xs font-normal mt-0.5">Open the link your landlord sent</span>
            </div>
          </div>
        </div>
      )}

      {!loading && tenancies.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="hidden sm:grid grid-cols-[auto_1fr_auto_auto] gap-4 px-5 py-2.5 text-[10.5px] font-semibold uppercase tracking-wide text-slate-500 border-b border-slate-800">
            <div>Status</div>
            <div>Property</div>
            <div className="text-right">Deposit</div>
            <div></div>
          </div>
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
                className="grid grid-cols-1 sm:grid-cols-[auto_1fr_auto_auto] items-center gap-2 sm:gap-4 px-5 py-3.5 border-b border-slate-800 last:border-b-0"
              >
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${statusCfg.color}`}>
                    {statusCfg.label}
                  </span>
                  <span className="text-xs text-slate-500 sm:hidden">{role}</span>
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-slate-100 truncate">{t.property_address}</h3>
                    <span className="text-xs text-slate-500 hidden sm:inline">{role}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {t.lease_start} → {t.lease_end} · {t.inspection_tier === 1 ? "Inspector Verified" : "Standard"}
                    {t.move_in_hash && (
                      <span className="font-mono text-teal-400/80"> · {t.move_in_hash.slice(0, 8)}…</span>
                    )}
                  </div>
                </div>

                <div className="tabular-nums text-sm text-slate-300 sm:text-right">
                  {t.deposit_amount} DEPG
                </div>

                <div className="shrink-0">
                  {action && (
                    <Link
                      href={action.href}
                      className="bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap block text-center"
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
        <span className="w-6 h-6 border-2 border-slate-600 border-t-teal-500 rounded-full animate-spin" />
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
