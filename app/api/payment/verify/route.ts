import { NextResponse } from "next/server";
import crypto from "crypto";

// ─────────────────────────────────────────────────────────
// POST /api/payment/verify
//
// Demo mode:
//   Accepts { pendingId } — generates a demo paymentId and
//   final registrationId without any real transaction.
//
// Production:
//   Accepts { razorpay_order_id, razorpay_payment_id,
//             razorpay_signature, pendingId }
//   Verifies HMAC-SHA256 signature server-side.
//   NEVER trusts a client-side success flag.
//   Only marks PAID after cryptographic verification.
// ─────────────────────────────────────────────────────────

const PAYMENT_MODE = process.env.PAYMENT_MODE || "demo";

function makeRegistrationId(): string {
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `SC-2026-${suffix}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { pendingId } = body;

    if (!pendingId) {
      return NextResponse.json({ message: "Missing pendingId." }, { status: 400 });
    }

    // ── DEMO MODE ──
    if (PAYMENT_MODE === "demo") {
      const paymentId = `DEMO-PAY-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 7)
        .toUpperCase()}`;
      const registrationId = makeRegistrationId();

      return NextResponse.json({
        success: true,
        registrationId,
        paymentId,
        paymentStatus: "PAID",
        amount: 250,
        mode: "demo",
      });
    }

    // ── RAZORPAY PRODUCTION MODE ──
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { message: "Missing Razorpay verification data." },
        { status: 400 }
      );
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      return NextResponse.json(
        { message: "Payment gateway not configured." },
        { status: 503 }
      );
    }

    // Cryptographic signature verification — server side only
    const payload = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(payload)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      console.error("Razorpay signature mismatch for order:", razorpay_order_id);
      return NextResponse.json(
        {
          success: false,
          message: "Payment verification failed. Signature mismatch.",
        },
        { status: 400 }
      );
    }

    // Signature verified — generate final registration ID
    const registrationId = makeRegistrationId();

    return NextResponse.json({
      success: true,
      registrationId,
      paymentId: razorpay_payment_id,
      razorpayOrderId: razorpay_order_id,
      paymentStatus: "PAID",
      amount: 250,
      mode: "razorpay",
    });
  } catch {
    return NextResponse.json(
      { message: "Payment verification failed. Please contact support." },
      { status: 500 }
    );
  }
}
