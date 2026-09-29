import { NextResponse } from "next/server";

// ─────────────────────────────────────────────────────────
// Admin authentication helper.
// Routes call requireAdmin(request) and return early if it
// returns a Response (meaning auth failed).
// ─────────────────────────────────────────────────────────

export function requireAdmin(request: Request): NextResponse | null {
  const adminSecret = process.env.ADMIN_SECRET;

  if (!adminSecret) {
    console.error("ADMIN_SECRET is not set in environment variables.");
    return NextResponse.json({ message: "Server configuration error." }, { status: 500 });
  }

  const key =
    request.headers.get("x-admin-key") ??
    request.headers.get("authorization")?.replace("Bearer ", "");

  if (!key || key !== adminSecret) {
    return NextResponse.json(
      { message: "Unauthorized. Invalid or missing admin key." },
      { status: 401 }
    );
  }

  return null; // auth passed
}
