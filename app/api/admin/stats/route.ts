import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Registration } from "@/lib/models/Registration";
import { requireAdmin } from "@/lib/adminAuth";

// ─────────────────────────────────────────────────────────
// GET /api/admin/stats
//
// Returns seat and payment statistics. Protected by admin key.
// ─────────────────────────────────────────────────────────

const REGISTRATION_LIMIT = 180;

export async function GET(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  try {
    await connectDB();

    const [total, pendingVerification, confirmed, rejected] = await Promise.all([
      Registration.countDocuments({ registrationStatus: { $ne: "REJECTED" } }),
      Registration.countDocuments({ registrationStatus: "PENDING_VERIFICATION" }),
      Registration.countDocuments({ registrationStatus: "CONFIRMED" }),
      Registration.countDocuments({ registrationStatus: "REJECTED" }),
    ]);

    return NextResponse.json({
      total,
      pendingVerification,
      confirmed,
      rejected,
      availableSeats: Math.max(0, REGISTRATION_LIMIT - total),
      limit: REGISTRATION_LIMIT,
      isFull: total >= REGISTRATION_LIMIT,
    });
  } catch (err) {
    console.error("[GET /api/admin/stats]", err);
    return NextResponse.json({ message: "Server error." }, { status: 500 });
  }
}
