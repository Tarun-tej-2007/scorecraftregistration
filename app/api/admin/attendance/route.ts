import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Attendance } from "@/lib/models/Attendance";
import { Registration } from "@/lib/models/Registration";
import { requireAdmin } from "@/lib/adminAuth";

export async function GET(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  try {
    await connectDB();

    // Fetch all attendance records
    const attendanceRecords = await Attendance.find().sort({ markedAt: -1 }).lean();
    
    // Fetch all participants to join data
    const participants = await Registration.find({ registrationStatus: "CONFIRMED" })
      .select("name registerNo department year phone registrationId")
      .lean();

    const participantMap = new Map(participants.map(p => [p.registerNo, p]));

    const enrichedAttendance = attendanceRecords.map(record => {
      const p = participantMap.get(record.registerNumber);
      return {
        _id: record._id,
        registerNo: record.registerNumber,
        name: p?.name || "Unknown",
        department: p?.department || "—",
        year: p?.year || "—",
        phone: p?.phone || "—",
        registrationId: p?.registrationId || "—",
        date: record.date,
        day: record.day,
        session: record.session,
        sessionId: record.sessionId,
        status: record.status,
        markedAt: record.markedAt,
        method: record.method,
      };
    });

    return NextResponse.json({ success: true, attendance: enrichedAttendance, participants });

  } catch (err) {
    console.error("[GET /api/admin/attendance]", err);
    return NextResponse.json({ message: "Server error." }, { status: 500 });
  }
}
