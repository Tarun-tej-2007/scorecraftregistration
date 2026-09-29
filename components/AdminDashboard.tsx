"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
  XCircle,
} from "lucide-react";
import Link from "next/link";

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

type PaymentStatus = "PENDING" | "SUBMITTED" | "VERIFIED" | "REJECTED";
type RegistrationStatus = "PENDING_PAYMENT" | "PENDING_VERIFICATION" | "CONFIRMED" | "REJECTED";

type Registration = {
  _id: string;
  pendingReferenceId: string;
  registrationId: string | null;
  name: string;
  registerNo: string;
  email: string;
  phone: string;
  department: string;
  year: string;
  amount: number;
  paymentMethod: string;
  utr: string | null;
  screenshot?: string | null;
  paymentScreenshotKey?: string | null;
  screenshotName?: string | null;
  paymentStatus: PaymentStatus;
  registrationStatus: RegistrationStatus;
  submittedAt: string | null;
  verifiedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
};

type Stats = {
  total: number;
  pendingVerification: number;
  confirmed: number;
  rejected: number;
  availableSeats: number;
  limit: number;
};

type ModalState =
  | { type: "verify"; reg: Registration }
  | { type: "reject"; reg: Registration }
  | { type: "screenshot"; reg: Registration }
  | null;

// ─────────────────────────────────────────────────────────
// Status config
// ─────────────────────────────────────────────────────────

const P_STATUS: Record<string, { label: string; cls: string }> = {
  PENDING:   { label: "PENDING",       cls: "pill-muted" },
  SUBMITTED: { label: "SUBMITTED",     cls: "pill-pending" },
  VERIFIED:  { label: "VERIFIED",      cls: "pill-paid" },
  REJECTED:  { label: "REJECTED",      cls: "pill-failed" },
};
const R_STATUS: Record<string, { label: string; cls: string }> = {
  PENDING_PAYMENT:      { label: "PENDING PAYMENT",      cls: "pill-muted" },
  PENDING_VERIFICATION: { label: "PENDING VERIFICATION", cls: "pill-pending" },
  CONFIRMED:            { label: "CONFIRMED",             cls: "pill-paid" },
  REJECTED:             { label: "REJECTED",              cls: "pill-failed" },
};

