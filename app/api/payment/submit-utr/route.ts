import { NextResponse } from "next/server";

// ─────────────────────────────────────────────────────────
// POST /api/payment/submit-utr
//
// Records the UTR / Transaction ID submitted by the participant.
// Does NOT confirm the registration.
// Returns status: PENDING_VERIFICATION.
//
// An admin must independently verify the payment before
// the registration status changes to CONFIRMED.
// ─────────────────────────────────────────────────────────

const UTR_MIN = 6;
const UTR_MAX = 50;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { pendingId, utr } = body;

    if (!pendingId) {
      return NextResponse.json({ message: "Missing registration reference." }, { status: 400 });
    }

    const trimmedUtr = (utr ?? "").toString().trim();

    if (!trimmedUtr) {
      return NextResponse.json(
        { message: "UTR / Transaction ID is required." },
        { status: 400 }
      );
    }

    if (trimmedUtr.length < UTR_MIN || trimmedUtr.length > UTR_MAX) {
      return NextResponse.json(
        { message: `UTR / Transaction ID must be between ${UTR_MIN} and ${UTR_MAX} characters.` },
        { status: 400 }
      );
    }

    // Sanitise: reject obvious injection
    if (/<|>|script/i.test(trimmedUtr)) {
      return NextResponse.json(
        { message: "Invalid characters in UTR / Transaction ID." },
        { status: 400 }
      );
    }

    // Generate a temporary pending reference (NOT the final registration ID).
    // The final SC-2026-XXXXX is generated only after admin verification.
    const pendingReferenceId = `SC-PENDING-${Math.random()
      .toString(36)
      .slice(2, 7)
      .toUpperCase()}`;

    // In production: persist to database here.
    // e.g. updateRegistration(pendingId, { utr: trimmedUtr, paymentStatus: "SUBMITTED" })

    return NextResponse.json({
      success: true,
      pendingReferenceId,
      utr: trimmedUtr,
      paymentStatus: "SUBMITTED",
      registrationStatus: "PENDING_VERIFICATION",
      amount: 250,
      paymentMethod: "UPI_QR",
      message: "Payment details submitted. Pending verification by event organisers.",
    });
  } catch {
    return NextResponse.json(
      { message: "Failed to submit payment details. Please try again." },
      { status: 500 }
    );
  }
}
