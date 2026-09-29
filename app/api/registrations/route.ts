import { NextResponse } from "next/server";
import {
  setRegistration,
  isRegistrationOpen,
  getAvailableSeats,
  REGISTRATION_LIMIT,
  type PendingRegistration,
} from "@/lib/registrationStore";

// ─────────────────────────────────────────────────────────
// POST /api/registrations
//
// Creates a PENDING_PAYMENT registration.
// Returns pendingId — NOT a confirmed registration ID.
//
// Hard limit: REGISTRATION_LIMIT seats.
// Registrations are rejected once the limit is reached.
// ─────────────────────────────────────────────────────────

// Valid year values — must match the frontend dropdown
const ALLOWED_YEARS = ["3rd Year", "4th Year"];

export async function POST(request: Request) {
  try {
    // ── Seat cap check ──────────────────────────────────
    if (!isRegistrationOpen()) {
      return NextResponse.json(
        {
          message: `Registrations are now closed. All ${REGISTRATION_LIMIT} seats have been filled. Thank you for your interest!`,
          code: "SEATS_FULL",
          availableSeats: 0,
        },
        { status: 409 }
      );
    }

    const body = await request.json();

    // ── Required field validation ───────────────────────
    const required = ["name", "registerNo", "email", "phone", "department", "year"];
    const missing = required.filter((key) => !body?.[key]?.toString().trim());

    if (missing.length) {
      return NextResponse.json(
        { message: `Missing required fields: ${missing.join(", ")}` },
        { status: 400 }
      );
    }

    // ── Year validation ─────────────────────────────────
    if (!ALLOWED_YEARS.includes(body.year)) {
      return NextResponse.json(
        { message: "Only 3rd and 4th year students are eligible for this event." },
        { status: 400 }
      );
    }

    // ── Create pending registration ─────────────────────
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
      availableSeats: getAvailableSeats(),
      message: "Registration created. Please complete payment to confirm your seat.",
    });
  } catch {
    return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
  }
}
