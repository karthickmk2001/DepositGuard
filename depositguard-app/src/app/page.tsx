import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col">

      {/* Hero */}
      <section className="relative py-24 px-4 overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[500px] h-[500px] rounded-full bg-violet-600/8 blur-3xl" />
        </div>

        <div className="relative max-w-3xl mx-auto text-center">
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight leading-[1.1] mb-5">
            Your deposit.<br />
            <span className="text-violet-400">Not your landlord&apos;s.</span>
          </h1>

          <p className="text-lg text-gray-400 max-w-xl mx-auto mb-10 leading-relaxed">
            Ireland has no deposit protection scheme. DepositGuard locks rent deposits in a
            neutral escrow — neither side can touch it without the other agreeing.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/create"
              className="bg-violet-600 hover:bg-violet-500 text-white font-medium px-7 py-3 rounded-xl transition-colors"
            >
              Create a Tenancy
            </Link>
            <Link
              href="/dashboard"
              className="border border-gray-700 hover:border-gray-600 text-gray-300 hover:text-white font-medium px-7 py-3 rounded-xl transition-colors"
            >
              View Dashboard
            </Link>
          </div>
        </div>
      </section>

      {/* 3 numbers that matter */}
      <section className="py-12 px-4 border-y border-gray-800/60">
        <div className="max-w-3xl mx-auto grid grid-cols-3 gap-6 text-center">
          <div>
            <div className="text-3xl font-bold text-violet-400 mb-1">€500M+</div>
            <div className="text-sm text-gray-500">in deposits held by landlords yearly</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-violet-400 mb-1">0</div>
            <div className="text-sm text-gray-500">deposit protection schemes in Ireland</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-violet-400 mb-1">9 mo</div>
            <div className="text-sm text-gray-500">average RTB dispute wait time</div>
          </div>
        </div>
      </section>

      {/* Quote */}
      <section className="py-14 px-4">
        <div className="max-w-2xl mx-auto">
          <blockquote className="text-lg text-gray-300 italic border-l-2 border-violet-500 pl-5 leading-relaxed">
            &ldquo;I paid €2,000 deposit. My landlord kept €800 for cleaning that wasn&apos;t needed.
            RTB told me nine months.&rdquo;
          </blockquote>
          <p className="text-sm text-gray-600 mt-3 pl-5">International student, Dublin 2026</p>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 px-4 bg-gray-900/40 border-y border-gray-800/60">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold mb-10">How it works</h2>
          <div className="space-y-0">
            {[
              {
                num: "1",
                title: "Landlord creates the escrow",
                desc: "Sets the deposit amount, uploads move-in photos. A SHA-256 hash of every photo is stored on-chain — tamper-proof from day one.",
              },
              {
                num: "2",
                title: "Inspector signs the condition report",
                desc: "An independent inspector visits, photographs every room, and signs the report on-chain. This is the baseline both sides agree to.",
              },
              {
                num: "3",
                title: "Tenant pays into the PDA",
                desc: "Deposit goes to a Program Derived Address — not the landlord's wallet. Neither side can withdraw unilaterally.",
              },
              {
                num: "4",
                title: "Move-out: both sign or arbitrate",
                desc: "Agree on the split → escrow releases in seconds. Dispute → an arbitrator reviews the on-chain evidence and decides. No nine-month wait.",
              },
            ].map((s, i, arr) => (
              <div key={s.num} className={`flex gap-5 ${i < arr.length - 1 ? "pb-8" : ""}`}>
                <div className="flex flex-col items-center">
                  <div className="w-7 h-7 rounded-full bg-violet-600/20 border border-violet-500/40 text-violet-400 text-xs font-bold flex items-center justify-center shrink-0">
                    {s.num}
                  </div>
                  {i < arr.length - 1 && <div className="w-px flex-1 bg-gray-800 mt-2" />}
                </div>
                <div className="pb-2">
                  <h3 className="font-semibold text-gray-100 mb-1">{s.title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold mb-8">Current system vs DepositGuard</h2>
          <div className="rounded-xl border border-gray-800 overflow-hidden text-sm">
            <div className="grid grid-cols-3 bg-gray-900 border-b border-gray-800 text-xs font-semibold uppercase tracking-wide">
              <div className="px-5 py-3 text-gray-500" />
              <div className="px-5 py-3 text-gray-500 border-l border-gray-800">Today</div>
              <div className="px-5 py-3 text-violet-400 border-l border-gray-800">DepositGuard</div>
            </div>
            {[
              { label: "Who holds the deposit", current: "Landlord", depositguard: "On-chain PDA" },
              { label: "Move-in evidence", current: "Phone photos, easily faked", depositguard: "SHA-256 hash on-chain" },
              { label: "Dispute resolution", current: "RTB: 6–12 months", depositguard: "Arbitration: days" },
              { label: "Works for international tenants", current: "No", depositguard: "Yes — just a wallet" },
            ].map((row, i) => (
              <div
                key={row.label}
                className={`grid grid-cols-3 ${i % 2 === 0 ? "bg-gray-900/30" : ""}`}
              >
                <div className="px-5 py-3.5 text-gray-400">{row.label}</div>
                <div className="px-5 py-3.5 text-red-400/70 border-l border-gray-800">{row.current}</div>
                <div className="px-5 py-3.5 text-green-400 border-l border-gray-800">{row.depositguard}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-16 px-4 border-t border-gray-800/60">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-3">Try it on Devnet</h2>
          <p className="text-gray-400 text-sm mb-7">
            Connect Phantom, switch to Devnet, and run through the full flow. No real SOL needed.
          </p>
          <Link
            href="/create"
            className="bg-violet-600 hover:bg-violet-500 text-white font-medium px-8 py-3 rounded-xl transition-colors inline-block"
          >
            Create a Tenancy
          </Link>
        </div>
      </section>

    </div>
  );
}
