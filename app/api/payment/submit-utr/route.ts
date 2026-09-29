import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Registration } from "@/lib/models/Registration";

// ─────────────────────────────────────────────────────────
// POST /api/payment/submit-utr
//
// Records UTR + payment screenshot in MongoDB.
// Changes status: PENDING_PAYMENT → PENDING_VERIFICATION
// Does NOT confirm the registration.
// Admin must verify independently.
// ─────────────────────────────────────────────────────────

const UTR_MIN = 6;
const UTR_MAX = 50;

export async function POST(request: Request) {
  try {
    await connectDB();

    const body = await request.json();
    const { pendingId, utr, screenshot, screenshotName } = body;

    if (!pendingId) {
      return NextResponse.json({ message: "Missing registration reference." }, { status: 400 });
    }

    // ── UTR validation ──────────────────────────────────
    const trimmedUtr = (utr ?? "").toString().trim();
    if (!trimmedUtr) {
      return NextResponse.json({ message: "UTR / Transaction ID is required." }, { status: 400 });
    }
    if (trimmedUtr.length < UTR_MIN || trimmedUtr.length > UTR_MAX) {
      return NextResponse.json(
        { message: `UTR must be ${UTR_MIN}–${UTR_MAX} characters.` },
        { status: 400 }
      );
    }
    if (/<|>|script/i.test(trimmedUtr)) {
      return NextResponse.json({ message: "Invalid characters in UTR." }, { status: 400 });
    }

    if (!screenshot || typeof screenshot !== "string" || !screenshot.trim()) {
      return NextResponse.json({ message: "Payment screenshot is required." }, { status: 400 });
    }

    // ── Find registration ───────────────────────────────
    const reg = await Registration.findById(pendingId);
    if (!reg) {
      return NextResponse.json({ message: "Registration not found." }, { status: 404 });
    }

    if (reg.registrationStatus === "CONFIRMED") {
      return NextResponse.json({ message: "This registration is already confirmed." }, { status: 409 });
    }
    if (reg.paymentStatus === "SUBMITTED" || reg.paymentStatus === "VERIFIED") {
      return NextResponse.json(
        { message: "Payment details have already been submitted for this registration." },
        { status: 409 }
      );
    }

    // ── Update registration ─────────────────────────────
    reg.utr = trimmedUtr;
    reg.screenshot = screenshot;
    reg.screenshotName = screenshotName ?? null;
    reg.paymentStatus = "SUBMITTED";
    reg.registrationStatus = "PENDING_VERIFICATION";
    reg.submittedAt = new Date();
    await reg.save();

    return NextResponse.json({
      success: true,
      pendingReferenceId: reg.pendingReferenceId,
      utr: trimmedUtr,
      paymentStatus: "SUBMITTED",
      registrationStatus: "PENDING_VERIFICATION",
      amount: reg.amount,
      message: "Payment details submitted. Pending verification by organisers.",
    });
  } catch (err: unknown) {
    console.error("[POST /api/payment/submit-utr]", err);
    return NextResponse.json({ message: "Server error. Please try again." }, { status: 500 });
  }
}
