import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Registration } from "@/lib/models/Registration";
import { Attendance } from "@/lib/models/Attendance";
import { requireAdmin } from "@/lib/adminAuth";

export async function POST(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  try {
    await connectDB();
    const { registerNumber, sessionId, session, date, method } = await request.json();

    if (!registerNumber) return NextResponse.json({ message: "Register number is required." }, { status: 400 });
    if (!sessionId || !session || !date) return NextResponse.json({ message: "Session details are required." }, { status: 400 });

    const cleanRegisterNo = registerNumber.trim().toUpperCase();

    // 1. Look up the existing participant using register number
    const participant = await Registration.findOne({ registerNo: cleanRegisterNo }).lean();

    if (!participant) {
      return NextResponse.json({ message: "PARTICIPANT NOT FOUND" }, { status: 404 });
    }

    if (participant.registrationStatus !== "CONFIRMED") {
      return NextResponse.json({ message: "REGISTRATION NOT CONFIRMED", participant }, { status: 400 });
    }

    // 2. Prevent duplicate attendance
    const existing = await Attendance.findOne({ registerNumber: cleanRegisterNo, sessionId });
    if (existing) {
      return NextResponse.json({ message: "ALREADY MARKED", participant, attendance: existing }, { status: 200 });
    }

    // 3. Mark attendance
    const attendance = await Attendance.create({
      registerNumber: cleanRegisterNo,
      sessionId,
      session,
      day: 1, // keeping day for legacy compat if needed, but session info is primary
      date,
      status: "PRESENT",
      markedBy: "ADMIN",
      method: method || "MANUAL",
    });

    return NextResponse.json({ message: "MARK PRESENT", success: true, participant, attendance }, { status: 200 });

  } catch (err: any) {
    console.error("[POST /api/admin/attendance/mark]", err);
    if (err.code === 11000) {
       return NextResponse.json({ message: "ALREADY MARKED" }, { status: 200 });
    }
    return NextResponse.json({ message: "Server error." }, { status: 500 });
  }
}
