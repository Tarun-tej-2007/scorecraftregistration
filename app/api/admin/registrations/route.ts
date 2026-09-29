import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Registration } from "@/lib/models/Registration";
import { requireAdmin } from "@/lib/adminAuth";

// ─────────────────────────────────────────────────────────
// GET /api/admin/registrations
//
// Returns all registrations. Protected by admin key.
// Does NOT return base64 screenshot data (too large for list).
// ─────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  try {
    await connectDB();

    const registrations = await Registration.find()
      .select("-screenshot") // exclude large base64 field from list
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ success: true, registrations });
  } catch (err) {
    console.error("[GET /api/admin/registrations]", err);
    return NextResponse.json({ message: "Server error." }, { status: 500 });
  }
}
