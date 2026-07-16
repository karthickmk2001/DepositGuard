import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Lazy singleton — avoids throwing at module-eval time during Next.js static prerender
let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase env vars not set. Copy .env.local.example to .env.local and fill in your project URL and anon key."
    );
  }
  _client = createClient(url, key);
  return _client;
}

/**
 * Upload a photo to Supabase Storage and return the public URL.
 * Bucket: "depositguard-photos" — create this in your Supabase dashboard with public access.
 */
export async function uploadPhoto(file: File, path: string): Promise<string> {
  const supabase = getClient();
  const { data, error } = await supabase.storage
    .from("depositguard-photos")
    .upload(path, file, { upsert: true });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data: urlData } = supabase.storage
    .from("depositguard-photos")
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}

// ── Tenancy helpers — all calls go through /api/tenancies (server-side, service role key) ──

export async function createTenancy(tenancy: Record<string, unknown>) {
  const res = await fetch("/api/tenancies", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(tenancy),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to create tenancy");
  return data;
}

export async function getTenancy(id: string, wallet?: string) {
  const url = wallet
    ? `/api/tenancies/${id}?wallet=${encodeURIComponent(wallet)}`
    : `/api/tenancies/${id}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to fetch tenancy");
  return data;
}

export async function getTenanciesForWallet(wallet: string) {
  const res = await fetch(`/api/tenancies?wallet=${encodeURIComponent(wallet)}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to fetch tenancies");
  return data;
}

export async function updateTenancy(
  id: string,
  updates: Record<string, unknown>,
  wallet?: string
) {
  const res = await fetch(`/api/tenancies/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...updates, wallet }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to update tenancy");
  return data;
}
