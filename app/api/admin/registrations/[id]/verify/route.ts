import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Registration } from "@/lib/models/Registration";
import { requireAdmin } from "@/lib/adminAuth";

// ─────────────────────────────────────────────────────────
// POST /api/admin/registrations/[id]/verify
//
// Admin verifies the payment.
// Generates the final SC-2026-XXXXX registration ID.
// Protected by admin key.
// ─────────────────────────────────────────────────────────

function makeRegistrationId(): string {
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `SC-2026-${suffix}`;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  try {
    await connectDB();
    const { id } = await params;

    const reg = await Registration.findById(id);
    if (!reg) return NextResponse.json({ message: "Registration not found." }, { status: 404 });

    if (reg.registrationStatus === "CONFIRMED") {
      return NextResponse.json({ message: "Already confirmed.", registrationId: reg.registrationId });
    }
    if (reg.paymentStatus !== "SUBMITTED") {
      return NextResponse.json(
        { message: "Cannot verify — payment has not been submitted." },
        { status: 400 }
      );
    }

    const registrationId = makeRegistrationId();

    reg.registrationId = registrationId;
    reg.paymentStatus = "VERIFIED";
    reg.registrationStatus = "CONFIRMED";
    reg.verifiedAt = new Date();
    reg.verifiedBy = "admin";
    await reg.save();

    return NextResponse.json({
      success: true,
      registrationId,
      paymentStatus: "VERIFIED",
      registrationStatus: "CONFIRMED",
      verifiedAt: reg.verifiedAt,
    });
  } catch (err) {
    console.error("[POST /api/admin/registrations/[id]/verify]", err);
    return NextResponse.json({ message: "Server error." }, { status: 500 });
  }
}
