"use client";

import { useEffect, useState, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useParams, useRouter } from "next/navigation";
import { getTenancy, updateTenancy, uploadPhoto } from "@/lib/supabase";
import { hashFile, combinedHash } from "@/lib/hash";
import { Tenancy } from "@/types/tenancy";

const ROOMS = [
  "Kitchen",
  "Bathroom",
  "Bedroom 1",
  "Bedroom 2",
  "Living Room",
  "Hallway",
  "Exterior",
];

interface RoomData {
  photos: File[];
  photoUrls: string[];
  hashes: string[];
  condition: string;
  preExistingDamage: string;
}

const emptyRoom = (): RoomData => ({
  photos: [],
  photoUrls: [],
  hashes: [],
  condition: "",
  preExistingDamage: "",
});

export default function InspectPage() {
  const { id } = useParams<{ id: string }>();
  const { publicKey, connected } = useWallet();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [tenancy, setTenancy] = useState<Tenancy | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [currentRoom, setCurrentRoom] = useState(0);
  const [overallRating, setOverallRating] = useState(3);
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsError, setGpsError] = useState("");
  const [rooms, setRooms] = useState<RoomData[]>(ROOMS.map(() => emptyRoom()));

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    getTenancy(id)
      .then(setTenancy)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));

    // Capture GPS on load
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setGpsError("GPS not available — continue without it")
      );
    }
  }, [id]);

  const handlePhotoChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>, roomIndex: number) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length === 0) return;

      const hashes = await Promise.all(files.map(hashFile));
      setRooms((prev) => {
        const next = [...prev];
        next[roomIndex] = {
          ...next[roomIndex],
          photos: [...next[roomIndex].photos, ...files],
          hashes: [...next[roomIndex].hashes, ...hashes],
        };
        return next;
      });
    },
    []
  );

  const updateRoom = (roomIndex: number, field: keyof RoomData, value: string) => {
    setRooms((prev) => {
      const next = [...prev];
      next[roomIndex] = { ...next[roomIndex], [field]: value };
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!publicKey || !tenancy) return;
    setSubmitting(true);
    setError("");

    try {
      const timestamp = new Date().toISOString();

      // Upload all room photos to Supabase
      const roomsWithUrls = [...rooms];
      for (let r = 0; r < ROOMS.length; r++) {
        const urls: string[] = [];
        for (let p = 0; p < rooms[r].photos.length; p++) {
          const url = await uploadPhoto(
            rooms[r].photos[p],
            `inspections/${id}/${ROOMS[r].replace(" ", "_")}_${p}_${Date.now()}.jpg`
          );
          urls.push(url);
        }
        roomsWithUrls[r].photoUrls = urls;
      }

      // Build combined hash of all evidence
      const allHashes = rooms.flatMap((r) => r.hashes);
      const reportHash = await combinedHash([
        ...allHashes,
        gps ? `${gps.lat},${gps.lng}` : "",
        timestamp,
        publicKey.toBase58(),
      ]);

      // TODO (Week 2): Sign this hash on-chain with the inspector's wallet via Anchor
      // For now: save to Supabase
      await updateTenancy(id, {
        inspector: publicKey.toBase58(),
        inspector_move_in_hash: reportHash,
        status: "AwaitingDeposit",
        inspection_data: JSON.stringify({
          inspector: publicKey.toBase58(),
          gps,
          timestamp,
          overall_rating: overallRating,
          rooms: ROOMS.map((name, i) => ({
            name,
            condition: roomsWithUrls[i].condition,
            preExistingDamage: roomsWithUrls[i].preExistingDamage,
            photoUrls: roomsWithUrls[i].photoUrls,
            hashes: roomsWithUrls[i].hashes,
          })),
          combined_hash: reportHash,
        }),
      }, publicKey.toBase58());

      router.push("/dashboard");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (!connected) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Inspector: Connect your wallet</h1>
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
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <h1 className="text-xl font-bold">Tenancy not found</h1>
      </div>
    );
  }

  const room = rooms[currentRoom];
  const allRoomsHavePhotos = rooms.every((r) => r.photos.length >= 1);
  const totalPhotos = rooms.reduce((s, r) => s + r.photos.length, 0);

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="text-sm text-teal-400 font-medium mb-1">Property Inspection Tool</div>
        <h1 className="text-2xl font-bold">{tenancy.property_address}</h1>

        {/* GPS status */}
        <div className="flex items-center gap-2 mt-2">
          {gps ? (
            <span className="text-xs text-green-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              GPS captured: {gps.lat.toFixed(4)}, {gps.lng.toFixed(4)}
            </span>
          ) : (
            <span className="text-xs text-yellow-500">{gpsError || "Requesting GPS…"}</span>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-400 rounded-xl px-4 py-3 mb-4 text-sm">
          {error}
        </div>
      )}

      {/* Room tabs */}
      <div className="flex gap-1.5 flex-wrap mb-6">
        {ROOMS.map((name, i) => (
          <button
            key={name}
            onClick={() => setCurrentRoom(i)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              currentRoom === i
                ? "border-teal-500 bg-teal-500/20 text-teal-300"
                : rooms[i].photos.length > 0
                ? "border-green-700 bg-green-900/20 text-green-400"
                : "border-slate-700 text-slate-400 hover:border-slate-500"
            }`}
          >
            {name} {rooms[i].photos.length > 0 && `(${rooms[i].photos.length})`}
          </button>
        ))}
      </div>

      {/* Current room form */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-5 space-y-4">
        <h2 className="font-semibold">{ROOMS[currentRoom]}</h2>

        {/* Photo upload */}
        <div>
          <label className="block border-2 border-dashed border-slate-700 hover:border-teal-500 rounded-xl p-5 text-center cursor-pointer transition-colors">
            <input
              type="file"
              multiple
              accept="image/*"
              capture="environment"
              onChange={(e) => handlePhotoChange(e, currentRoom)}
              className="hidden"
            />
            <div className="text-2xl mb-1">📷</div>
            <div className="text-sm text-slate-400">
              {room.photos.length === 0
                ? "Take or upload photos"
                : `${room.photos.length} photo(s) — tap to add more`}
            </div>
          </label>

          {room.hashes.length > 0 && (
            <div className="mt-2 space-y-1">
              {room.hashes.map((h, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="text-green-400">✓</span>
                  <span className="font-mono">{h.slice(0, 16)}…</span>
                  <span className="text-slate-600">{room.photos[i]?.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Condition notes */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Condition notes
          </label>
          <textarea
            value={room.condition}
            onChange={(e) => updateRoom(currentRoom, "condition", e.target.value)}
            placeholder="e.g. Good condition, minor scuff on wall near door"
            rows={3}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-teal-500 transition-colors text-sm resize-none"
          />
        </div>

        {/* Pre-existing damage */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Pre-existing damage (if any)
          </label>
          <textarea
            value={room.preExistingDamage}
            onChange={(e) => updateRoom(currentRoom, "preExistingDamage", e.target.value)}
            placeholder="e.g. Small crack in ceiling tile (existing, not new)"
            rows={2}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-teal-500 transition-colors text-sm resize-none"
          />
        </div>

        {/* Navigation */}
        <div className="flex gap-3">
          {currentRoom > 0 && (
            <button
              onClick={() => setCurrentRoom((r) => r - 1)}
              className="flex-1 border border-slate-700 hover:border-slate-500 text-slate-300 font-medium py-2.5 rounded-xl transition-colors text-sm"
            >
              ← Previous
            </button>
          )}
          {currentRoom < ROOMS.length - 1 ? (
            <button
              onClick={() => setCurrentRoom((r) => r + 1)}
              className="flex-1 bg-teal-600 hover:bg-teal-500 text-white font-medium py-2.5 rounded-xl transition-colors text-sm"
            >
              Next Room →
            </button>
          ) : null}
        </div>
      </div>

      {/* Summary & submit */}
      {currentRoom === ROOMS.length - 1 && (
        <div className="space-y-4">
          {/* Overall rating */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <label className="block text-sm font-medium text-slate-300 mb-3">
              Overall property condition: <span className="text-teal-400">{overallRating}/5</span>
            </label>
            <input
              type="range"
              min={1}
              max={5}
              value={overallRating}
              onChange={(e) => setOverallRating(parseInt(e.target.value))}
              className="w-full accent-teal-500"
            />
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>Poor</span>
              <span>Excellent</span>
            </div>
          </div>

          {/* Progress summary */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="text-sm font-medium text-slate-300 mb-3">Inspection summary</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="text-slate-400">Total photos</div>
              <div className="text-slate-100 font-medium">{totalPhotos}</div>
              <div className="text-slate-400">GPS location</div>
              <div className={gps ? "text-green-400" : "text-yellow-500"}>{gps ? "Captured" : "Not available"}</div>
              <div className="text-slate-400">Rooms covered</div>
              <div className="text-slate-100 font-medium">
                {rooms.filter((r) => r.photos.length > 0).length} / {ROOMS.length}
              </div>
            </div>
          </div>

          {!allRoomsHavePhotos && (
            <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl px-4 py-3 text-sm text-amber-300">
              Tip: Add at least one photo per room for the strongest evidence.
            </div>
          )}

          <div className="bg-teal-900/20 border border-teal-500/30 rounded-xl px-4 py-3 text-sm text-teal-300">
            By submitting, you certify that you physically visited the property and this report accurately reflects its condition.
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting || totalPhotos === 0}
            className="w-full bg-teal-600 hover:bg-teal-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold py-4 rounded-xl transition-colors flex items-center justify-center gap-3"
          >
            {submitting ? (
              <>
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Uploading & signing on-chain…
              </>
            ) : (
              "Sign & Submit Inspection Report"
            )}
          </button>
        </div>
      )}
    </div>
  );
}
