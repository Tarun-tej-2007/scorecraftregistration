// Shared in-memory registration store.
// In production: replace with PostgreSQL / Prisma.

// ─────────────────────────────────────────────────────────
// Registration cap
// ─────────────────────────────────────────────────────────
export const REGISTRATION_LIMIT = 180;

export type PendingRegistration = {
  name: string;
  registerNo: string;
  email: string;
  phone: string;
  department: string;
  year: string;
  status: "PENDING_PAYMENT" | "SUBMITTED" | "PAID" | "PAYMENT_FAILED";
  amount: number;
  registrationId: string | null;
  paymentId: string | null;
  razorpayOrderId: string | null;
  createdAt: number;
};

const store = new Map<string, PendingRegistration>();

// ── Seat count ──────────────────────────────────────────
export function getRegistrationCount(): number {
  return store.size;
}

export function isRegistrationOpen(): boolean {
  return store.size < REGISTRATION_LIMIT;
}

export function getAvailableSeats(): number {
  return Math.max(0, REGISTRATION_LIMIT - store.size);
}

// ── CRUD ────────────────────────────────────────────────
export function getRegistration(id: string) {
  return store.get(id);
}

export function updateRegistration(
  id: string,
  updates: Partial<PendingRegistration>
) {
  const existing = store.get(id);
  if (existing) store.set(id, { ...existing, ...updates });
}

export function setRegistration(id: string, data: PendingRegistration) {
  store.set(id, data);
}
