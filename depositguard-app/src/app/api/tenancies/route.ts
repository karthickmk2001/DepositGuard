import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase-server";

// GET /api/tenancies?wallet=<pubkey>
// Returns only tenancies where the wallet is landlord, tenant, or inspector
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!wallet) {
    return NextResponse.json({ error: "wallet query param required" }, { status: 400 });
  }

  const supabase = getServerClient();
  const { data, error } = await supabase
    .from("tenancies")
    .select("*")
    .or(`landlord.eq.${wallet},tenant.eq.${wallet},inspector.eq.${wallet}`)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST /api/tenancies
// Body: tenancy record (landlord field must be present)
export async function POST(req: NextRequest) {
  const body = await req.json();

  if (!body.landlord) {
    return NextResponse.json({ error: "landlord field required" }, { status: 400 });
  }

  const supabase = getServerClient();
  const { data, error } = await supabase
    .from("tenancies")
    .insert(body)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
