import { NextResponse } from "next/server";

// ─────────────────────────────────────────────────────────
// POST /api/admin/auth
//
// Validates the admin password.
// Returns { valid: true } on success.
// The password is stored as ADMIN_SECRET in .env.local.
// ─────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const { password } = await request.json();
    const adminSecret = process.env.ADMIN_SECRET;

    if (!adminSecret) {
      return NextResponse.json({ message: "Admin not configured." }, { status: 500 });
    }

    if (!password || password !== adminSecret) {
      // Constant-time comparison would be better in production
      return NextResponse.json({ message: "Invalid password." }, { status: 401 });
    }

    return NextResponse.json({ valid: true });
  } catch {
    return NextResponse.json({ message: "Invalid request." }, { status: 400 });
  }
}
