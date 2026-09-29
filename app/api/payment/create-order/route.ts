import { NextResponse } from "next/server";

// ─────────────────────────────────────────────────────────
// POST /api/payment/create-order
//
// Demo mode  (PAYMENT_MODE=demo):
//   Returns a fake orderId — no real charge.
//
// Production (PAYMENT_MODE=razorpay):
//   Calls Razorpay REST API to create a real order.
//   Requires RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.
// ─────────────────────────────────────────────────────────

const PAYMENT_MODE = process.env.PAYMENT_MODE || "demo";
const AMOUNT_PAISE = 25000; // ₹250 × 100

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { pendingId } = body;

    if (!pendingId) {
      return NextResponse.json({ message: "Missing pendingId." }, { status: 400 });
    }

    // ── DEMO MODE ──
    if (PAYMENT_MODE === "demo") {
      const orderId = `DEMO-ORDER-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 7)
        .toUpperCase()}`;

      return NextResponse.json({
        orderId,
        amount: AMOUNT_PAISE,
        currency: "INR",
        mode: "demo",
      });
    }

    // ── RAZORPAY PRODUCTION MODE ──
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return NextResponse.json(
        { message: "Payment gateway not configured. Contact the organisers." },
        { status: 503 }
      );
    }

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

    const rzpResponse = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        amount: AMOUNT_PAISE,
        currency: "INR",
        receipt: pendingId,
        notes: {
          event: "PRODUCT DESIGN AND MARKET DRIVEN INNOVATION",
          organiser: "SCORECRAFT",
        },
      }),
    });

    if (!rzpResponse.ok) {
      const err = await rzpResponse.json().catch(() => ({}));
      console.error("Razorpay order creation failed:", err);
      return NextResponse.json(
        { message: "Failed to create payment order. Please try again." },
        { status: 500 }
      );
    }

    const order = await rzpResponse.json();

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      mode: "razorpay",
    });
  } catch {
    return NextResponse.json(
      { message: "Failed to create payment order." },
      { status: 500 }
    );
  }
}
