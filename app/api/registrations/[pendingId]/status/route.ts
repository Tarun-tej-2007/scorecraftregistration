import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Registration } from "@/lib/models/Registration";

// ─────────────────────────────────────────────────────────
// GET /api/registrations/[pendingId]/status
//
// Public endpoint — returns enough info for a participant to
// resume their own pending registration after a page refresh.
//
// Returns: all status fields + safe participant details.
// Does NOT return screenshot (large base64) or admin data.
// ─────────────────────────────────────────────────────────

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ pendingId: string }> }
) {
  try {
    await connectDB();

    const { pendingId } = await params;

    if (!pendingId || pendingId.length < 10) {
      return NextResponse.json({ message: "Invalid registration ID." }, { status: 400 });
    }

    const reg = await Registration.findById(pendingId).select(
      "pendingReferenceId registrationId " +
      "paymentStatus registrationStatus " +
      "verifiedAt rejectedAt rejectionReason " +
      "name registerNo email phone department year " +
      "amount utr screenshotName"
    );

    if (!reg) {
      return NextResponse.json({ message: "Registration not found." }, { status: 404 });
    }

    return NextResponse.json({
      // ── Identifiers ──
      pendingId:            (reg as unknown as { _id: { toString(): string } })._id.toString(),
      pendingReferenceId:   reg.pendingReferenceId,
      registrationId:       reg.registrationId,
      // ── Status (server is the authoritative source) ──
      paymentStatus:        reg.paymentStatus,
      registrationStatus:   reg.registrationStatus,
      // ── Admin verification dates ──
      verifiedAt:           reg.verifiedAt,
      rejectedAt:           reg.rejectedAt,
      rejectionReason:      reg.rejectionReason,
      // ── Participant info (needed to restore UI without re-filling the form) ──
      name:                 reg.name,
      registerNo:           reg.registerNo,
      email:                reg.email,
      phone:                reg.phone,
      department:           reg.department,
      year:                 reg.year,
      amount:               reg.amount,
      // ── Payment details (for submitted-state display) ──
      utr:                  reg.utr ?? null,
      screenshotUploaded:   !!reg.screenshotName,
    });
  } catch (err: unknown) {
    console.error("[GET /api/registrations/[pendingId]/status]", err);
    return NextResponse.json({ message: "Server error." }, { status: 500 });
  }
}
