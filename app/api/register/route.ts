import { NextResponse } from "next/server";

function makeRegistrationId() {
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `SC-2026-${suffix}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const required = ["name", "registerNo", "email", "phone", "department", "year"];
    const missing = required.filter((key) => !body?.[key]);

    if (missing.length) {
      return NextResponse.json(
        { message: `Missing fields: ${missing.join(", ")}` },
        { status: 400 }
      );
    }

    const registrationId = makeRegistrationId();

    // Demo mode:
    // This endpoint validates the form and returns a registration ID.
    // Replace this section with PostgreSQL/Prisma + Razorpay/Stripe in production.
    return NextResponse.json({
      success: true,
      registrationId,
      paymentStatus: "DEMO_PENDING",
      participant: {
        name: body.name,
        registerNo: body.registerNo,
        email: body.email,
        phone: body.phone,
        department: body.department,
        year: body.year,
      },
    });
  } catch {
    return NextResponse.json({ message: "Invalid request." }, { status: 400 });
  }
}
