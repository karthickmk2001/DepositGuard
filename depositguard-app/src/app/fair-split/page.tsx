"use client";

import { useState } from "react";

interface AssessmentItem {
  description: string;
  classification: "wear-and-tear" | "damage";
  amount: number;
  reasoning: string;
}

interface AssessmentResult {
  items: AssessmentItem[];
  suggestedLandlordAmount: number;
  suggestedTenantAmount: number;
  rationale: string;
}

const EXAMPLE = {
  depositAmount: "1800",
  moveInNotes:
    "Property was professionally cleaned and freshly painted before move-in. No existing damage recorded. Smoke alarm tested and working.",
  moveOutFindings: [
    "Large red wine stain on living room carpet, approx 40cm wide, not present at move-in.",
    "Smoke alarm in hallway missing entirely — battery compartment cover also gone.",
    "Minor scuff marks on hallway walls at skirting-board height.",
  ],
};

export default function FairSplitPage() {
  const [depositAmount, setDepositAmount] = useState("");
  const [moveInNotes, setMoveInNotes] = useState("");
  const [findings, setFindings] = useState<string[]>([""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AssessmentResult | null>(null);

  const loadExample = () => {
    setDepositAmount(EXAMPLE.depositAmount);
    setMoveInNotes(EXAMPLE.moveInNotes);
    setFindings(EXAMPLE.moveOutFindings);
    setResult(null);
    setError("");
  };

  const updateFinding = (i: number, value: string) => {
    setFindings((prev) => prev.map((f, idx) => (idx === i ? value : f)));
  };

  const addFinding = () => setFindings((prev) => [...prev, ""]);
  const removeFinding = (i: number) =>
    setFindings((prev) => prev.filter((_, idx) => idx !== i));

  const submit = async () => {
    setError("");
    setResult(null);

    const amount = parseFloat(depositAmount);
    const cleanFindings = findings.map((f) => f.trim()).filter(Boolean);

    if (!amount || amount <= 0) {
      setError("Enter a valid deposit amount.");
      return;
    }
    if (!moveInNotes.trim()) {
      setError("Enter move-in condition notes.");
      return;
    }
    if (cleanFindings.length === 0) {
      setError("Add at least one move-out finding.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/dispute-assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          depositAmount: amount,
          moveInNotes,
          moveOutFindings: cleanFindings,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Assessment failed.");
      }
      setResult(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Assessment failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="mb-8">
        <div className="text-sm text-teal-400 font-medium mb-1">Fair Split Assistant</div>
        <h1 className="text-3xl font-bold mb-2">Move-out dispute assistant</h1>
        <p className="text-slate-400 text-sm">
          Describe the move-in condition and what changed at move-out. The AI
          classifies each finding as normal wear-and-tear or chargeable damage,
          and suggests a fair deposit split with a written rationale.
        </p>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-400 rounded-xl px-4 py-3 mb-6 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-5">
        <div className="flex justify-between items-center">
          <label className="block text-sm font-medium text-slate-300">
            Total deposit amount (EUR)
          </label>
          <button
            onClick={loadExample}
            type="button"
            className="text-xs text-teal-400 hover:text-teal-300 underline"
          >
            Load example
          </button>
        </div>
        <input
          type="number"
          value={depositAmount}
          onChange={(e) => setDepositAmount(e.target.value)}
          placeholder="1800"
          min="0"
          step="0.01"
          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-teal-500 transition-colors"
        />

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Move-in condition notes
          </label>
          <textarea
            value={moveInNotes}
            onChange={(e) => setMoveInNotes(e.target.value)}
            rows={3}
            placeholder="e.g. Property was professionally cleaned before move-in, no existing damage recorded..."
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-teal-500 transition-colors resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Move-out findings
          </label>
          <div className="space-y-2">
            {findings.map((f, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="text"
                  value={f}
                  onChange={(e) => updateFinding(i, e.target.value)}
                  placeholder="e.g. Large stain on living room carpet, not present at move-in"
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-teal-500 transition-colors"
                />
                {findings.length > 1 && (
                  <button
                    onClick={() => removeFinding(i)}
                    type="button"
                    className="px-3 text-slate-500 hover:text-red-400 transition-colors"
                    aria-label="Remove finding"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={addFinding}
            type="button"
            className="mt-2 text-sm text-teal-400 hover:text-teal-300"
          >
            + Add another finding
          </button>
        </div>

        <button
          onClick={submit}
          disabled={loading}
          className="w-full bg-teal-600 hover:bg-teal-500 disabled:bg-teal-800 text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {loading && (
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          )}
          {loading ? "Suggesting..." : "Suggest Fair Split"}
        </button>
      </div>

      {result && (
        <div className="mt-10 space-y-5">
          <div className="bg-slate-900 border border-slate-800 rounded-xl divide-y divide-slate-800">
            <div className="px-5 py-4 flex justify-between items-center">
              <span className="text-slate-400 text-sm">Landlord (suggested)</span>
              <span className="font-bold text-orange-400 text-lg tabular-nums">
                €{result.suggestedLandlordAmount.toFixed(2)}
              </span>
            </div>
            <div className="px-5 py-4 flex justify-between items-center">
              <span className="text-slate-400 text-sm">Tenant (suggested)</span>
              <span className="font-bold text-green-400 text-lg tabular-nums">
                €{result.suggestedTenantAmount.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="bg-teal-900/20 border border-teal-500/30 rounded-xl px-5 py-4">
            <p className="text-xs text-teal-400 font-medium mb-1">Rationale</p>
            <p className="text-sm text-slate-300">{result.rationale}</p>
          </div>

          <div>
            <h2 className="font-semibold mb-3">Itemised breakdown</h2>
            <div className="space-y-2">
              {result.items.map((item, i) => (
                <div
                  key={i}
                  className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <span className="text-sm text-slate-200">{item.description}</span>
                    <div className="shrink-0 flex items-center gap-2">
                      {item.classification === "damage" && (
                        <span className="text-sm font-bold text-orange-400 tabular-nums">
                          €{item.amount.toFixed(2)}
                        </span>
                      )}
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          item.classification === "damage"
                            ? "bg-red-900/40 text-red-400 border border-red-700/50"
                            : "bg-green-900/40 text-green-400 border border-green-700/50"
                        }`}
                      >
                        {item.classification === "damage" ? "Damage" : "Wear-and-tear"}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">{item.reasoning}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-slate-600 text-center pt-2">
            Suggestion only — this does not affect your on-chain escrow or deposit.
          </p>
        </div>
      )}
    </div>
  );
}
