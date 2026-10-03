import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { AttendanceConfiguration } from "@/lib/models/AttendanceConfiguration";
import { requireAdmin } from "@/lib/adminAuth";

export async function GET(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  try {
    await connectDB();
    let config = await AttendanceConfiguration.findOne({ eventId: "DEFAULT" }).lean();
    
    if (!config) {
      // Default initial config
      config = await AttendanceConfiguration.create({
        eventId: "DEFAULT",
        eventName: "PRODUCT DESIGN AND MARKET DRIVEN INNOVATION",
        days: [
          {
            day: 1,
            date: "2026-10-03",
            sessions: [
              { id: "DAY1-SESSION1", name: "Session 1", startTime: "09:00", endTime: "11:00" },
              { id: "DAY1-SESSION2", name: "Session 2", startTime: "11:30", endTime: "13:00" },
            ]
          },
          {
            day: 2,
            date: "2026-10-04",
            sessions: [
              { id: "DAY2-SESSION1", name: "Session 1", startTime: "09:00", endTime: "11:00" },
              { id: "DAY2-SESSION2", name: "Session 2", startTime: "11:30", endTime: "13:00" },
            ]
          }
        ]
      });
    }

    return NextResponse.json({ success: true, config });
  } catch (err) {
    console.error("[GET /api/admin/attendance/settings]", err);
    return NextResponse.json({ message: "Server error." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  try {
    const { days } = await request.json();
    if (!days || !Array.isArray(days) || days.length === 0) {
      return NextResponse.json({ message: "At least 1 day is required." }, { status: 400 });
    }

    // Validate sessions
    for (const d of days) {
      if (!d.sessions || d.sessions.length === 0) {
        return NextResponse.json({ message: `Day ${d.day} must have at least 1 session.` }, { status: 400 });
      }
      for (const s of d.sessions) {
        if (!s.name?.trim()) return NextResponse.json({ message: "All sessions must have a name." }, { status: 400 });
        if (s.startTime >= s.endTime) return NextResponse.json({ message: `Invalid time range for ${s.name}.` }, { status: 400 });
      }
    }

    await connectDB();
    const config = await AttendanceConfiguration.findOneAndUpdate(
      { eventId: "DEFAULT" },
      { days },
      { new: true, upsert: true }
    );

    return NextResponse.json({ success: true, config });
  } catch (err) {
    console.error("[POST /api/admin/attendance/settings]", err);
    return NextResponse.json({ message: "Server error." }, { status: 500 });
  }
}
