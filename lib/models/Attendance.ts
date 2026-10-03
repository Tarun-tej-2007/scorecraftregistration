import mongoose, { Schema, Document } from "mongoose";

export interface IAttendance extends Document {
  registerNumber: string;
  date: string; // YYYY-MM-DD format
  day: number;
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
    date: { type: String, required: true },
    day: { type: Number, required: true },
    status: { type: String, required: true, enum: ["PRESENT"], default: "PRESENT" },
    markedAt: { type: Date, default: Date.now },
    markedBy: { type: String, required: true },
    method: { type: String, required: true },
  },
  { timestamps: true }
);

// Prevent duplicate attendance for the same registerNumber on the same date
AttendanceSchema.index({ registerNumber: 1, date: 1 }, { unique: true });

export const Attendance =
  mongoose.models.Attendance || mongoose.model<IAttendance>("Attendance", AttendanceSchema);
