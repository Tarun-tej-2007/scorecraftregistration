import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Registration } from "@/lib/models/Registration";
import { requireAdmin } from "@/lib/adminAuth";

export async function POST(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  try {
    await connectDB();
    const { decodedValue } = await request.json();

    if (!decodedValue) {
      return NextResponse.json({ message: "No value provided to resolve." }, { status: 400 });
    }

    const cleanValue = decodedValue.trim().toUpperCase();

    // 1. Direct match on Register Number
    let participant = await Registration.findOne({ registerNo: cleanValue }).lean();

    // 2. Try match on SCORECRAFT registration ID
    if (!participant) {
      participant = await Registration.findOne({ registrationId: cleanValue }).lean();
    }

    // 3. Fallback: try to extract a register number pattern (e.g. 99...) from a longer string or URL
    if (!participant) {
      const regMatch = cleanValue.match(/\b(99\d{9}|23\d{8})\b/i); // Adjust regex based on college register number formats
      if (regMatch) {
         participant = await Registration.findOne({ registerNo: regMatch[0] }).lean();
      }
    }

    if (!participant) {
      return NextResponse.json({ message: "PARTICIPANT NOT FOUND", decodedValue: cleanValue }, { status: 404 });
    }

    if (participant.registrationStatus !== "CONFIRMED") {
      return NextResponse.json({ message: "REGISTRATION NOT CONFIRMED", participant }, { status: 400 });
    }

    return NextResponse.json({ success: true, participant, resolvedRegisterNumber: participant.registerNo }, { status: 200 });

  } catch (err: any) {
    console.error("[POST /api/admin/attendance/resolve]", err);
    return NextResponse.json({ message: "Server error." }, { status: 500 });
  }
}
