import mongoose, { Schema, Document, Model } from "mongoose";

// ─────────────────────────────────────────────────────────
// Registration Model
// ─────────────────────────────────────────────────────────

export type PaymentStatus = "PENDING" | "SUBMITTED" | "VERIFIED" | "REJECTED";
export type RegistrationStatus =
  | "PENDING_PAYMENT"
  | "PENDING_VERIFICATION"
  | "CONFIRMED"
  | "REJECTED";

export interface IRegistration extends Document {
  // Reference IDs
  pendingReferenceId: string;
  registrationId: string | null; // SC-2026-XXXXX — set only after admin verification

  // Participant
  name: string;
  registerNo: string;
  email: string;
  phone: string;
  department: string;
  year: string;

  // Payment
  amount: number;
  paymentMethod: string;
  utr: string | null;
  screenshot: string | null;     // legacy base64 value for older records
  paymentScreenshotKey: string | null;
  screenshotName: string | null;

  // Status
  paymentStatus: PaymentStatus;
  registrationStatus: RegistrationStatus;

  // Admin actions
  verifiedBy: string | null;
  verifiedAt: Date | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;

  // Timestamps
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const RegistrationSchema = new Schema<IRegistration>(
  {
    pendingReferenceId: { type: String, required: true, unique: true, index: true },
    registrationId:     { type: String, default: null, sparse: true },

    name:         { type: String, required: true, trim: true },
    registerNo:   { type: String, required: true, trim: true },
    email:        { type: String, required: true, trim: true, lowercase: true },
    phone:        { type: String, required: true, trim: true },
    department:   { type: String, required: true },
    year:         { type: String, required: true, enum: ["3rd Year", "4th Year"] },

    amount:        { type: Number, default: 250 },
    paymentMethod: { type: String, default: "UPI_QR" },
    utr:           { type: String, default: null },
    screenshot:    { type: String, default: null },   // legacy base64 value
    paymentScreenshotKey: { type: String, default: null, index: true },
    screenshotName:{ type: String, default: null },

    paymentStatus: {
      type: String,
      enum: ["PENDING", "SUBMITTED", "VERIFIED", "REJECTED"],
      default: "PENDING",
    },
    registrationStatus: {
      type: String,
      enum: ["PENDING_PAYMENT", "PENDING_VERIFICATION", "CONFIRMED", "REJECTED"],
      default: "PENDING_PAYMENT",
    },

    verifiedBy:      { type: String, default: null },
    verifiedAt:      { type: Date,   default: null },
    rejectedAt:      { type: Date,   default: null },
    rejectionReason: { type: String, default: null },
    submittedAt:     { type: Date,   default: null },
  },
  {
    timestamps: true,   // adds createdAt + updatedAt automatically
    collection: "registrations",
  }
);

// Index for seat count queries
RegistrationSchema.index({ registrationStatus: 1 });
RegistrationSchema.index({ paymentStatus: 1 });
RegistrationSchema.index({ createdAt: -1 });

// Prevent model recompilation during HMR
export const Registration: Model<IRegistration> =
  mongoose.models.Registration ??
  mongoose.model<IRegistration>("Registration", RegistrationSchema);