// ─────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [adminKey, setAdminKey]         = useState("");
  const [loginInput, setLoginInput]     = useState("");
  const [loginError, setLoginError]     = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn]     = useState(false);

  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [stats, setStats]                 = useState<Stats | null>(null);
  const [query, setQuery]                 = useState("");
  const [loading, setLoading]             = useState(false);
  const [actionMsg, setActionMsg]         = useState("");
  const [modal, setModal]                 = useState<ModalState>(null);
  const [screenshotUrl, setScreenshotUrl] = useState("");
  const [rejectReason, setRejectReason]   = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // ── Check sessionStorage for saved key ──
  useEffect(() => {
    const saved = sessionStorage.getItem("admin-key");
    if (saved) { setAdminKey(saved); setIsLoggedIn(true); }
  }, []);

  // ── Load data when logged in ──
  const loadData = useCallback(async (key: string) => {
    setLoading(true);
    try {
      const headers = { "x-admin-key": key };
      const [regRes, statsRes] = await Promise.all([
        fetch("/api/admin/registrations", { headers }),
        fetch("/api/admin/stats",         { headers }),
      ]);
      if (regRes.status === 401) { handleLogout(); return; }
      const regData   = await regRes.json();
      const statsData = await statsRes.json();
      setRegistrations(regData.registrations ?? []);
      setStats(statsData);
    } catch {
      setActionMsg("err:Failed to load data. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isLoggedIn && adminKey) loadData(adminKey);
  }, [isLoggedIn, adminKey, loadData]);

  // ── Login ──
  async function handleLogin() {
    setLoginError("");
    setLoginLoading(true);
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: loginInput }),
      });
      if (!res.ok) {
        setLoginError("Incorrect password. Please try again.");
        return;
      }
      sessionStorage.setItem("admin-key", loginInput);
      setAdminKey(loginInput);
      setIsLoggedIn(true);
    } catch {
      setLoginError("Network error. Please try again.");
    } finally {
      setLoginLoading(false);
    }
  }

  function handleLogout() {
    sessionStorage.removeItem("admin-key");
    setAdminKey("");
    setIsLoggedIn(false);
    setRegistrations([]);
    setStats(null);
  }

  // ── Verify ──
  async function handleVerify() {
    if (!modal || modal.type !== "verify") return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/registrations/${modal.reg._id}/verify`, {
        method: "POST",
        headers: { "x-admin-key": adminKey },
      });
      const data = await res.json();
      if (!res.ok) { setActionMsg(`err:${data.message}`); return; }
      setActionMsg(`ok:✓ Verified — Registration ID: ${data.registrationId}`);
      setModal(null);
      loadData(adminKey);
    } catch {
      setActionMsg("err:Network error during verification.");
    } finally {
      setActionLoading(false);
    }
  }

  // ── Reject ──
  async function handleReject() {
    if (!modal || modal.type !== "reject") return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/registrations/${modal.reg._id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
        body: JSON.stringify({ reason: rejectReason }),
      });
      const data = await res.json();
      if (!res.ok) { setActionMsg(`err:${data.message}`); return; }
      setActionMsg("ok:✗ Payment rejected.");
      setModal(null);
      setRejectReason("");
      loadData(adminKey);
    } catch {
      setActionMsg("err:Network error during rejection.");
    } finally {
      setActionLoading(false);
    }
  }

  // ── CSV export ──
  function exportCsv() {
    if (!registrations.length) return;
    const fields = ["registrationId","pendingReferenceId","name","registerNo","email","phone","department","year","amount","utr","paymentStatus","registrationStatus","submittedAt","verifiedAt","createdAt"];
    const header = fields.join(",");
    const rows = registrations.map((r) =>
      fields.map((f) => JSON.stringify((r as unknown as Record<string, unknown>)[f] ?? "")).join(",")
    );
    const blob = new Blob([header + "\n" + rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "scorecraft-registrations.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  const filtered = registrations.filter((r) =>
    [r.name, r.registerNo, r.email, r.utr ?? "", r.pendingReferenceId, r.registrationId ?? ""].some(
      (v) => v.toLowerCase().includes(query.toLowerCase())
    )
  );

  const isOk = (msg: string) => msg.startsWith("ok:");
  const msgText = (msg: string) => msg.replace(/^(ok|err):/, "");

  async function viewScreenshot(reg: Registration) {
    setActionMsg("");
    try {
      const response = await fetch(`/api/admin/registrations/${reg._id}/payment-screenshot`, {
        headers: { "x-admin-key": adminKey },
      });
      if (!response.ok) {
        setActionMsg("err:Screenshot is not available.");
        return;
      }
      const blob = await response.blob();
      if (screenshotUrl) URL.revokeObjectURL(screenshotUrl);
      setScreenshotUrl(URL.createObjectURL(blob));
      setModal({ type: "screenshot", reg });
    } catch {
      setActionMsg("err:Unable to load the payment screenshot.");
    }
  }

  // ══════════════════════════════════════════════════════
  // LOGIN SCREEN
  // ══════════════════════════════════════════════════════
  if (!isLoggedIn) {
    return (
      <main className="admin-page">
        <div className="admin-top">
          <Link href="/" className="back-link"><ArrowLeft size={18} /> Back to event</Link>
          <div className="admin-brand"><ShieldCheck size={20} /> SCORECRAFT ADMIN</div>
        </div>
        <div className="admin-login-wrap">
          <div className="admin-login-card">
            <ShieldCheck size={40} />
            <h2 className="admin-login-title">ADMIN ACCESS</h2>
            <p className="admin-login-sub">Enter your admin password to access the dashboard.</p>
            <input
              type="password"
              className="admin-login-input"
              placeholder="Admin password"
              value={loginInput}
              onChange={(e) => setLoginInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              autoFocus
            />
            {loginError && <p className="admin-login-error">{loginError}</p>}
            <button className="primary-button admin-login-btn" onClick={handleLogin} disabled={loginLoading} id="btn-admin-login">
              {loginLoading ? <><Loader2 size={16} className="spin-icon" /> Verifying...</> : "LOGIN →"}
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ══════════════════════════════════════════════════════
  // MODALS
  // ══════════════════════════════════════════════════════
  return (
    <main className="admin-page">

      {/* Verify Modal */}
      {modal?.type === "verify" && (
        <div className="admin-modal-overlay" role="dialog" aria-modal="true">
          <div className="admin-modal">
            <button className="modal-close" onClick={() => setModal(null)}><X size={18} /></button>
            <div className="modal-icon modal-icon-verify"><CheckCircle2 size={34} /></div>
            <h2 className="modal-title">VERIFY PAYMENT</h2>
            <p className="modal-subtitle">Confirm you have checked this payment in your UPI dashboard.</p>
            <div className="modal-detail-grid">
              <span>Participant</span>   <b>{modal.reg.name}</b>
              <span>Register No.</span> <b>{modal.reg.registerNo}</b>
              <span>Amount</span>       <b>₹250/-</b>
              <span>UTR / Txn ID</span><b className="modal-utr">{modal.reg.utr ?? "—"}</b>
            </div>
            {(modal.reg.paymentScreenshotKey || modal.reg.screenshot) && (
              <div className="admin-screenshot-wrap">
                <p className="admin-screenshot-label">PAYMENT SCREENSHOT</p>
                <button className="secondary-button" onClick={() => viewScreenshot(modal.reg)}>VIEW SCREENSHOT</button>
              </div>
            )}
            <p className="modal-question">Have you verified this ₹250 payment in your UPI account?</p>
            <div className="modal-actions">
              <button className="secondary-button" onClick={() => setModal(null)}>CANCEL</button>
              <button className="primary-button modal-verify-btn" onClick={handleVerify} disabled={actionLoading} id="btn-confirm-verify">
                {actionLoading ? <Loader2 size={14} className="spin-icon" /> : <CheckCircle2 size={16} />}
                VERIFY &amp; CONFIRM REGISTRATION
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {modal?.type === "reject" && (
        <div className="admin-modal-overlay" role="dialog" aria-modal="true">
          <div className="admin-modal">
            <button className="modal-close" onClick={() => setModal(null)}><X size={18} /></button>
            <div className="modal-icon modal-icon-reject"><XCircle size={34} /></div>
            <h2 className="modal-title">REJECT PAYMENT</h2>
            <div className="modal-detail-grid">
              <span>Participant</span>   <b>{modal.reg.name}</b>
              <span>UTR / Txn ID</span><b className="modal-utr">{modal.reg.utr ?? "—"}</b>
            </div>
            <label className="reject-reason-label">
              Reason (optional)
              <textarea className="reject-reason-input" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. UTR not found in payment records." rows={3} />
            </label>
            <div className="modal-actions">
              <button className="secondary-button" onClick={() => { setModal(null); setRejectReason(""); }}>CANCEL</button>
              <button className="primary-button modal-reject-btn" onClick={handleReject} disabled={actionLoading} id="btn-confirm-reject">
                {actionLoading ? <Loader2 size={14} className="spin-icon" /> : <XCircle size={16} />}
                REJECT PAYMENT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Screenshot lightbox */}
      {modal?.type === "screenshot" && screenshotUrl && (
        <div className="admin-modal-overlay" onClick={() => setModal(null)}>
          <div className="screenshot-lightbox" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setModal(null)}><X size={20} /></button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={screenshotUrl} alt="Payment screenshot" style={{ maxWidth: "100%", maxHeight: "80vh", objectFit: "contain" }} />
            <small>{modal.reg.screenshotName}</small>
          </div>
        </div>
      )}

      {/* ── Top bar ── */}
      <div className="admin-top">
        <Link href="/" className="back-link"><ArrowLeft size={18} /> Back to event</Link>
        <div className="admin-brand"><ShieldCheck size={20} /> SCORECRAFT ADMIN</div>
        <button className="secondary-button" onClick={handleLogout} style={{ marginLeft: "auto" }}>Logout</button>
      </div>

      <div className="admin-shell">
        <div className="admin-heading">
          <div>
            <span className="brush-label">CONTROL DESK</span>
            <h1>Registrations</h1>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button className="secondary-button" onClick={() => loadData(adminKey)} disabled={loading}>
              <RefreshCw size={15} /> Refresh
            </button>
            <button className="primary-button" onClick={exportCsv}>
              <Download size={18} /> Export CSV
            </button>
          </div>
        </div>

        {/* Action message */}
        {actionMsg && (
          <div className={`admin-action-msg ${isOk(actionMsg) ? "msg-success" : "msg-error"}`}>
            {msgText(actionMsg)}
            <button className="msg-close" onClick={() => setActionMsg("")}><X size={14} /></button>
          </div>
        )}

        {/* Stats */}
        {stats && (
          <div className="stats">
            <div><span>REGISTERED</span><strong>{stats.total}</strong></div>
            <div><span>PENDING VERIFICATION</span><strong>{stats.pendingVerification}</strong></div>
            <div><span>CONFIRMED</span><strong>{stats.confirmed}</strong></div>
            <div><span>SEATS LEFT</span><strong>{stats.availableSeats} / {stats.limit}</strong></div>
          </div>
        )}

        {/* Pending verification card */}
        {registrations.filter((r) => r.registrationStatus === "PENDING_VERIFICATION").map((reg) => (
          <div key={reg._id} className="admin-verify-card">
            <div className="verify-card-header">
              <span className="brush-label">PAYMENT VERIFICATION REQUIRED</span>
              <span className="pending-pill">PENDING</span>
            </div>
            <p className="verify-card-desc">
              Cross-check the UTR in your UPI dashboard before approving.
            </p>
            <div className="verify-detail-table">
              <div className="vdt-row"><span>Participant</span><b>{reg.name}</b></div>
              <div className="vdt-row"><span>Register No.</span><b>{reg.registerNo}</b></div>
              <div className="vdt-row"><span>Department</span><b>{reg.department}</b></div>
              <div className="vdt-row"><span>Amount</span><b>₹{reg.amount}/-</b></div>
              <div className="vdt-row"><span>UTR / Txn ID</span><b className="utr-highlight">{reg.utr ?? "—"}</b></div>
              <div className="vdt-row"><span>Submitted</span><b>{reg.submittedAt ? new Date(reg.submittedAt).toLocaleString() : "—"}</b></div>
            </div>
            {(reg.paymentScreenshotKey || reg.screenshot) ? (
              <div className="admin-screenshot-wrap">
                <p className="admin-screenshot-label">PAYMENT SCREENSHOT</p>
                <button className="secondary-button" onClick={() => viewScreenshot(reg)}>VIEW SCREENSHOT</button>
                <small className="admin-screenshot-name">{reg.screenshotName ?? "Screenshot uploaded"}</small>
              </div>
            ) : (
              <p className="no-screenshot-note">No screenshot uploaded.</p>
            )}
            <div className="verify-actions">
              <button className="primary-button verify-btn" onClick={() => setModal({ type: "verify", reg })} id={`btn-verify-${reg._id}`}>
                <CheckCircle2 size={16} /> VERIFY PAYMENT
              </button>
              <button className="reject-btn" onClick={() => setModal({ type: "reject", reg })} id={`btn-reject-${reg._id}`}>
                <XCircle size={16} /> REJECT PAYMENT
              </button>
            </div>
          </div>
        ))}

        {/* Table */}
        <div className="admin-table-card">
          <div className="search">
            <Search size={18} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, register no, UTR..." />
          </div>

          {loading ? (
            <div className="admin-loading"><Loader2 size={32} className="spin-icon" /> Loading...</div>
          ) : filtered.length > 0 ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Ref / ID</th>
                    <th>Name</th>
                    <th>Reg. No.</th>
                    <th>Dept.</th>
                    <th>Year</th>
                    <th>UTR</th>
                    <th>Screenshot</th>
                    <th>Payment</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((reg) => (
                    <tr key={reg._id}>
                      <td>
                        <div className="td-mono">{reg.registrationId ?? reg.pendingReferenceId}</div>
                        {reg.registrationId && <small className="td-mono">{reg.pendingReferenceId}</small>}
                      </td>
                      <td>{reg.name}</td>
                      <td>{reg.registerNo}</td>
                      <td>{reg.department}</td>
                      <td>{reg.year}</td>
                      <td className="td-mono">{reg.utr ?? "—"}</td>
                      <td>
                        {(reg.paymentScreenshotKey || reg.screenshot) ? (
                          <button className="tbl-screenshot-btn" onClick={() => viewScreenshot(reg)}>
                            VIEW
                          </button>
                        ) : (
                          <span className="td-muted">Not uploaded</span>
                        )}
                      </td>
                      <td><span className={`status-pill ${P_STATUS[reg.paymentStatus]?.cls ?? ""}`}>{P_STATUS[reg.paymentStatus]?.label ?? reg.paymentStatus}</span></td>
                      <td><span className={`status-pill ${R_STATUS[reg.registrationStatus]?.cls ?? ""}`}>{R_STATUS[reg.registrationStatus]?.label ?? reg.registrationStatus}</span></td>
                      <td>
                        {reg.registrationStatus === "PENDING_VERIFICATION" && (
                          <div style={{ display: "flex", gap: 6 }}>
                            <button className="tbl-verify-btn" onClick={() => setModal({ type: "verify", reg })}>Verify</button>
                            <button className="tbl-reject-btn" onClick={() => setModal({ type: "reject", reg })}>Reject</button>
                          </div>
                        )}
                        {reg.registrationStatus === "CONFIRMED" && <span className="tbl-confirmed-badge">✓ Confirmed</span>}
                        {reg.registrationStatus === "REJECTED"  && <span className="tbl-rejected-badge">✗ Rejected</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty">{query ? "No results match your search." : "No registrations yet."}</div>
          )}
        </div>
      </div>
    </main>
  );
}
