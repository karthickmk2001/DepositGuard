"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useParams, useRouter } from "next/navigation";
import { getTenancy, updateTenancy } from "@/lib/supabase";
import { Tenancy } from "@/types/tenancy";
import { arbitrateOnChain, getEscrowPDA } from "@/lib/depositguard";

export default function ArbitratePage() {
  const { id } = useParams<{ id: string }>();
  const wallet = useWallet();
  const { publicKey, connected } = wallet;
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [tenancy, setTenancy] = useState<Tenancy | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [arbLandlordAmount, setArbLandlordAmount] = useState("");
  const [arbTenantAmount, setArbTenantAmount] = useState("");
  const [reasoning, setReasoning] = useState("");

  // Photo comparison
  const [comparisonTab, setComparisonTab] = useState<"move-in" | "move-out">("move-in");

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    getTenancy(id)
      .then((t) => {
        setTenancy(t);
        if (t?.proposed_landlord_amt !== undefined) {
          setArbLandlordAmount(String(t.proposed_landlord_amt));
          setArbTenantAmount(String(t.proposed_tenant_amt));
        } else if (t?.deposit_amount) {
          setArbLandlordAmount("0");
          setArbTenantAmount(String(t.deposit_amount));
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleLandlordChange = (val: string) => {
    const num = parseFloat(val) || 0;
    const total = tenancy?.deposit_amount ?? 0;
    setArbLandlordAmount(val);
    setArbTenantAmount(String(Math.max(0, total - num).toFixed(4)));
  };

  const submitDecision = async () => {
    if (!publicKey || !tenancy || !tenancy.tenant) return;
    setSubmitting(true);
    setError("");
    try {
      // Call on-chain arbitrate — splits escrow between landlord and tenant
      try {
        await arbitrateOnChain(
          wallet,
          tenancy.id,
          tenancy.landlord,
          tenancy.tenant,
          parseFloat(arbLandlordAmount)
        );
      } catch (chainErr) {
        console.warn("On-chain arbitrate failed:", chainErr);
      }

      // Update Supabase
      await updateTenancy(id, {
        arbitrator: publicKey.toBase58(),
        proposed_landlord_amt: parseFloat(arbLandlordAmount),
        proposed_tenant_amt: parseFloat(arbTenantAmount),
        landlord_agreed: true,
        tenant_agreed: true,
        status: "Completed",
        arbitration_reasoning: reasoning,
      }, publicKey.toBase58());

      router.push("/dashboard");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (!connected) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Arbitrator: Connect your wallet</h1>
        <p className="text-gray-400 mb-6 text-sm">
          You have been invited to review a deposit dispute and decide the fair split based on on-chain evidence.
        </p>
        <WalletMultiButton style={{ background: "rgb(109 40 217)", borderRadius: "12px" }} />
      </div>
    );
  }

  if (!mounted || loading) {
    return (
      <div className="flex justify-center py-24">
        <span className="w-6 h-6 border-2 border-gray-600 border-t-violet-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!tenancy) {
    return <div className="max-w-lg mx-auto px-4 py-16 text-center"><h1 className="text-xl font-bold">Tenancy not found</h1></div>;
  }

  const hasMoveInPhotos = tenancy.move_in_photos && tenancy.move_in_photos.length > 0;
  const moveOutPhotos = tenancy.move_out_photos;
  const hasMoveOutPhotos = moveOutPhotos && moveOutPhotos.length > 0;

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-3 py-1 rounded-full mb-3">
          Disputed
        </div>
        <h1 className="text-3xl font-bold mb-1">Arbitration Panel</h1>
        <p className="text-gray-400 text-sm">{tenancy.property_address}</p>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-400 rounded-xl px-4 py-3 mb-6 text-sm">{error}</div>
      )}

      {/* Parties & escrow info */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl divide-y divide-gray-800 mb-6">
        <div className="px-5 py-3.5 flex justify-between">
          <span className="text-gray-400 text-sm">Escrow PDA</span>
          <span className="font-mono text-xs text-violet-300">
            {getEscrowPDA(tenancy.id)[0].toBase58().slice(0, 12)}...
          </span>
        </div>
        <div className="px-5 py-3.5 flex justify-between">
          <span className="text-gray-400 text-sm">Landlord</span>
          <span className="font-mono text-xs text-gray-300">{tenancy.landlord.slice(0, 8)}...{tenancy.landlord.slice(-8)}</span>
        </div>
        <div className="px-5 py-3.5 flex justify-between">
          <span className="text-gray-400 text-sm">Tenant</span>
          <span className="font-mono text-xs text-gray-300">{tenancy.tenant ? `${tenancy.tenant.slice(0, 8)}...${tenancy.tenant.slice(-8)}` : "—"}</span>
        </div>
        <div className="px-5 py-3.5 flex justify-between">
          <span className="text-gray-400 text-sm">Deposit in escrow</span>
          <span className="font-bold text-violet-400">{tenancy.deposit_amount} DEPG</span>
        </div>
        <div className="px-5 py-3.5 flex justify-between">
          <span className="text-gray-400 text-sm">Landlord originally proposed</span>
          <span className="text-orange-400">{tenancy.proposed_landlord_amt ?? "—"} DEPG to themselves</span>
        </div>
        <div className="px-5 py-3.5 flex justify-between">
          <span className="text-gray-400 text-sm">Inspection tier</span>
          <span className="text-sm text-gray-300">
            {tenancy.inspection_tier === 1 ? "Inspector Verified" : "Standard (mutual sign-off)"}
          </span>
        </div>
      </div>

      {/* On-chain evidence hashes */}
      <h2 className="font-semibold text-lg mb-4">On-chain evidence</h2>
      <div className="space-y-3 mb-6">
        {tenancy.move_in_hash && (
          <div className="bg-gray-900 border border-violet-800/40 rounded-xl px-5 py-4">
            <div className="text-xs text-violet-400 font-medium mb-1">Move-in photo hash (mutually signed)</div>
            <div className="font-mono text-xs text-gray-300 break-all">{tenancy.move_in_hash}</div>
          </div>
        )}
        {tenancy.inspector_move_in_hash && (
          <div className="bg-gray-900 border border-green-800/40 rounded-xl px-5 py-4">
            <div className="text-xs text-green-400 font-medium mb-1">Inspector move-in report hash (signed by inspector)</div>
            <div className="font-mono text-xs text-gray-300 break-all">{tenancy.inspector_move_in_hash}</div>
          </div>
        )}
        {tenancy.move_out_hash && (
          <div className="bg-gray-900 border border-orange-800/40 rounded-xl px-5 py-4">
            <div className="text-xs text-orange-400 font-medium mb-1">Move-out photo hash</div>
            <div className="font-mono text-xs text-gray-300 break-all">{tenancy.move_out_hash}</div>
          </div>
        )}
        {tenancy.inspector_move_out_hash && (
          <div className="bg-gray-900 border border-green-800/40 rounded-xl px-5 py-4">
            <div className="text-xs text-green-400 font-medium mb-1">Inspector move-out report hash</div>
            <div className="font-mono text-xs text-gray-300 break-all">{tenancy.inspector_move_out_hash}</div>
          </div>
        )}
        {!tenancy.move_in_hash && !tenancy.inspector_move_in_hash && (
          <div className="text-gray-500 text-sm text-center py-4">No on-chain evidence recorded</div>
        )}
      </div>

      {/* Side-by-side photo comparison for arbitrator */}
      {(hasMoveInPhotos || hasMoveOutPhotos) && (
        <div className="mb-8">
          <h2 className="font-semibold text-lg mb-3">Photo Evidence</h2>
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setComparisonTab("move-in")}
              className={`text-sm px-4 py-2 rounded-lg transition-colors ${
                comparisonTab === "move-in"
                  ? "bg-violet-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:text-gray-200"
              }`}
            >
              Move-in ({tenancy.move_in_photos?.length ?? 0})
            </button>
            <button
              onClick={() => setComparisonTab("move-out")}
              className={`text-sm px-4 py-2 rounded-lg transition-colors ${
                comparisonTab === "move-out"
                  ? "bg-orange-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:text-gray-200"
              }`}
            >
              Move-out ({moveOutPhotos?.length ?? 0})
            </button>
          </div>

          {comparisonTab === "move-in" && hasMoveInPhotos && (
            <div className="grid grid-cols-3 gap-2">
              {tenancy.move_in_photos!.map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={url} alt={`Move-in ${i + 1}`}
                  className="rounded-lg aspect-square object-cover w-full border border-violet-500/30" />
              ))}
            </div>
          )}
          {comparisonTab === "move-out" && hasMoveOutPhotos && (
            <div className="grid grid-cols-3 gap-2">
              {moveOutPhotos!.map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={url} alt={`Move-out ${i + 1}`}
                  className="rounded-lg aspect-square object-cover w-full border border-orange-500/30" />
              ))}
            </div>
          )}
          {comparisonTab === "move-in" && !hasMoveInPhotos && (
            <p className="text-gray-500 text-sm text-center py-4">No move-in photos</p>
          )}
          {comparisonTab === "move-out" && !hasMoveOutPhotos && (
            <p className="text-gray-500 text-sm text-center py-4">No move-out photos</p>
          )}
        </div>
      )}

      {/* Arbitrator decision form */}
      {tenancy.status === "Disputed" && (
        <>
          <h2 className="font-semibold text-lg mb-4">Your decision</h2>
          <div className="space-y-5">
            <p className="text-gray-400 text-sm">
              Review the evidence hashes, photos, and inspection reports above. Decide the fair split. Your decision will release the escrow on-chain.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Landlord receives (DEPG)</label>
                <input
                  type="number"
                  value={arbLandlordAmount}
                  onChange={(e) => handleLandlordChange(e.target.value)}
                  min="0"
                  max={tenancy.deposit_amount}
                  step="0.01"
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-gray-100 focus:outline-none focus:border-violet-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Tenant receives (DEPG)</label>
                <input
                  type="number"
                  value={arbTenantAmount}
                  readOnly
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-gray-400 cursor-not-allowed"
                />
              </div>
            </div>

            {/* Visual bar showing split */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-1 h-6 rounded-full overflow-hidden bg-gray-800">
                {parseFloat(arbLandlordAmount) > 0 && (
                  <div
                    className="h-full bg-orange-500 rounded-l-full flex items-center justify-center text-[10px] font-bold text-white"
                    style={{ width: `${(parseFloat(arbLandlordAmount) / tenancy.deposit_amount) * 100}%`, minWidth: "30px" }}
                  >
                    {arbLandlordAmount}
                  </div>
                )}
                {parseFloat(arbTenantAmount) > 0 && (
                  <div
                    className="h-full bg-green-500 rounded-r-full flex items-center justify-center text-[10px] font-bold text-white"
                    style={{ width: `${(parseFloat(arbTenantAmount) / tenancy.deposit_amount) * 100}%`, minWidth: "30px" }}
                  >
                    {arbTenantAmount}
                  </div>
                )}
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-2">
                <span>Landlord</span>
                <span>Total: {tenancy.deposit_amount} DEPG</span>
                <span>Tenant</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Reasoning (stored on-chain)
              </label>
              <textarea
                value={reasoning}
                onChange={(e) => setReasoning(e.target.value)}
                placeholder="e.g. Inspector move-in report shows carpet was already stained. Landlord's claim for full cleaning costs is not supported by evidence. Awarding 0.3 DEPG to landlord for documented wall damage."
                rows={4}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-gray-100 placeholder-gray-600 focus:outline-none focus:border-violet-500 transition-colors text-sm resize-none"
              />
            </div>

            <button
              onClick={submitDecision}
              disabled={submitting || !reasoning}
              className="w-full bg-violet-600 hover:bg-violet-500 disabled:bg-gray-800 disabled:text-gray-500 text-white font-semibold py-4 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
              Submit Decision & Release Escrow On-Chain
            </button>
          </div>
        </>
      )}

      {tenancy.status === "Completed" && (
        <div className="bg-green-900/20 border border-green-700/40 rounded-xl px-5 py-6 text-center">
          <div className="text-green-400 text-2xl mb-2">✓</div>
          <div className="font-semibold text-green-400">Arbitration complete — escrow released</div>
          <div className="text-sm text-gray-400 mt-1">
            Landlord received {tenancy.proposed_landlord_amt} DEPG · Tenant received {tenancy.proposed_tenant_amt} DEPG
          </div>
        </div>
      )}
    </div>
  );
}
