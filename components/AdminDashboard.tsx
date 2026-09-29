 "use client";

import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Download, Search, ShieldCheck, X, XCircle } from "lucide-react";
import Link from "next/link";

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

type PaymentStatus = "SUBMITTED" | "VERIFIED" | "REJECTED" | "PENDING";
type RegistrationStatus = "PENDING_VERIFICATION" | "CONFIRMED" | "REJECTED" | "PENDING_PAYMENT";

type Registration = {
  pendingReferenceId?: string;
  registrationId?: string | null;
  name: string;
  registerNo: string;
  email: string;
  phone: string;
  department: string;
  year: string;
  amount?: number;
  paymentMethod?: string;
  utr?: string;
  screenshot?: string | null;      // base64 data URL
  screenshotName?: string | null;
  paymentStatus?: PaymentStatus;
  registrationStatus?: RegistrationStatus;
  submittedAt?: string;
  verifiedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
};

type ModalState =
  | { type: "verify"; reg: Registration }
  | { type: "reject"; reg: Registration }
  | null;

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

function makeRegistrationId() {
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `SC-2026-${suffix}`;
}

const PAYMENT_STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  SUBMITTED:  { label: "SUBMITTED",        cls: "pill-pending" },
  VERIFIED:   { label: "VERIFIED",          cls: "pill-paid" },
  REJECTED:   { label: "REJECTED",          cls: "pill-failed" },
  PENDING:    { label: "PENDING PAYMENT",   cls: "pill-muted" },
};

const REG_STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  PENDING_VERIFICATION: { label: "PENDING VERIFICATION", cls: "pill-pending" },
  CONFIRMED:            { label: "CONFIRMED",              cls: "pill-paid" },
  REJECTED:             { label: "REJECTED",               cls: "pill-failed" },
  PENDING_PAYMENT:      { label: "PENDING PAYMENT",        cls: "pill-muted" },
};

