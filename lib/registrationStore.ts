// Shared in-memory registration store.
// In production: replace with PostgreSQL / Prisma.

export type PendingRegistration = {
  name: string;
  registerNo: string;
  email: string;
  phone: string;
  department: string;
  year: string;
  status: "PENDING_PAYMENT" | "PAID" | "PAYMENT_FAILED";
  amount: number;
  registrationId: string | null;
  paymentId: string | null;
  razorpayOrderId: string | null;
  createdAt: number;
};

const store = new Map<string, PendingRegistration>();

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
