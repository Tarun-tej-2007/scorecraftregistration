import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Registration } from "@/lib/models/Registration";

const REGISTRATION_LIMIT = 200;
const ALLOWED_YEARS = ["3rd Year", "4th Year"];

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const required = ["name", "registerNo", "email", "phone", "department", "year"];
    const missing = required.filter((k) => !body?.[k]?.toString().trim());
    if (missing.length) {
      return NextResponse.json({ message: `Missing required fields: ${missing.join(", ")}` }, { status: 400 });
    }

    if (!ALLOWED_YEARS.includes(body.year)) {
      return NextResponse.json({ message: "Only 3rd and 4th year students are eligible." }, { status: 400 });
    }

    console.log("[/api/registrations] MONGODB_URI defined:", !!process.env.MONGODB_URI);
    await connectDB();
    console.log("[/api/registrations] DB connected successfully.");

    const count = await Registration.countDocuments({
      registrationStatus: { $ne: "REJECTED" },
    });

    if (count >= REGISTRATION_LIMIT) {
      return NextResponse.json(
        { message: `Registrations are closed. All ${REGISTRATION_LIMIT} seats have been filled.`, code: "SEATS_FULL", availableSeats: 0 },
        { status: 409 }
      );
    }

    const existing = await Registration.findOne({
      registerNo: body.registerNo.trim().toUpperCase(),
      registrationStatus: { $nin: ["REJECTED"] },
    });
    if (existing) {
      return NextResponse.json(
        { message: "A registration already exists for this Register Number.", code: "DUPLICATE", existingId: existing._id.toString() },
        { status: 409 }
      );
    }

    const pendingReferenceId = `SC-PENDING-${Date.now()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

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

    console.log("[/api/registrations] Created registration:", registration._id.toString());

    return NextResponse.json({
      success: true,
      pendingId: registration._id.toString(),
      pendingReferenceId: registration.pendingReferenceId,
      availableSeats: REGISTRATION_LIMIT - count - 1,
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const stack   = err instanceof Error ? err.stack   : "";
    console.error("[POST /api/registrations] ERROR:", message);
    console.error("[POST /api/registrations] STACK:", stack);
    const isDatabaseConfigurationError =
      message.includes("MONGODB_URI") ||
      message.includes("connection string") ||
      message.includes("URI option");

    return NextResponse.json(
      {
        message: isDatabaseConfigurationError
          ? "Registration service is temporarily unavailable. Please contact the organizer."
          : "Server error.",
      },
      { status: isDatabaseConfigurationError ? 503 : 500 }
    );
  }
}
