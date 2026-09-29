import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Registration } from "@/lib/models/Registration";
import { requireAdmin } from "@/lib/adminAuth";

// ─────────────────────────────────────────────────────────
// GET /api/admin/registrations/[id]
//
// Returns a single registration including screenshot.
// Protected by admin key.
// ─────────────────────────────────────────────────────────

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  try {
    await connectDB();
    const { id } = await params;
    const reg = await Registration.findById(id).lean();
    if (!reg) return NextResponse.json({ message: "Not found." }, { status: 404 });
    return NextResponse.json({ success: true, registration: reg });
  } catch (err) {
    console.error("[GET /api/admin/registrations/[id]]", err);
    return NextResponse.json({ message: "Server error." }, { status: 500 });
  }
}
