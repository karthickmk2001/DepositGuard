import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col">

      {/* Hero */}
      <section className="relative py-24 px-4 overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src="/hero-terrace.jpg"
            alt=""
            fill
            priority
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-950/85 to-slate-950/55" />
          <div className="absolute inset-0 bg-slate-950/40" />
        </div>

        <div className="relative max-w-3xl mx-auto text-center">
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight leading-[1.1] mb-5">
            Your deposit.<br />
            <span className="text-teal-400">Not your landlord&apos;s.</span>
          </h1>

          <p className="text-lg text-slate-400 max-w-xl mx-auto mb-10 leading-relaxed">
            Ireland has no deposit protection scheme. DepositGuard locks rent deposits in a
            neutral escrow — neither side can touch it without the other agreeing.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/create"
              className="bg-teal-600 hover:bg-teal-500 text-white font-medium px-7 py-3 rounded-xl transition-colors"
            >
              Create a Tenancy
            </Link>
            <Link
              href="/dashboard"
              className="border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white font-medium px-7 py-3 rounded-xl transition-colors"
            >
              View Dashboard
            </Link>
          </div>
        </div>
      </section>

      {/* 3 numbers that matter */}
      <section className="py-12 px-4 border-y border-slate-800/60">
        <div className="max-w-3xl mx-auto grid grid-cols-3 gap-6 text-center">
          <div>
            <div className="text-3xl font-bold text-teal-400 mb-1 tabular-nums">€500M+</div>
            <div className="text-sm text-slate-500">in deposits held by landlords yearly</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-teal-400 mb-1 tabular-nums">0</div>
            <div className="text-sm text-slate-500">deposit protection schemes in Ireland</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-teal-400 mb-1 tabular-nums">9 mo</div>
            <div className="text-sm text-slate-500">average RTB dispute wait time</div>
          </div>
        </div>
      </section>

      {/* Quote */}
      <section className="py-14 px-4">
        <div className="max-w-2xl mx-auto">
          <blockquote className="text-lg text-slate-300 italic border-l-2 border-teal-500 pl-5 leading-relaxed">
            &ldquo;I paid €2,000 deposit. My landlord kept €800 for cleaning that wasn&apos;t needed.
            RTB told me nine months.&rdquo;
          </blockquote>
          <p className="text-sm text-slate-600 mt-3 pl-5">International student, Dublin 2026</p>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 px-4 bg-slate-900/40 border-y border-slate-800/60">
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
                  <div className="w-7 h-7 rounded-full bg-teal-600/20 border border-teal-500/40 text-teal-400 text-xs font-bold flex items-center justify-center shrink-0">
                    {s.num}
                  </div>
                  {i < arr.length - 1 && <div className="w-px flex-1 bg-slate-800 mt-2" />}
                </div>
                <div className="pb-2">
                  <h3 className="font-semibold text-slate-100 mb-1">{s.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{s.desc}</p>
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
          <div className="rounded-xl border border-slate-800 overflow-hidden text-sm">
            <div className="grid grid-cols-3 bg-slate-900 border-b border-slate-800 text-xs font-semibold uppercase tracking-wide">
              <div className="px-5 py-3 text-slate-500" />
              <div className="px-5 py-3 text-slate-500 border-l border-slate-800">Today</div>
              <div className="px-5 py-3 text-teal-400 border-l border-slate-800">DepositGuard</div>
            </div>
            {[
              { label: "Who holds the deposit", current: "Landlord", depositguard: "On-chain PDA" },
              { label: "Move-in evidence", current: "Phone photos, easily faked", depositguard: "SHA-256 hash on-chain" },
              { label: "Dispute resolution", current: "RTB: 6–12 months", depositguard: "Arbitration: days" },
              { label: "Works for international tenants", current: "No", depositguard: "Yes — just a wallet" },
            ].map((row, i) => (
              <div
                key={row.label}
                className={`grid grid-cols-3 ${i % 2 === 0 ? "bg-slate-900/30" : ""}`}
              >
                <div className="px-5 py-3.5 text-slate-400">{row.label}</div>
                <div className="px-5 py-3.5 text-red-400/70 border-l border-slate-800">{row.current}</div>
                <div className="px-5 py-3.5 text-green-400 border-l border-slate-800">{row.depositguard}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-16 px-4 border-t border-slate-800/60">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-3">Try it on Devnet</h2>
          <p className="text-slate-400 text-sm mb-7">
            Connect Phantom, switch to Devnet, and run through the full flow. No real money needed.
          </p>
          <Link
            href="/create"
            className="bg-teal-600 hover:bg-teal-500 text-white font-medium px-8 py-3 rounded-xl transition-colors inline-block"
          >
            Create a Tenancy
          </Link>
        </div>
      </section>

    </div>
  );
}
