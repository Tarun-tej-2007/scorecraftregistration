import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Registration } from "@/lib/models/Registration";

// ─────────────────────────────────────────────────────────
// POST /api/registrations
//
// Creates a PENDING_PAYMENT registration in MongoDB.
// Enforces the 200-seat hard cap.
// Returns pendingReferenceId — NOT a confirmed ID.
// ─────────────────────────────────────────────────────────

const REGISTRATION_LIMIT = 200;
const ALLOWED_YEARS = ["3rd Year", "4th Year"];

export async function POST(request: Request) {
  try {
    await connectDB();

    // ── Seat cap check (atomic count) ──────────────────
    const count = await Registration.countDocuments({
      registrationStatus: { $ne: "REJECTED" },
    });

    if (count >= REGISTRATION_LIMIT) {
      return NextResponse.json(
        {
          message: `Registrations are closed. All ${REGISTRATION_LIMIT} seats have been filled. Thank you for your interest!`,
          code: "SEATS_FULL",
          availableSeats: 0,
        },
        { status: 409 }
      );
    }

    const body = await request.json();

    // ── Required field validation ───────────────────────
    const required = ["name", "registerNo", "email", "phone", "department", "year"];
    const missing = required.filter((k) => !body?.[k]?.toString().trim());
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

    // ── Duplicate check (same registerNo) ──────────────
    const existing = await Registration.findOne({
      registerNo: body.registerNo.trim().toUpperCase(),
      registrationStatus: { $nin: ["REJECTED"] },
    });
    if (existing) {
      return NextResponse.json(
        { message: "A registration already exists for this Register Number.", code: "DUPLICATE" },
        { status: 409 }
      );
    }

    // ── Create registration ─────────────────────────────
    const pendingReferenceId = `SC-PENDING-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 5)
      .toUpperCase()}`;

    const registration = await Registration.create({
      pendingReferenceId,
      name: body.name.trim(),
      registerNo: body.registerNo.trim().toUpperCase(),
      email: body.email.trim().toLowerCase(),
      phone: body.phone.trim(),
      department: body.department,
      year: body.year,
      amount: 250,
      paymentMethod: "UPI_QR",
      paymentStatus: "PENDING",
      registrationStatus: "PENDING_PAYMENT",
    });

    return NextResponse.json({
      success: true,
      pendingId: registration._id.toString(),
      pendingReferenceId: registration.pendingReferenceId,
      availableSeats: REGISTRATION_LIMIT - count - 1,
    });
  } catch (err: unknown) {
    console.error("[POST /api/registrations]", err);
    return NextResponse.json({ message: "Server error. Please try again." }, { status: 500 });
  }
}
