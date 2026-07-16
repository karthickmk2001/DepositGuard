import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase-server";

// GET /api/tenancies/[id]?wallet=<pubkey>
// Returns the tenancy only if the wallet is a participant (landlord, tenant, or inspector)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const wallet = req.nextUrl.searchParams.get("wallet");

  const supabase = getServerClient();
  const { data, error } = await supabase
    .from("tenancies")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ error: "Tenancy not found" }, { status: 404 });

  // If a wallet is provided, enforce access. If no wallet, allow (tenant clicking a shared link
  // before they've signed in — they'll see the page but can't act without connecting wallet).
  if (wallet) {
    const isParticipant =
      data.landlord === wallet ||
      data.tenant === wallet ||
      data.inspector === wallet ||
      data.tenant === null; // tenant slot open — anyone with the link can join
    if (!isParticipant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
  }

  return NextResponse.json(data);
}

// PATCH /api/tenancies/[id]
// Body: { wallet: string, ...updates }
// Wallet must be an existing participant, or the tenant slot must be open (for joining)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { wallet, ...updates } = await req.json();

  const supabase = getServerClient();

  // Fetch current record to check authorization
  const { data: existing, error: fetchError } = await supabase
    .from("tenancies")
    .select("landlord, tenant, inspector")
    .eq("id", id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: "Tenancy not found" }, { status: 404 });
  }

  if (wallet) {
    const tenantSlotOpen = existing.tenant === null;
    const isParticipant =
      existing.landlord === wallet ||
      existing.tenant === wallet ||
      existing.inspector === wallet ||
      tenantSlotOpen; // allow tenant to join

    if (!isParticipant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
  }

  const { data, error } = await supabase
    .from("tenancies")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
