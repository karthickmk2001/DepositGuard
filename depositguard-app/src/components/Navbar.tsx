"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useMounted } from "@/lib/useMounted";

export default function Navbar() {
  const pathname = usePathname();
  const mounted = useMounted();

  return (
    <nav className="border-b border-slate-800/60 bg-slate-950/90 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">

        <Link href="/" className="flex items-center gap-1.5 shrink-0">
          <span className="text-teal-400 font-bold text-lg tracking-tight">Deposit</span>
          <span className="font-bold text-lg tracking-tight">Guard</span>
          <span className="ml-1.5 text-[10px] bg-teal-500/15 text-teal-400 px-1.5 py-0.5 rounded border border-teal-500/20">
            Devnet
          </span>
        </Link>

        <div className="flex items-center gap-5">
          {[
            { href: "/create", label: "New Tenancy" },
            { href: "/dashboard", label: "Dashboard" },
            { href: "/fair-split", label: "Fair Split Assistant" },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`text-sm hidden sm:block transition-colors ${
                pathname === l.href
                  ? "text-teal-400"
                  : "text-slate-400 hover:text-slate-100"
              }`}
            >
              {l.label}
            </Link>
          ))}

          {mounted && (
            <WalletMultiButton
              style={{
                background: "rgb(15 118 110)",
                height: "34px",
                fontSize: "13px",
                borderRadius: "8px",
                padding: "0 14px",
              }}
            />
          )}
        </div>
      </div>
    </nav>
  );
}
