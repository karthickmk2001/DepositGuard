"use client";

import { useEffect, useState, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useParams, useRouter } from "next/navigation";
import { getTenancy, updateTenancy, uploadPhoto } from "@/lib/supabase";
import { hashFile, combinedHash } from "@/lib/hash";
import { Tenancy } from "@/types/tenancy";
import {
  proposeReleaseOnChain,
  approveReleaseOnChain,
  disputeOnChain,
  getEscrowPDA,
} from "@/lib/depositguard";

export default function ResolvePage() {
  const { id } = useParams<{ id: string }>();
  const wallet = useWallet();
  const { publicKey, connected } = wallet;
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [tenancy, setTenancy] = useState<Tenancy | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Landlord proposes split
  const [landlordAmount, setLandlordAmount] = useState("");
  const [tenantAmount, setTenantAmount] = useState("");

  // Move-out photos (landlord uploads before proposing split)
  const [moveOutPhotos, setMoveOutPhotos] = useState<File[]>([]);
  const [moveOutHashes, setMoveOutHashes] = useState<string[]>([]);
  const [moveOutCombinedHash, setMoveOutCombinedHash] = useState("");

  // Side-by-side comparison tab
  const [comparisonTab, setComparisonTab] = useState<"move-in" | "move-out">("move-in");

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    getTenancy(id)
      .then((t) => {
        setTenancy(t);
        if (t?.deposit_amount) {
          setLandlordAmount("0");
          setTenantAmount(String(t.deposit_amount));
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleMoveOutPhotos = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setMoveOutPhotos(files);
    const hashes = await Promise.all(files.map(hashFile));
    setMoveOutHashes(hashes);
    const combined = await combinedHash(hashes);
    setMoveOutCombinedHash(combined);
  }, []);

  const handleLandlordAmountChange = (val: string) => {
    const num = parseFloat(val) || 0;
    const total = tenancy?.deposit_amount ?? 0;
    setLandlordAmount(val);
    setTenantAmount(String(Math.max(0, total - num).toFixed(4)));
  };

  const proposeSplit = async () => {
    if (!tenancy || !publicKey) return;
    setSubmitting(true);
    setError("");
    try {
      // Upload move-out photos to Supabase
      const moveOutUrls: string[] = [];
      for (let i = 0; i < moveOutPhotos.length; i++) {
        try {
          const url = await uploadPhoto(
            moveOutPhotos[i],
            `move-out/${id}/${Date.now()}_${moveOutPhotos[i].name}`
          );
          moveOutUrls.push(url);
        } catch {
          console.warn("Move-out photo upload skipped:", moveOutPhotos[i].name);
        }
      }

      // Call on-chain propose_release
      try {
        await proposeReleaseOnChain(wallet, tenancy.id, parseFloat(landlordAmount));
      } catch (chainErr) {
        console.warn("On-chain propose_release failed:", chainErr);
      }

      // Update Supabase
      await updateTenancy(id, {
        proposed_landlord_amt: parseFloat(landlordAmount),
        proposed_tenant_amt: parseFloat(tenantAmount),
        landlord_agreed: true,
        status: "MoveOutProposed",
        move_out_hash: moveOutCombinedHash || null,
        move_out_photos: moveOutUrls.length > 0 ? moveOutUrls : undefined,
      }, publicKey.toBase58());

      router.push("/dashboard");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  const tenantAgree = async () => {
    if (!tenancy || !publicKey) return;
    setSubmitting(true);
    setError("");
    try {
      // Call on-chain approve_release — triggers escrow split
      try {
        await approveReleaseOnChain(wallet, tenancy.id, tenancy.landlord);
      } catch (chainErr) {
        console.warn("On-chain approve_release failed:", chainErr);
      }

      await updateTenancy(id, {
        tenant_agreed: true,
        status: "Completed",
      }, publicKey.toBase58());

      router.push("/dashboard");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  const tenantDispute = async () => {
    if (!tenancy || !publicKey) return;
    setSubmitting(true);
    setError("");
    try {
      // Call on-chain dispute
      try {
        await disputeOnChain(wallet, tenancy.id);
      } catch (chainErr) {
        console.warn("On-chain dispute failed:", chainErr);
      }

      await updateTenancy(id, {
        status: "Disputed",
      }, publicKey.toBase58());

      router.push(`/arbitrate/${id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (!connected) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Connect your wallet</h1>
        <WalletMultiButton style={{ background: "rgb(15 118 110)", borderRadius: "12px" }} />
      </div>
    );
  }

  if (!mounted || loading) {
    return (
      <div className="flex justify-center py-24">
        <span className="w-6 h-6 border-2 border-slate-600 border-t-teal-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!tenancy) {
    return <div className="max-w-lg mx-auto px-4 py-16 text-center"><h1 className="text-xl font-bold">Tenancy not found</h1></div>;
  }

  const isLandlord = tenancy.landlord === publicKey?.toBase58();
  const isTenant = tenancy.tenant === publicKey?.toBase58();
  const hasMoveInPhotos = tenancy.move_in_photos && tenancy.move_in_photos.length > 0;
  const hasMoveOutPhotos = tenancy.move_out_photos && tenancy.move_out_photos.length > 0;

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="mb-8">
        <div className="text-sm text-teal-400 font-medium mb-1">Move-out & Deposit Release</div>
        <h1 className="text-3xl font-bold mb-1">{tenancy.property_address}</h1>
        <p className="text-slate-400 text-sm">Status: {tenancy.status} · Deposit: {tenancy.deposit_amount} DEPG</p>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-400 rounded-xl px-4 py-3 mb-6 text-sm">{error}</div>
      )}

      {/* Escrow PDA */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl px-5 py-3.5 mb-6 flex justify-between items-center">
        <span className="text-slate-400 text-sm">Escrow PDA</span>
        <span className="font-mono text-xs text-teal-300">
          {getEscrowPDA(tenancy.id)[0].toBase58().slice(0, 12)}...
        </span>
      </div>

      {/* Evidence hashes */}
      {(tenancy.move_in_hash || tenancy.inspector_move_in_hash || tenancy.move_out_hash) && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl divide-y divide-slate-800 mb-6">
          {tenancy.move_in_hash && (
            <div className="px-5 py-3.5">
              <div className="text-xs text-teal-400 font-medium mb-1">Move-in evidence hash</div>
              <div className="font-mono text-xs text-slate-300 break-all">{tenancy.move_in_hash}</div>
            </div>
          )}
          {tenancy.inspector_move_in_hash && (
            <div className="px-5 py-3.5">
              <div className="text-xs text-green-400 font-medium mb-1">Inspector move-in report hash</div>
              <div className="font-mono text-xs text-slate-300 break-all">{tenancy.inspector_move_in_hash}</div>
            </div>
          )}
          {tenancy.move_out_hash && (
            <div className="px-5 py-3.5">
              <div className="text-xs text-orange-400 font-medium mb-1">Move-out evidence hash</div>
              <div className="font-mono text-xs text-slate-300 break-all">{tenancy.move_out_hash}</div>
            </div>
          )}
        </div>
      )}

      {/* Side-by-side photo comparison */}
      {(hasMoveInPhotos || hasMoveOutPhotos) && (
        <div className="mb-8">
          <h2 className="font-semibold text-lg mb-3">Photo Comparison</h2>
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setComparisonTab("move-in")}
              className={`text-sm px-4 py-2 rounded-lg transition-colors ${
                comparisonTab === "move-in"
                  ? "bg-teal-600 text-white"
                  : "bg-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              Move-in Photos
            </button>
            <button
              onClick={() => setComparisonTab("move-out")}
              className={`text-sm px-4 py-2 rounded-lg transition-colors ${
                comparisonTab === "move-out"
                  ? "bg-orange-600 text-white"
                  : "bg-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              Move-out Photos
            </button>
          </div>

          {comparisonTab === "move-in" && hasMoveInPhotos && (
            <div className="grid grid-cols-3 gap-2">
              {tenancy.move_in_photos!.map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={url}
                  alt={`Move-in ${i + 1}`}
                  className="rounded-lg aspect-square object-cover w-full border border-teal-500/30"
                />
              ))}
            </div>
          )}

          {comparisonTab === "move-out" && hasMoveOutPhotos && (
            <div className="grid grid-cols-3 gap-2">
              {tenancy.move_out_photos!.map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={url}
                  alt={`Move-out ${i + 1}`}
                  className="rounded-lg aspect-square object-cover w-full border border-orange-500/30"
                />
              ))}
            </div>
          )}

          {comparisonTab === "move-in" && !hasMoveInPhotos && (
            <p className="text-slate-500 text-sm text-center py-4">No move-in photos uploaded</p>
          )}
          {comparisonTab === "move-out" && !hasMoveOutPhotos && (
            <p className="text-slate-500 text-sm text-center py-4">No move-out photos yet</p>
          )}
        </div>
      )}

      {/* Landlord proposes split */}
      {isLandlord && tenancy.status === "Active" && (
        <div className="space-y-5">
          <h2 className="font-semibold text-lg">Propose deposit split</h2>
          <p className="text-slate-400 text-sm">
            Upload move-out photos and enter how much of the {tenancy.deposit_amount} DEPG deposit each party should receive.
          </p>

          {/* Move-out photo upload */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Move-out photos
            </label>
            <label className="block w-full border-2 border-dashed border-slate-700 hover:border-orange-500 rounded-xl p-6 text-center cursor-pointer transition-colors">
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleMoveOutPhotos}
                className="hidden"
              />
              <div className="text-2xl mb-1">📷</div>
              <div className="text-sm text-slate-400">
                {moveOutPhotos.length === 0
                  ? "Upload move-out photos"
                  : `${moveOutPhotos.length} photo(s) selected`}
              </div>
            </label>

            {moveOutHashes.length > 0 && (
              <div className="mt-3 space-y-1">
                {moveOutHashes.map((h, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="text-green-400">✓</span>
                    <span className="font-mono">{h.slice(0, 16)}...</span>
                    <span className="text-slate-600">{moveOutPhotos[i]?.name}</span>
                  </div>
                ))}
                {moveOutCombinedHash && (
                  <div className="bg-orange-900/20 border border-orange-500/30 rounded-lg px-4 py-3 mt-2">
                    <p className="text-xs text-orange-400 font-medium mb-1">Combined move-out SHA-256 hash</p>
                    <p className="font-mono text-xs text-slate-300 break-all">{moveOutCombinedHash}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Landlord receives (DEPG)
              </label>
              <input
                type="number"
                value={landlordAmount}
                onChange={(e) => handleLandlordAmountChange(e.target.value)}
                min="0"
                max={tenancy.deposit_amount}
                step="0.01"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:border-teal-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Tenant receives (DEPG)
              </label>
              <input
                type="number"
                value={tenantAmount}
                readOnly
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-400 cursor-not-allowed"
              />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl px-5 py-3 flex justify-between items-center">
            <span className="text-slate-400 text-sm">Total deposit</span>
            <span className="font-bold text-teal-400 tabular-nums">{tenancy.deposit_amount} DEPG</span>
          </div>

          <button
            onClick={proposeSplit}
            disabled={submitting}
            className="w-full bg-teal-600 hover:bg-teal-500 disabled:bg-teal-800 text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
            Propose Split & Sign On-Chain
          </button>
        </div>
      )}

      {/* Tenant reviews split */}
      {isTenant && tenancy.status === "MoveOutProposed" && (
        <div className="space-y-5">
          <h2 className="font-semibold text-lg">Landlord has proposed a split</h2>

          <div className="bg-slate-900 border border-slate-800 rounded-xl divide-y divide-slate-800">
            <div className="px-5 py-4 flex justify-between">
              <span className="text-slate-400 text-sm">Landlord keeps</span>
              <span className="font-bold text-orange-400 tabular-nums">{tenancy.proposed_landlord_amt} DEPG</span>
            </div>
            <div className="px-5 py-4 flex justify-between">
              <span className="text-slate-400 text-sm">You receive</span>
              <span className="font-bold text-green-400 tabular-nums">{tenancy.proposed_tenant_amt} DEPG</span>
            </div>
          </div>

          <p className="text-slate-400 text-sm">
            Review the move-in and move-out evidence above. If you agree, the escrow releases on-chain automatically. If you disagree, an arbitrator will review the on-chain evidence.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={tenantDispute}
              disabled={submitting}
              className="border border-red-700 hover:border-red-500 text-red-400 hover:text-red-300 font-medium py-3 rounded-xl transition-colors"
            >
              Dispute
            </button>
            <button
              onClick={tenantAgree}
              disabled={submitting}
              className="bg-green-700 hover:bg-green-600 text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
              Agree & Release On-Chain
            </button>
          </div>
        </div>
      )}

      {/* Landlord view of proposed split */}
      {isLandlord && tenancy.status === "MoveOutProposed" && (
        <div className="bg-yellow-900/20 border border-yellow-700/40 rounded-xl px-5 py-6 text-center">
          <div className="text-yellow-400 font-semibold">Split proposed — waiting for tenant</div>
          <div className="text-sm text-slate-400 mt-2">
            You proposed {tenancy.proposed_landlord_amt} DEPG to yourself and {tenancy.proposed_tenant_amt} DEPG to the tenant.
            They will review and either agree or dispute.
          </div>
        </div>
      )}

      {tenancy.status === "Completed" && (
        <div className="bg-green-900/20 border border-green-700/40 rounded-xl px-5 py-6 text-center">
          <div className="text-green-400 text-2xl mb-2">✓</div>
          <div className="font-semibold text-green-400">Deposit released on-chain</div>
          <div className="text-sm text-slate-400 mt-1">Both parties agreed. Escrow has been released.</div>
        </div>
      )}

      {tenancy.status === "Disputed" && (
        <div className="bg-red-900/20 border border-red-700/40 rounded-xl px-5 py-6 text-center">
          <div className="text-red-400 font-semibold mb-2">Deposit is disputed</div>
          <div className="text-sm text-slate-400">
            An arbitrator will review the on-chain evidence and decide the split.
          </div>
          <a
            href={`/arbitrate/${id}`}
            className="inline-block mt-4 text-sm text-teal-400 hover:text-teal-300 underline"
          >
            View arbitration panel →
          </a>
        </div>
      )}
    </div>
  );
}
