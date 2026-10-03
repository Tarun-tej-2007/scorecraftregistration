import mongoose, { Schema, Document } from "mongoose";

export interface IAttendance extends Document {
  registerNumber: string;
  sessionId: string; // e.g. "DAY1-SESSION1"
  day: number;
  session: string; // e.g. "Session 1"
  date: string; // YYYY-MM-DD
  status: "PRESENT";
  markedAt: Date;
  markedBy: string; // admin or method
  method: string;
  createdAt: Date;
  updatedAt: Date;
}

const AttendanceSchema = new Schema<IAttendance>(
  {
    registerNumber: { type: String, required: true, index: true },
    sessionId: { type: String, required: true, index: true },
    day: { type: Number, required: true },
    session: { type: String, required: true },
    date: { type: String, required: true },
    status: { type: String, required: true, enum: ["PRESENT"], default: "PRESENT" },
    markedAt: { type: Date, default: Date.now },
    markedBy: { type: String, required: true },
    method: { type: String, required: true },
  },
  { timestamps: true }
);

// Prevent duplicate attendance for the same registerNumber on the same session
AttendanceSchema.index({ registerNumber: 1, sessionId: 1 }, { unique: true });

export const Attendance =
  mongoose.models.Attendance || mongoose.model<IAttendance>("Attendance", AttendanceSchema);