// ─────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<ModalState>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionMsg, setActionMsg] = useState("");

  useEffect(() => {
    loadFromStorage();
  }, []);

  function loadFromStorage() {
    try {
      const raw = window.localStorage.getItem("scorecraft-registration");
      if (raw) {
        const parsed = JSON.parse(raw) as Registration;
        // Back-fill defaults for records saved before payment flow
        if (!parsed.paymentStatus) parsed.paymentStatus = "PENDING";
        if (!parsed.registrationStatus) parsed.registrationStatus = "PENDING_PAYMENT";
        setRegistration(parsed);
      }
    } catch {
      // ignore corrupt localStorage
    }
  }

  // ── Verify payment ──
  function handleVerify() {
    if (!registration) return;
    const registrationId = makeRegistrationId();
    const now = new Date().toISOString();

    const updated: Registration = {
      ...registration,
      registrationId,
      paymentStatus: "VERIFIED",
      registrationStatus: "CONFIRMED",
      verifiedAt: now,
    };
    window.localStorage.setItem("scorecraft-registration", JSON.stringify(updated));
    setRegistration(updated);
    setModal(null);
    setActionMsg(`✓ Payment verified. Registration ID: ${registrationId}`);
  }

  // ── Reject payment ──
  function handleReject() {
    if (!registration) return;
    const now = new Date().toISOString();

    const updated: Registration = {
      ...registration,
      paymentStatus: "REJECTED",
      registrationStatus: "REJECTED",
      rejectedAt: now,
      rejectionReason: rejectReason.trim() || "Payment could not be verified.",
    };
    window.localStorage.setItem("scorecraft-registration", JSON.stringify(updated));
    setRegistration(updated);
    setModal(null);
    setRejectReason("");
    setActionMsg("✗ Payment rejected.");
  }

  function exportCsv() {
    if (!registration) return;
    const fields: (keyof Registration)[] = [
      "pendingReferenceId", "registrationId", "name", "registerNo", "email", "phone",
      "department", "year", "amount", "paymentMethod", "utr",
      "paymentStatus", "registrationStatus", "submittedAt", "verifiedAt",
    ];
    const header = fields.join(",");
    const row = fields.map((k) => JSON.stringify(registration[k] ?? "")).join(",");
    const blob = new Blob([header + "\n" + row], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "scorecraft-registrations.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const matches = registration && Object.values(registration).some((v) =>
    String(v ?? "").toLowerCase().includes(query.toLowerCase())
  );

  const isUpiSubmitted =
    registration?.paymentStatus === "SUBMITTED" &&
    registration?.registrationStatus === "PENDING_VERIFICATION";

  const pStatus = registration?.paymentStatus
    ? (PAYMENT_STATUS_CONFIG[registration.paymentStatus] ?? { label: registration.paymentStatus, cls: "pill-muted" })
    : null;

  const rStatus = registration?.registrationStatus
    ? (REG_STATUS_CONFIG[registration.registrationStatus] ?? { label: registration.registrationStatus, cls: "pill-muted" })
    : null;

  return (
    <main className="admin-page">
      {/* ── Verify Modal ── */}
      {modal?.type === "verify" && (
        <div className="admin-modal-overlay" role="dialog" aria-modal="true">
          <div className="admin-modal">
            <button className="modal-close" onClick={() => setModal(null)} aria-label="Close"><X size={18} /></button>
            <div className="modal-icon modal-icon-verify"><CheckCircle2 size={34} /></div>
            <h2 className="modal-title">VERIFY PAYMENT</h2>
            <p className="modal-subtitle">Confirm that you have checked this payment in your UPI dashboard.</p>

            <div className="modal-detail-grid">
              <span>Participant</span>   <b>{modal.reg.name}</b>
              <span>Register No.</span> <b>{modal.reg.registerNo}</b>
              <span>Amount</span>        <b>₹250/-</b>
              <span>UTR / Txn ID</span> <b className="modal-utr">{modal.reg.utr ?? "—"}</b>
              <span>Payment Method</span><b>UPI QR</b>
            </div>

            <p className="modal-question">Have you verified this ₹250 payment in your UPI account?</p>

            <div className="modal-actions">
              <button className="secondary-button" onClick={() => setModal(null)}>CANCEL</button>
              <button className="primary-button modal-verify-btn" onClick={handleVerify} id="btn-confirm-verify">
                <CheckCircle2 size={16} /> VERIFY &amp; CONFIRM REGISTRATION
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reject Modal ── */}
      {modal?.type === "reject" && (
        <div className="admin-modal-overlay" role="dialog" aria-modal="true">
          <div className="admin-modal">
            <button className="modal-close" onClick={() => setModal(null)} aria-label="Close"><X size={18} /></button>
            <div className="modal-icon modal-icon-reject"><XCircle size={34} /></div>
            <h2 className="modal-title">REJECT PAYMENT</h2>
            <p className="modal-subtitle">This will mark the registration as rejected.</p>

            <div className="modal-detail-grid">
              <span>Participant</span>   <b>{modal.reg.name}</b>
              <span>UTR / Txn ID</span> <b className="modal-utr">{modal.reg.utr ?? "—"}</b>
            </div>

            <label className="reject-reason-label">
              Reason (optional)
              <textarea
                className="reject-reason-input"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. UTR not found in payment records."
                rows={3}
              />
            </label>

            <div className="modal-actions">
              <button className="secondary-button" onClick={() => { setModal(null); setRejectReason(""); }}>CANCEL</button>
              <button className="primary-button modal-reject-btn" onClick={handleReject} id="btn-confirm-reject">
                <XCircle size={16} /> REJECT PAYMENT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Top bar ── */}
      <div className="admin-top">
        <Link href="/" className="back-link"><ArrowLeft size={18} /> Back to event</Link>
        <div className="admin-brand"><ShieldCheck size={20} /> SCORECRAFT ADMIN</div>
      </div>

      <div className="admin-shell">
        <div className="admin-heading">
          <div>
            <span className="brush-label">CONTROL DESK</span>
            <h1>Registrations</h1>
            <p>Demo admin. Production should use a real database + admin auth.</p>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button className="secondary-button" onClick={loadFromStorage}>↻ Refresh</button>
            <button className="primary-button" onClick={exportCsv}><Download size={18} /> Export CSV</button>
          </div>
        </div>

        {/* Action message */}
        {actionMsg && (
          <div className={`admin-action-msg ${actionMsg.startsWith("✓") ? "msg-success" : "msg-error"}`}>
            {actionMsg}
            <button className="msg-close" onClick={() => setActionMsg("")}><X size={14} /></button>
          </div>
        )}

        {/* Stats */}
        <div className="stats">
          <div><span>REGISTERED</span><strong>{registration ? 1 : 0}</strong></div>
          <div><span>PENDING VERIFICATION</span><strong>{isUpiSubmitted ? 1 : 0}</strong></div>
          <div><span>CONFIRMED</span><strong>{registration?.registrationStatus === "CONFIRMED" ? 1 : 0}</strong></div>
        </div>

        {/* Payment Verification section */}
        {isUpiSubmitted && (
          <div className="admin-verify-card">
            <div className="verify-card-header">
              <span className="brush-label">PAYMENT VERIFICATION REQUIRED</span>
              <span className="pending-pill">1 PENDING</span>
            </div>
            <p className="verify-card-desc">
              Check the UTR / Transaction ID in your UPI dashboard (PhonePe Business / Google Pay Business / Bank Statement).
              Verify the payment is from the correct participant before approving.
            </p>

            <div className="verify-detail-table">
              <div className="vdt-row"><span>Participant</span><b>{registration?.name}</b></div>
              <div className="vdt-row"><span>Register No.</span><b>{registration?.registerNo}</b></div>
              <div className="vdt-row"><span>Department</span><b>{registration?.department}</b></div>
              <div className="vdt-row"><span>Amount</span><b>₹{registration?.amount ?? 250}/-</b></div>
              <div className="vdt-row"><span>UTR / Txn ID</span><b className="utr-highlight">{registration?.utr ?? "—"}</b></div>
              <div className="vdt-row"><span>Submitted At</span><b>{registration?.submittedAt ? new Date(registration.submittedAt).toLocaleString() : "—"}</b></div>
            </div>

            {/* Screenshot preview in verify card */}
            {registration?.screenshot && (
              <div className="admin-screenshot-wrap">
                <p className="admin-screenshot-label">PAYMENT SCREENSHOT (submitted by participant)</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={registration.screenshot}
                  alt="Payment screenshot"
                  className="admin-screenshot-img"
                />
                {registration.screenshotName && (
                  <small className="admin-screenshot-name">{registration.screenshotName}</small>
                )}
              </div>
            )}
            {!registration?.screenshot && (
              <p className="no-screenshot-note">No screenshot was uploaded by the participant.</p>
            )}

            <div className="verify-actions">
              <button
                className="primary-button verify-btn"
                onClick={() => registration && setModal({ type: "verify", reg: registration })}
                id="btn-verify-payment"
              >
                <CheckCircle2 size={16} /> VERIFY PAYMENT
              </button>
              <button
                className="reject-btn"
                onClick={() => registration && setModal({ type: "reject", reg: registration })}
                id="btn-reject-payment"
              >
                <XCircle size={16} /> REJECT PAYMENT
              </button>
            </div>
          </div>
        )}

        {/* Main table */}
        <div className="admin-table-card">
          <div className="search">
            <Search size={18} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search registrations..." />
          </div>

          {registration && matches ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Reference / ID</th>
                    <th>Name</th>
                    <th>Register No.</th>
                    <th>Dept.</th>
                    <th>Year</th>
                    <th>Amount</th>
                    <th>UTR / Txn ID</th>
                    <th>Payment Status</th>
                    <th>Reg. Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <div>{registration.registrationId || registration.pendingReferenceId || "—"}</div>
                      {registration.registrationId && registration.pendingReferenceId && (
                        <small className="td-mono">{registration.pendingReferenceId}</small>
                      )}
                    </td>
                    <td>{registration.name}</td>
                    <td>{registration.registerNo}</td>
                    <td>{registration.department}</td>
                    <td>{registration.year}</td>
                    <td>₹{registration.amount ?? 250}</td>
                    <td className="td-mono">{registration.utr || "—"}</td>
                    <td><span className={`status-pill ${pStatus?.cls ?? ""}`}>{pStatus?.label ?? "—"}</span></td>
                    <td><span className={`status-pill ${rStatus?.cls ?? ""}`}>{rStatus?.label ?? "—"}</span></td>
                    <td>
                      {isUpiSubmitted && (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <button
                            className="tbl-verify-btn"
                            onClick={() => registration && setModal({ type: "verify", reg: registration })}
                          >Verify</button>
                          <button
                            className="tbl-reject-btn"
                            onClick={() => registration && setModal({ type: "reject", reg: registration })}
                          >Reject</button>
                        </div>
                      )}
                      {registration.registrationStatus === "CONFIRMED" && (
                        <span className="tbl-confirmed-badge">✓ Confirmed</span>
                      )}
                      {registration.registrationStatus === "REJECTED" && (
                        <span className="tbl-rejected-badge">✗ Rejected</span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty">
              {registration
                ? "No results match your search."
                : "No registrations found in this browser session."}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
