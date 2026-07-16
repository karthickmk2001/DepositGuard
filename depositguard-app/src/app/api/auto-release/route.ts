import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase-server";

const AUTO_RELEASE_DAYS = 14;

/**
 * GET /api/auto-release?tenancy_id=<id>
 *
 * Checks if a tenancy is eligible for auto-release (landlord unresponsive
 * for 14 days after lease end). Returns eligibility status.
 *
 * POST /api/auto-release
 * Body: { tenancy_id, wallet }
 *
 * Tenant triggers auto-release if eligible. Updates status to AutoReleased.
 */
export async function GET(req: NextRequest) {
  const tenancyId = req.nextUrl.searchParams.get("tenancy_id");
  if (!tenancyId) {
    return NextResponse.json({ error: "tenancy_id required" }, { status: 400 });
  }

  const supabase = getServerClient();
  const { data: tenancy, error } = await supabase
    .from("tenancies")
    .select("*")
    .eq("id", tenancyId)
    .single();

  if (error || !tenancy) {
    return NextResponse.json({ error: "Tenancy not found" }, { status: 404 });
  }

  // Only Active tenancies can be auto-released
  if (tenancy.status !== "Active") {
    return NextResponse.json({
      eligible: false,
      reason: `Status is ${tenancy.status}, not Active`,
    });
  }

  const leaseEnd = new Date(tenancy.lease_end);
  const now = new Date();
  const daysSinceLeaseEnd = Math.floor(
    (now.getTime() - leaseEnd.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceLeaseEnd < AUTO_RELEASE_DAYS) {
    const daysRemaining = AUTO_RELEASE_DAYS - daysSinceLeaseEnd;
    return NextResponse.json({
      eligible: false,
      reason:
        daysSinceLeaseEnd < 0
          ? "Lease has not ended yet"
          : `${daysRemaining} day(s) remaining before auto-release`,
      days_since_lease_end: daysSinceLeaseEnd,
      days_remaining: Math.max(0, daysRemaining),
    });
  }

  return NextResponse.json({
    eligible: true,
    days_since_lease_end: daysSinceLeaseEnd,
    message: "Landlord has not responded within 14 days. Tenant can claim full deposit.",
  });
}

export async function POST(req: NextRequest) {
  const { tenancy_id, wallet } = await req.json();

  if (!tenancy_id || !wallet) {
    return NextResponse.json(
      { error: "tenancy_id and wallet required" },
      { status: 400 }
    );
  }

  const supabase = getServerClient();
  const { data: tenancy, error: fetchError } = await supabase
    .from("tenancies")
    .select("*")
    .eq("id", tenancy_id)
    .single();

  if (fetchError || !tenancy) {
    return NextResponse.json({ error: "Tenancy not found" }, { status: 404 });
  }

  // Only the tenant can trigger auto-release
  if (tenancy.tenant !== wallet) {
    return NextResponse.json({ error: "Only the tenant can trigger auto-release" }, { status: 403 });
  }

  if (tenancy.status !== "Active") {
    return NextResponse.json({ error: "Tenancy is not Active" }, { status: 400 });
  }

  const leaseEnd = new Date(tenancy.lease_end);
  const now = new Date();
  const daysSinceLeaseEnd = Math.floor(
    (now.getTime() - leaseEnd.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceLeaseEnd < AUTO_RELEASE_DAYS) {
    return NextResponse.json({ error: "14-day window has not passed yet" }, { status: 400 });
  }

  // Auto-release: full deposit back to tenant
  const { data, error: updateError } = await supabase
    .from("tenancies")
    .update({
      status: "AutoReleased",
      proposed_landlord_amt: 0,
      proposed_tenant_amt: tenancy.deposit_amount,
      landlord_agreed: false,
      tenant_agreed: true,
    })
    .eq("id", tenancy_id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: "Deposit auto-released to tenant",
    tenancy: data,
  });
}
