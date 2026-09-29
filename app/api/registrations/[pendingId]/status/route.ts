import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Registration } from "@/lib/models/Registration";

// ─────────────────────────────────────────────────────────
// GET /api/registrations/[pendingId]/status
//
// Returns current payment + registration status for the
// participant to check after submitting UTR.
// Uses MongoDB _id as pendingId.
// ─────────────────────────────────────────────────────────

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ pendingId: string }> }
) {
  try {
    await connectDB();

    const { pendingId } = await params;

    const reg = await Registration.findById(pendingId).select(
      "pendingReferenceId registrationId paymentStatus registrationStatus " +
      "verifiedAt rejectedAt rejectionReason name amount"
    );

    if (!reg) {
      return NextResponse.json({ message: "Registration not found." }, { status: 404 });
    }

    return NextResponse.json({
      pendingReferenceId: reg.pendingReferenceId,
      registrationId: reg.registrationId,
      paymentStatus: reg.paymentStatus,
      registrationStatus: reg.registrationStatus,
      verifiedAt: reg.verifiedAt,
      rejectedAt: reg.rejectedAt,
      rejectionReason: reg.rejectionReason,
      name: reg.name,
      amount: reg.amount,
    });
  } catch (err: unknown) {
    console.error("[GET /api/registrations/[pendingId]/status]", err);
    return NextResponse.json({ message: "Server error." }, { status: 500 });
  }
}
