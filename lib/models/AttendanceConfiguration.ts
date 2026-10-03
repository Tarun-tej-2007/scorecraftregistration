import mongoose, { Schema, Document } from "mongoose";

export interface ISession {
  _id?: string;
  id: string; // e.g. "DAY1-SESSION1"
  name: string;
  startTime: string;
  endTime: string;
}

export interface IDayConfig {
  _id?: string;
  day: number;
  date: string;
  sessions: ISession[];
}

export interface IAttendanceConfiguration extends Document {
  eventId: string; // simple single event string, e.g. "DEFAULT"
  eventName: string;
  days: IDayConfig[];
  createdAt: Date;
  updatedAt: Date;
}

const SessionSchema = new Schema<ISession>({
  id: { type: String, required: true },
  name: { type: String, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
});

const DayConfigSchema = new Schema<IDayConfig>({
  day: { type: Number, required: true },
  date: { type: String, required: true },
  sessions: [SessionSchema],
});

const AttendanceConfigurationSchema = new Schema<IAttendanceConfiguration>(
  {
    eventId: { type: String, required: true, unique: true, default: "DEFAULT" },
    eventName: { type: String, default: "PRODUCT DESIGN AND MARKET DRIVEN INNOVATION" },
    days: [DayConfigSchema],
  },
  { timestamps: true }
);

export const AttendanceConfiguration =
  mongoose.models.AttendanceConfiguration || mongoose.model<IAttendanceConfiguration>("AttendanceConfiguration", AttendanceConfigurationSchema);
