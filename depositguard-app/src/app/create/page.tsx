"use client";

import { useState, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useRouter } from "next/navigation";
import WalletGuard from "@/components/WalletGuard";
import { hashFile, combinedHash } from "@/lib/hash";
import { createTenancy, uploadPhoto } from "@/lib/supabase";
import { createTenancyOnChain } from "@/lib/depositguard";

const ROOMS = ["Kitchen", "Bathroom", "Bedroom 1", "Bedroom 2", "Living Room", "Hallway", "Exterior"];

type Step = "details" | "photos" | "inspector" | "confirm";

export default function CreatePage() {
  const { publicKey, connected } = useWallet();
  const router = useRouter();

  const [step, setStep] = useState<Step>("details");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [address, setAddress] = useState("");
  const [deposit, setDeposit] = useState("");
  const [leaseStart, setLeaseStart] = useState("");
  const [leaseEnd, setLeaseEnd] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoHashes, setPhotoHashes] = useState<string[]>([]);
  const [combinedPhotoHash, setCombinedPhotoHash] = useState("");
  const [wantsInspector, setWantsInspector] = useState<boolean | null>(null);

  const handlePhotoChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setPhotos(files);
    const hashes = await Promise.all(files.map(hashFile));
    setPhotoHashes(hashes);
    const combined = await combinedHash(hashes);
    setCombinedPhotoHash(combined);
  }, []);

  const wallet = useWallet();

  const handleSubmit = async () => {
    if (!publicKey) return;
    setLoading(true);
    setError("");

    try {
      // Upload photos to Supabase (non-blocking — hash is what matters on-chain)
      const photoUrls: string[] = [];
      for (let i = 0; i < photos.length; i++) {
        try {
          const url = await uploadPhoto(
            photos[i],
            `${publicKey.toBase58()}/${Date.now()}_${photos[i].name}`
          );
          photoUrls.push(url);
        } catch {
          // Storage upload failed (RLS / bucket policy) — hash already computed, continue
          console.warn("Photo upload skipped:", photos[i].name);
        }
      }

      // Create tenancy record in Supabase (off-chain metadata)
      const tenancy = await createTenancy({
        landlord: publicKey.toBase58(),
        property_address: address,
        deposit_amount: parseFloat(deposit),
        lease_start: leaseStart,
        lease_end: leaseEnd,
        move_in_hash: combinedPhotoHash || null,
        status: wantsInspector ? "AwaitingInspection" : "AwaitingDeposit",
        inspection_tier: wantsInspector ? 1 : 0,
        landlord_agreed: false,
        tenant_agreed: false,
        move_in_photos: photoUrls,
        created_at: new Date().toISOString(),
      });

      // Create escrow PDA on DepositGuard — stores deposit amount and move-in hash on-chain
      try {
        const txSig = await createTenancyOnChain(
          wallet,
          tenancy.id,
          parseFloat(deposit),
          combinedPhotoHash || ""
        );
        // Store the tx signature in Supabase for reference
        await fetch(`/api/tenancies/${tenancy.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tx_signature: txSig, wallet: publicKey.toBase58() }),
        });
      } catch (chainErr) {
        // On-chain creation failed — tenancy still exists in Supabase for retry
        console.warn("On-chain escrow creation failed (can retry):", chainErr);
      }

      router.push(`/dashboard?created=${tenancy.id}`);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: unknown }).message)
          : JSON.stringify(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <WalletGuard
      message="Connect your wallet to continue"
      sub="DepositGuard uses your Phantom wallet as your identity. No account creation needed."
    >
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">Create a Tenancy</h1>
      <p className="text-slate-400 mb-8">
        Set up the deposit escrow for your property. Takes 2 minutes.
      </p>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-10">
        {(["details", "photos", "inspector", "confirm"] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                step === s
                  ? "bg-teal-600 text-white"
                  : ["details", "photos", "inspector", "confirm"].indexOf(step) > i
                  ? "bg-teal-900 text-teal-300"
                  : "bg-slate-800 text-slate-500"
              }`}
            >
              {i + 1}
            </div>
            {i < 3 && <div className="flex-1 h-px bg-slate-800 w-8" />}
          </div>
        ))}
        <div className="ml-2 text-sm text-slate-400 capitalize">{step}</div>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-400 rounded-xl px-4 py-3 mb-6 text-sm">
          {error}
        </div>
      )}

      {/* Step 1: Property details */}
      {step === "details" && (
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Property address
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="12 Grafton Street, Dublin 2, D02 T923"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-teal-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Deposit amount (DEPG)
            </label>
            <div className="relative">
              <input
                type="number"
                value={deposit}
                onChange={(e) => setDeposit(e.target.value)}
                placeholder="2.5"
                min="0"
                step="0.01"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-teal-500 transition-colors"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm">DEPG</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">≈ €{deposit ? (parseFloat(deposit) * 140).toFixed(0) : "0"} EUR at current rates</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Lease start</label>
              <input
                type="date"
                value={leaseStart}
                onChange={(e) => setLeaseStart(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:border-teal-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Lease end</label>
              <input
                type="date"
                value={leaseEnd}
                onChange={(e) => setLeaseEnd(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:border-teal-500 transition-colors"
              />
            </div>
          </div>

          <button
            onClick={() => setStep("photos")}
            disabled={!address || !deposit || !leaseStart || !leaseEnd}
            className="w-full bg-teal-600 hover:bg-teal-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-medium py-3 rounded-xl transition-colors"
          >
            Continue
          </button>
        </div>
      )}

      {/* Step 2: Photos */}
      {step === "photos" && (
        <div className="space-y-5">
          <div>
            <h2 className="font-semibold text-lg mb-1">Upload move-in photos</h2>
            <p className="text-slate-400 text-sm mb-5">
              Photos are hashed with SHA-256 in your browser. The hash is stored on-chain — photos go to Supabase. Cover all rooms: {ROOMS.join(", ")}.
            </p>

            <label className="block w-full border-2 border-dashed border-slate-700 hover:border-teal-500 rounded-xl p-8 text-center cursor-pointer transition-colors">
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handlePhotoChange}
                className="hidden"
              />
              <div className="text-4xl mb-3">📷</div>
              <div className="text-slate-300 font-medium">Click to upload photos</div>
              <div className="text-slate-500 text-sm mt-1">Minimum 2 per room recommended</div>
            </label>

            {photos.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium text-slate-300">{photos.length} photo(s) selected</p>
                {photos.map((f, i) => (
                  <div key={i} className="flex items-center justify-between bg-slate-900 rounded-lg px-4 py-2.5 text-sm">
                    <span className="text-slate-300 truncate max-w-[200px]">{f.name}</span>
                    <span className="font-mono text-xs text-teal-400 truncate max-w-[160px]">
                      {photoHashes[i]?.slice(0, 16)}…
                    </span>
                  </div>
                ))}
                {combinedPhotoHash && (
                  <div className="bg-teal-900/20 border border-teal-500/30 rounded-lg px-4 py-3 mt-2">
                    <p className="text-xs text-teal-400 font-medium mb-1">Combined SHA-256 hash (stored on-chain)</p>
                    <p className="font-mono text-xs text-slate-300 break-all">{combinedPhotoHash}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep("details")}
              className="flex-1 border border-slate-700 hover:border-slate-500 text-slate-300 font-medium py-3 rounded-xl transition-colors"
            >
              Back
            </button>
            <button
              onClick={() => setStep("inspector")}
              className="flex-1 bg-teal-600 hover:bg-teal-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-medium py-3 rounded-xl transition-colors"
            >
              Continue {photos.length === 0 && "(skip photos)"}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Inspector */}
      {step === "inspector" && (
        <div className="space-y-5">
          <h2 className="font-semibold text-lg mb-1">Property inspection</h2>
          <p className="text-slate-400 text-sm mb-5">
            An independent inspector visits your property, photos every room, and signs on-chain. This is your strongest evidence in any dispute.
          </p>

          <div className="grid gap-4">
            <button
              onClick={() => setWantsInspector(true)}
              className={`border-2 rounded-xl p-5 text-left transition-colors ${
                wantsInspector === true
                  ? "border-teal-500 bg-teal-500/10"
                  : "border-slate-700 hover:border-slate-500"
              }`}
            >
              <div className="font-semibold mb-1 flex items-center gap-2">
                <span>Inspector Verified</span>
                <span className="text-xs bg-teal-500/20 text-teal-400 px-2 py-0.5 rounded-full">Recommended</span>
              </div>
              <div className="text-sm text-slate-400">
                Independent inspector visits, signs report on-chain. Strongest evidence if disputed. Fee: €50–100 paid in DEPG.
              </div>
            </button>

            <button
              onClick={() => setWantsInspector(false)}
              className={`border-2 rounded-xl p-5 text-left transition-colors ${
                wantsInspector === false
                  ? "border-teal-500 bg-teal-500/10"
                  : "border-slate-700 hover:border-slate-500"
              }`}
            >
              <div className="font-semibold mb-1">Standard (Free)</div>
              <div className="text-sm text-slate-400">
                Landlord + tenant both sign the same photo hash on-chain. No inspector needed. Weaker evidence in disputes.
              </div>
            </button>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep("photos")}
              className="flex-1 border border-slate-700 hover:border-slate-500 text-slate-300 font-medium py-3 rounded-xl transition-colors"
            >
              Back
            </button>
            <button
              onClick={() => setStep("confirm")}
              disabled={wantsInspector === null}
              className="flex-1 bg-teal-600 hover:bg-teal-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-medium py-3 rounded-xl transition-colors"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Confirm */}
      {step === "confirm" && (
        <div className="space-y-5">
          <h2 className="font-semibold text-lg mb-1">Confirm and create</h2>

          <div className="bg-slate-900 border border-slate-800 rounded-xl divide-y divide-slate-800">
            {[
              { label: "Property", value: address },
              { label: "Deposit amount", value: `${deposit} DEPG` },
              { label: "Lease period", value: `${leaseStart} → ${leaseEnd}` },
              { label: "Photos", value: photos.length > 0 ? `${photos.length} photo(s) hashed` : "None uploaded" },
              { label: "Inspection tier", value: wantsInspector ? "Inspector Verified" : "Standard (mutual sign-off)" },
              { label: "Initial status", value: wantsInspector ? "Awaiting Inspection" : "Awaiting Deposit" },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between px-5 py-3.5 text-sm">
                <span className="text-slate-400">{label}</span>
                <span className="text-slate-100 font-medium text-right max-w-[200px]">{value}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep("inspector")}
              className="flex-1 border border-slate-700 hover:border-slate-500 text-slate-300 font-medium py-3 rounded-xl transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 bg-teal-600 hover:bg-teal-500 disabled:bg-teal-800 text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating…
                </>
              ) : (
                "Create Tenancy"
              )}
            </button>
          </div>
        </div>
      )}
    </div>
    </WalletGuard>
  );
}
