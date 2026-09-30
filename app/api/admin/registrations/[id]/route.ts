import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Registration } from "@/lib/models/Registration";
import { requireAdmin } from "@/lib/adminAuth";

const ALLOWED_YEARS = ["3rd Year", "4th Year"];
const ALLOWED_DEPARTMENTS = ["CSE", "ECE", "EEE", "MECH", "CIVIL", "IT", "Other"];

// ─────────────────────────────────────────────────────────
// GET /api/admin/registrations/[id]
// Returns a single registration INCLUDING screenshot (base64).
// Used by the admin when clicking "View Screenshot".
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

// ─────────────────────────────────────────────────────────
// PUT /api/admin/registrations/[id]
// Admin edits a participant's details.
// Editable: name, registerNo, email, phone, department, year, utr.
// Payment/registration status changes must go through
// /verify or /reject endpoints to maintain audit integrity.
// ─────────────────────────────────────────────────────────
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  try {
    await connectDB();
    const { id } = await params;
    const body = await request.json();

    const { name, registerNo, email, phone, department, year, utr } = body;

    // ── Validation ────────────────────────────────────────
    if (!name?.trim())       return NextResponse.json({ message: "Full Name is required." },       { status: 400 });
    if (!registerNo?.trim()) return NextResponse.json({ message: "Register Number is required." }, { status: 400 });
    if (!email?.trim() || !email.includes("@"))
      return NextResponse.json({ message: "A valid email is required." }, { status: 400 });
    if (!department || !ALLOWED_DEPARTMENTS.includes(department))
      return NextResponse.json({ message: "Invalid department." }, { status: 400 });
    if (!year || !ALLOWED_YEARS.includes(year))
      return NextResponse.json({ message: "Only 3rd and 4th year students are eligible." }, { status: 400 });

    const updateData: Record<string, unknown> = {
      name:       name.trim(),
      registerNo: registerNo.trim().toUpperCase(),
      email:      email.trim().toLowerCase(),
      phone:      (phone ?? "").trim(),
      department,
      year,
    };

    // UTR is optional — only update if provided
    if (utr !== undefined && utr !== null) {
      const trimmedUtr = utr.toString().trim();
      if (trimmedUtr.length > 0 && trimmedUtr.length < 6)
        return NextResponse.json({ message: "UTR must be at least 6 characters." }, { status: 400 });
      if (trimmedUtr.length > 50)
        return NextResponse.json({ message: "UTR is too long." }, { status: 400 });
      updateData.utr = trimmedUtr || null;
    }

    const updated = await Registration.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    )
      .select("-screenshot")
      .lean();

    if (!updated) return NextResponse.json({ message: "Registration not found." }, { status: 404 });

    return NextResponse.json({
      success: true,
      registration: { ...updated, hasScreenshot: !!updated.screenshotName },
      message: "Participant updated successfully.",
    });
  } catch (err) {
    console.error("[PUT /api/admin/registrations/[id]]", err);
    return NextResponse.json({ message: "Server error." }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────
// DELETE /api/admin/registrations/[id]
// Permanently deletes a registration including its screenshot.
// (Screenshot stored as base64 in the document — deleted with it.)
// ─────────────────────────────────────────────────────────
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  try {
    await connectDB();
    const { id } = await params;

    const deleted = await Registration.findByIdAndDelete(id);
    if (!deleted) return NextResponse.json({ message: "Registration not found." }, { status: 404 });

    // Screenshot is stored as base64 inside the document — it's deleted automatically.
    // If you later move to cloud storage (S3/Cloudinary), delete the file here.

    console.log(`[DELETE /api/admin/registrations/[id]] Deleted: ${id} (${deleted.name})`);
    return NextResponse.json({ success: true, message: "Registration deleted successfully." });
  } catch (err) {
    console.error("[DELETE /api/admin/registrations/[id]]", err);
    return NextResponse.json({ message: "Server error." }, { status: 500 });
  }
}
