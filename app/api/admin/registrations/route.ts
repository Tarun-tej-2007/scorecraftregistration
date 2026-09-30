import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Registration } from "@/lib/models/Registration";
import { requireAdmin } from "@/lib/adminAuth";

// ─────────────────────────────────────────────────────────
// GET /api/admin/registrations
// Returns all registrations WITHOUT the base64 screenshot.
// Adds `hasScreenshot` boolean flag computed from screenshotName.
// ─────────────────────────────────────────────────────────
export async function GET(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  try {
    await connectDB();

    const registrations = await Registration.find()
      .select("-screenshot") // exclude large base64 field
      .sort({ createdAt: -1 })
      .lean();

    // `screenshotName` is set iff a screenshot was uploaded — use as a safe proxy
    const result = registrations.map((r) => ({
      ...r,
      hasScreenshot: !!r.screenshotName,
    }));

    return NextResponse.json({ success: true, registrations: result });
  } catch (err) {
    console.error("[GET /api/admin/registrations]", err);
    return NextResponse.json({ message: "Server error." }, { status: 500 });
  }
}
