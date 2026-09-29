import { NextResponse } from "next/server";
import { setRegistration, type PendingRegistration } from "@/lib/registrationStore";

// ─────────────────────────────────────────────────────────
// POST /api/registrations
// Creates a PENDING_PAYMENT registration.
// Returns pendingId — NOT a confirmed registration ID.
// ─────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const required = ["name", "registerNo", "email", "phone", "department", "year"];
    const missing = required.filter((key) => !body?.[key]?.toString().trim());

    if (missing.length) {
      return NextResponse.json(
        { message: `Missing required fields: ${missing.join(", ")}` },
        { status: 400 }
      );
    }

    const pendingId = `PENDING-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 7)
      .toUpperCase()}`;

    const registration: PendingRegistration = {
      name: body.name.trim(),
      registerNo: body.registerNo.trim(),
      email: body.email.trim(),
      phone: body.phone.trim(),
      department: body.department,
      year: body.year,
      status: "PENDING_PAYMENT",
      amount: 250,
      registrationId: null,
      paymentId: null,
      razorpayOrderId: null,
      createdAt: Date.now(),
    };

    setRegistration(pendingId, registration);

    return NextResponse.json({
      success: true,
      pendingId,
      status: "PENDING_PAYMENT",
      message: "Registration created. Please complete payment to confirm your seat.",
    });
  } catch {
    return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
  }
}
