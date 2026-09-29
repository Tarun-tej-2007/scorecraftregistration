import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Registration } from "@/lib/models/Registration";
import { requireAdmin } from "@/lib/adminAuth";

// ─────────────────────────────────────────────────────────
// POST /api/admin/registrations/[id]/reject
//
// Admin rejects the payment.
// Protected by admin key.
// ─────────────────────────────────────────────────────────

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  try {
    await connectDB();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const reason = (body?.reason ?? "").toString().trim() || "Payment could not be verified.";

    const reg = await Registration.findById(id);
    if (!reg) return NextResponse.json({ message: "Registration not found." }, { status: 404 });

    if (reg.registrationStatus === "REJECTED") {
      return NextResponse.json({ message: "Already rejected." });
    }

    reg.paymentStatus = "REJECTED";
    reg.registrationStatus = "REJECTED";
    reg.rejectedAt = new Date();
    reg.rejectionReason = reason;
    await reg.save();

    return NextResponse.json({
      success: true,
      paymentStatus: "REJECTED",
      registrationStatus: "REJECTED",
      rejectionReason: reason,
      rejectedAt: reg.rejectedAt,
    });
  } catch (err) {
    console.error("[POST /api/admin/registrations/[id]/reject]", err);
    return NextResponse.json({ message: "Server error." }, { status: 500 });
  }
}
