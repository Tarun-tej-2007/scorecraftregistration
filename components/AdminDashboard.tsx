"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Edit2,
  Eye,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
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
  screenshotName?: string | null;
  hasScreenshot?: boolean;
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

type EditForm = {
  name: string;
  registerNo: string;
  email: string;
  phone: string;
  department: string;
  year: string;
  utr: string;
};

type ScreenshotModal = {
  screenshot: string;
  screenshotName: string;
  name: string;
  registerNo: string;
  utr: string | null;
  amount: number;
};

type ModalState =
  | { type: "verify"; reg: Registration }
  | { type: "reject"; reg: Registration }
  | { type: "screenshot"; data: ScreenshotModal }
  | { type: "edit"; reg: Registration }
  | { type: "delete"; reg: Registration }
  | null;

// ─────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────

const DEPARTMENTS = ["CSE", "ECE", "EEE", "MECH", "CIVIL", "IT", "Other"];
const YEARS       = ["2nd Year", "3rd Year", "4th Year"];

const P_STATUS: Record<string, { label: string; cls: string }> = {
  PENDING:   { label: "PENDING",   cls: "pill-muted"    },
  SUBMITTED: { label: "SUBMITTED", cls: "pill-pending"  },
  VERIFIED:  { label: "VERIFIED",  cls: "pill-paid"     },
  REJECTED:  { label: "REJECTED",  cls: "pill-failed"   },
};
const R_STATUS: Record<string, { label: string; cls: string }> = {
  PENDING_PAYMENT:      { label: "PENDING PAYMENT",      cls: "pill-muted"    },
  PENDING_VERIFICATION: { label: "PENDING VERIFICATION", cls: "pill-pending"  },
  CONFIRMED:            { label: "CONFIRMED",             cls: "pill-paid"     },
  REJECTED:             { label: "REJECTED",              cls: "pill-failed"   },
};

const emptyEditForm = (): EditForm => ({
  name: "", registerNo: "", email: "", phone: "", department: "", year: "", utr: "",
});

// ─────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────

export default function AdminDashboard() {
  // ── Auth ────────────────────────────────────────────────
  const [adminKey,      setAdminKey]      = useState("");
  const [loginInput,    setLoginInput]    = useState("");
  const [loginError,    setLoginError]    = useState("");
  const [loginLoading,  setLoginLoading]  = useState(false);
  const [isLoggedIn,    setIsLoggedIn]    = useState(false);

  // ── Data ────────────────────────────────────────────────
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [stats,         setStats]         = useState<Stats | null>(null);
  const [query,         setQuery]         = useState("");
  const [loading,       setLoading]       = useState(false);
  const [actionMsg,     setActionMsg]     = useState("");

  // ── Modals ──────────────────────────────────────────────
  const [modal,          setModal]          = useState<ModalState>(null);
  const [rejectReason,   setRejectReason]   = useState("");
  const [actionLoading,  setActionLoading]  = useState(false);
  const [screenshotLoad, setScreenshotLoad] = useState(false);

  // ── Edit form ───────────────────────────────────────────
  const [editForm,   setEditForm]   = useState<EditForm>(emptyEditForm());
  const [editErrors, setEditErrors] = useState<Partial<EditForm>>({});

  // ── Session ─────────────────────────────────────────────
  useEffect(() => {
    const saved = sessionStorage.getItem("admin-key");
    if (saved) { setAdminKey(saved); setIsLoggedIn(true); }
  }, []);

  // ── Load data ───────────────────────────────────────────
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isLoggedIn && adminKey) loadData(adminKey);
  }, [isLoggedIn, adminKey, loadData]);

  // ── Auth handlers ────────────────────────────────────────
  async function handleLogin() {
    setLoginError("");
    setLoginLoading(true);
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: loginInput }),
      });
      if (!res.ok) { setLoginError("Incorrect password. Please try again."); return; }
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
    setAdminKey(""); setIsLoggedIn(false);
    setRegistrations([]); setStats(null);
  }

  // ── Verify ───────────────────────────────────────────────
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
    } finally { setActionLoading(false); }
  }

  // ── Reject ───────────────────────────────────────────────
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
      setModal(null); setRejectReason("");
      loadData(adminKey);
    } catch {
      setActionMsg("err:Network error during rejection.");
    } finally { setActionLoading(false); }
  }

  // ── View screenshot (fetched on demand — not stored in table data) ──
  async function handleViewScreenshot(reg: Registration) {
    setScreenshotLoad(true);
    try {
      const res = await fetch(`/api/admin/registrations/${reg._id}`, {
        headers: { "x-admin-key": adminKey },
      });
      const data = await res.json();
      if (!res.ok || !data.registration?.screenshot) {
        setActionMsg("err:Screenshot not available.");
        return;
      }
      setModal({
        type: "screenshot",
        data: {
          screenshot:     data.registration.screenshot,
          screenshotName: data.registration.screenshotName ?? "screenshot",
          name:           reg.name,
          registerNo:     reg.registerNo,
          utr:            reg.utr,
          amount:         reg.amount ?? 250,
        },
      });
    } catch {
      setActionMsg("err:Failed to load screenshot.");
    } finally { setScreenshotLoad(false); }
  }

  // ── Edit ─────────────────────────────────────────────────
  function openEditModal(reg: Registration) {
    setEditForm({
      name:       reg.name,
      registerNo: reg.registerNo,
      email:      reg.email,
      phone:      reg.phone,
      department: reg.department,
      year:       reg.year,
      utr:        reg.utr ?? "",
    });
    setEditErrors({});
    setModal({ type: "edit", reg });
  }

  async function handleSaveEdit() {
    if (!modal || modal.type !== "edit") return;
    const errors: Partial<EditForm> = {};
    if (!editForm.name.trim())       errors.name       = "Required";
    if (!editForm.registerNo.trim()) errors.registerNo = "Required";
    if (!editForm.email.trim() || !editForm.email.includes("@")) errors.email = "Valid email required";
    if (!editForm.department)        errors.department = "Required";
    if (!editForm.year)              errors.year       = "Required";
    if (editForm.utr && editForm.utr.trim().length > 0 && editForm.utr.trim().length < 6)
      errors.utr = "UTR must be at least 6 characters";

    if (Object.keys(errors).length) { setEditErrors(errors); return; }

    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/registrations/${modal.reg._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) { setActionMsg(`err:${data.message}`); return; }

      // Update row in-place without full reload
      setRegistrations((prev) =>
        prev.map((r) => r._id === modal.reg._id ? { ...r, ...data.registration } : r)
      );
      setActionMsg("ok:Participant updated successfully.");
      setModal(null);
    } catch {
      setActionMsg("err:Network error. Could not save changes.");
    } finally { setActionLoading(false); }
  }

  // ── Delete ───────────────────────────────────────────────
  async function handleConfirmDelete() {
    if (!modal || modal.type !== "delete") return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/registrations/${modal.reg._id}`, {
        method: "DELETE",
        headers: { "x-admin-key": adminKey },
      });
      const data = await res.json();
      if (!res.ok) { setActionMsg(`err:${data.message}`); return; }

      setRegistrations((prev) => prev.filter((r) => r._id !== modal.reg._id));
      setStats((prev) => prev ? { ...prev, total: Math.max(0, prev.total - 1) } : prev);
      setActionMsg("ok:Participant deleted successfully.");
      setModal(null);
    } catch {
      setActionMsg("err:Network error. Could not delete participant.");
    } finally { setActionLoading(false); }
  }

  // ── CSV export ───────────────────────────────────────────
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

  // ── Helpers ──────────────────────────────────────────────
  const isOk     = (msg: string) => msg.startsWith("ok:");
  const msgText  = (msg: string) => msg.replace(/^(ok|err):/, "");

  const filtered = registrations.filter((r) =>
    [r.name, r.registerNo, r.email, r.phone, r.utr ?? "", r.pendingReferenceId, r.registrationId ?? ""].some(
      (v) => v?.toLowerCase().includes(query.toLowerCase())
    )
  );

  const pendingRows = registrations.filter((r) => r.registrationStatus === "PENDING_VERIFICATION");

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
            <p className="admin-login-sub">Enter your admin password to continue.</p>
            <input type="password" className="admin-login-input" placeholder="Admin password"
              value={loginInput} onChange={(e) => setLoginInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()} autoFocus />
            {loginError && <p className="admin-login-error">{loginError}</p>}
            <button className="primary-button admin-login-btn" onClick={handleLogin}
              disabled={loginLoading} id="btn-admin-login">
              {loginLoading ? <><Loader2 size={16} className="spin-icon" /> Verifying...</> : "LOGIN →"}
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ══════════════════════════════════════════════════════
  // DASHBOARD
  // ══════════════════════════════════════════════════════
  return (
    <main className="admin-page">

      {/* ═══ VERIFY MODAL ═══ */}
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
            {modal.reg.screenshot && (
              <div className="admin-screenshot-wrap">
                <p className="admin-screenshot-label">PAYMENT SCREENSHOT</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={modal.reg.screenshot} alt="Payment screenshot" className="admin-screenshot-img" />
              </div>
            )}
            <p className="modal-question">Have you verified this ₹250 payment in your UPI account?</p>
            <div className="modal-actions">
              <button className="secondary-button" onClick={() => setModal(null)}>CANCEL</button>
              <button className="primary-button modal-verify-btn" onClick={handleVerify}
                disabled={actionLoading} id="btn-confirm-verify">
                {actionLoading ? <Loader2 size={14} className="spin-icon" /> : <CheckCircle2 size={16} />}
                VERIFY &amp; CONFIRM REGISTRATION
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ REJECT MODAL ═══ */}
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
              <textarea className="reject-reason-input" value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. UTR not found in payment records." rows={3} />
            </label>
            <div className="modal-actions">
              <button className="secondary-button" onClick={() => { setModal(null); setRejectReason(""); }}>CANCEL</button>
              <button className="primary-button modal-reject-btn" onClick={handleReject}
                disabled={actionLoading} id="btn-confirm-reject">
                {actionLoading ? <Loader2 size={14} className="spin-icon" /> : <XCircle size={16} />}
                REJECT PAYMENT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ SCREENSHOT MODAL (secure — fetched via API with admin key) ═══ */}
      {modal?.type === "screenshot" && (
        <div className="admin-modal-overlay" onClick={() => setModal(null)}>
          <div className="admin-modal admin-screenshot-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setModal(null)}><X size={20} /></button>
            <h2 className="modal-title">PAYMENT SCREENSHOT</h2>
            <div className="modal-detail-grid">
              <span>Participant</span>   <b>{modal.data.name}</b>
              <span>Register No.</span> <b>{modal.data.registerNo}</b>
              <span>UTR</span>          <b className="modal-utr">{modal.data.utr ?? "—"}</b>
              <span>Amount</span>       <b>₹{modal.data.amount}/-</b>
            </div>
            <div className="screenshot-full-wrap">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={modal.data.screenshot} alt="Payment screenshot"
                className="screenshot-full-img" />
            </div>
            <small className="screenshot-filename">{modal.data.screenshotName}</small>
            <div className="modal-actions" style={{ marginTop: 16 }}>
              <button className="secondary-button" onClick={() => setModal(null)}>CLOSE</button>
              <a href={modal.data.screenshot} download={modal.data.screenshotName}
                className="primary-button" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>
                <Download size={15} /> Download
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ═══ EDIT MODAL ═══ */}
      {modal?.type === "edit" && (
        <div className="admin-modal-overlay" role="dialog" aria-modal="true">
          <div className="admin-modal admin-edit-modal">
            <button className="modal-close" onClick={() => setModal(null)}><X size={18} /></button>
            <div className="modal-icon modal-icon-edit"><Edit2 size={28} /></div>
            <h2 className="modal-title">EDIT PARTICIPANT</h2>
            <p className="modal-subtitle">Changes are saved immediately to the database.</p>

            <div className="edit-form-grid">
              <div className="edit-field">
                <label>FULL NAME *</label>
                <input type="text" value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  className={editErrors.name ? "edit-input error" : "edit-input"} />
                {editErrors.name && <span className="edit-error">{editErrors.name}</span>}
              </div>
              <div className="edit-field">
                <label>REGISTER NUMBER *</label>
                <input type="text" value={editForm.registerNo}
                  onChange={(e) => setEditForm((f) => ({ ...f, registerNo: e.target.value }))}
                  className={editErrors.registerNo ? "edit-input error" : "edit-input"} />
                {editErrors.registerNo && <span className="edit-error">{editErrors.registerNo}</span>}
              </div>
              <div className="edit-field">
                <label>KARE EMAIL *</label>
                <input type="email" value={editForm.email}
                  onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                  className={editErrors.email ? "edit-input error" : "edit-input"} />
                {editErrors.email && <span className="edit-error">{editErrors.email}</span>}
              </div>
              <div className="edit-field">
                <label>MOBILE NUMBER</label>
                <input type="text" value={editForm.phone}
                  onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                  className="edit-input" />
              </div>
              <div className="edit-field">
                <label>DEPARTMENT *</label>
                <select value={editForm.department}
                  onChange={(e) => setEditForm((f) => ({ ...f, department: e.target.value }))}
                  className={editErrors.department ? "edit-input error" : "edit-input"}>
                  <option value="">Select department</option>
                  {(editForm.year === "2nd Year" ? ["CSE", "IT"] : DEPARTMENTS).map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
                {editErrors.department && <span className="edit-error">{editErrors.department}</span>}
              </div>
              <div className="edit-field">
                <label>YEAR *</label>
                <select value={editForm.year}
                  onChange={(e) => {
                    const newYear = e.target.value;
                    setEditForm((f) => {
                      const next = { ...f, year: newYear };
                      if (newYear === "2nd Year" && next.department !== "CSE" && next.department !== "IT") {
                        next.department = "";
                      }
                      return next;
                    });
                  }}
                  className={editErrors.year ? "edit-input error" : "edit-input"}>
                  <option value="">Select year</option>
                  {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
                {editErrors.year && <span className="edit-error">{editErrors.year}</span>}
              </div>
              <div className="edit-field edit-field-full">
                <label>UTR / TRANSACTION ID</label>
                <input type="text" value={editForm.utr}
                  onChange={(e) => setEditForm((f) => ({ ...f, utr: e.target.value }))}
                  className={editErrors.utr ? "edit-input error" : "edit-input"}
                  placeholder="Leave blank to keep existing UTR" maxLength={50} />
                {editErrors.utr && <span className="edit-error">{editErrors.utr}</span>}
                <small className="edit-hint">
                  ⚠ To change payment status, use the VERIFY or REJECT buttons — not this form.
                </small>
              </div>
            </div>

            <div className="modal-actions">
              <button className="secondary-button" onClick={() => setModal(null)}>CANCEL</button>
              <button className="primary-button" onClick={handleSaveEdit} disabled={actionLoading}
                id="btn-save-edit">
                {actionLoading ? <><Loader2 size={14} className="spin-icon" /> Saving...</> : "SAVE CHANGES"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ DELETE CONFIRMATION MODAL ═══ */}
      {modal?.type === "delete" && (
        <div className="admin-modal-overlay" role="dialog" aria-modal="true">
          <div className="admin-modal">
            <button className="modal-close" onClick={() => setModal(null)}><X size={18} /></button>
            <div className="modal-icon modal-icon-reject"><Trash2 size={30} /></div>
            <h2 className="modal-title">DELETE PARTICIPANT?</h2>
            <p className="modal-subtitle">You are about to permanently delete:</p>

            <div className="delete-confirm-block">
              <div className="delete-confirm-name">{modal.reg.name}</div>
              <div className="delete-confirm-detail">Register No: <strong>{modal.reg.registerNo}</strong></div>
              {modal.reg.registrationId && (
                <div className="delete-confirm-detail">ID: <strong>{modal.reg.registrationId}</strong></div>
              )}
            </div>

            <div className="delete-warning">
              This action <strong>cannot be undone</strong>. The registration and all associated
              payment data (including screenshot) will be permanently removed.
            </div>

            <div className="modal-actions">
              <button className="secondary-button" onClick={() => setModal(null)}>CANCEL</button>
              <button className="primary-button modal-reject-btn" onClick={handleConfirmDelete}
                disabled={actionLoading} id="btn-confirm-delete">
                {actionLoading
                  ? <><Loader2 size={14} className="spin-icon" /> Deleting...</>
                  : <><Trash2 size={15} /> DELETE PARTICIPANT</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ TOP BAR ═══ */}
      <div className="admin-top">
        <Link href="/" className="back-link"><ArrowLeft size={18} /> Back to event</Link>
        <div className="admin-brand"><ShieldCheck size={20} /> SCORECRAFT ADMIN</div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 12 }}>
          <Link href="/admin/attendance" className="secondary-button" style={{ textDecoration: "none" }}>
            Attendance Portal
          </Link>
          <button className="secondary-button" onClick={handleLogout}>
            Logout
          </button>
        </div>
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

        {/* Pending verification cards */}
        {pendingRows.map((reg) => (
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
            {reg.hasScreenshot ? (
              <div className="verify-screenshot-cta">
                <button className="tbl-screenshot-btn verify-ss-btn"
                  onClick={() => handleViewScreenshot(reg)} disabled={screenshotLoad}>
                  {screenshotLoad ? <Loader2 size={14} className="spin-icon" /> : <Eye size={14} />}
                  View Payment Screenshot
                </button>
              </div>
            ) : (
              <p className="no-screenshot-note">No screenshot uploaded by participant.</p>
            )}
            <div className="verify-actions">
              <button className="primary-button verify-btn"
                onClick={() => setModal({ type: "verify", reg })} id={`btn-verify-${reg._id}`}>
                <CheckCircle2 size={16} /> VERIFY PAYMENT
              </button>
              <button className="reject-btn"
                onClick={() => setModal({ type: "reject", reg })} id={`btn-reject-${reg._id}`}>
                <XCircle size={16} /> REJECT PAYMENT
              </button>
            </div>
          </div>
        ))}

        {/* ═══ MAIN TABLE ═══ */}
        <div className="admin-table-card">
          <div className="search">
            <Search size={18} />
            <input value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, register no, registration ID, UTR..." />
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
                    <th>Phone</th>
                    <th>Dept.</th>
                    <th>Year</th>
                    <th>UTR</th>
                    <th>Payment</th>
                    <th>Screenshot</th>
                    <th>Status</th>
                    <th>Manage</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((reg) => (
                    <tr key={reg._id}>
                      {/* Ref / ID */}
                      <td>
                        <div className="td-mono">
                          {reg.registrationId ?? reg.pendingReferenceId}
                        </div>
                        {reg.registrationId && (
                          <small className="td-mono td-ref-small">{reg.pendingReferenceId}</small>
                        )}
                      </td>

                      {/* Name */}
                      <td>{reg.name}</td>

                      {/* Reg No */}
                      <td>{reg.registerNo}</td>

                      {/* Phone */}
                      <td>{reg.phone || "—"}</td>

                      {/* Dept */}
                      <td>{reg.department}</td>

                      {/* Year */}
                      <td>{reg.year}</td>

                      {/* UTR */}
                      <td className="td-mono">{reg.utr ?? "—"}</td>

                      {/* Payment status */}
                      <td>
                        <span className={`status-pill ${P_STATUS[reg.paymentStatus]?.cls ?? ""}`}>
                          {P_STATUS[reg.paymentStatus]?.label ?? reg.paymentStatus}
                        </span>
                      </td>

                      {/* Screenshot */}
                      <td className="td-screenshot">
                        {reg.hasScreenshot ? (
                          <button
                            className="tbl-screenshot-btn"
                            onClick={() => handleViewScreenshot(reg)}
                            disabled={screenshotLoad}
                            title="View payment screenshot"
                          >
                            {screenshotLoad
                              ? <Loader2 size={12} className="spin-icon" />
                              : <Eye size={12} />}
                            View
                          </button>
                        ) : (
                          <span className="tbl-no-screenshot">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td>
                        <span className={`status-pill ${R_STATUS[reg.registrationStatus]?.cls ?? ""}`}>
                          {R_STATUS[reg.registrationStatus]?.label ?? reg.registrationStatus}
                        </span>
                      </td>

                      {/* Manage */}
                      <td>
                        <div className="tbl-manage-cell">
                          {/* Inline verify/reject for pending rows */}
                          {reg.registrationStatus === "PENDING_VERIFICATION" && (
                            <>
                              <button className="tbl-verify-btn"
                                onClick={() => setModal({ type: "verify", reg })}
                                title="Verify payment">
                                <CheckCircle2 size={12} /> Verify
                              </button>
                              <button className="tbl-reject-btn"
                                onClick={() => setModal({ type: "reject", reg })}
                                title="Reject payment">
                                <XCircle size={12} /> Reject
                              </button>
                            </>
                          )}
                          <button className="tbl-edit-btn"
                            onClick={() => openEditModal(reg)}
                            title="Edit participant">
                            <Edit2 size={12} /> Edit
                          </button>
                          <button className="tbl-delete-btn"
                            onClick={() => setModal({ type: "delete", reg })}
                            title="Delete participant">
                            <Trash2 size={12} /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty">
              {query ? "No results match your search." : "No registrations yet."}
            </div>
          )}

          {filtered.length > 0 && (
            <div className="table-footer">
              Showing {filtered.length} of {registrations.length} registrations
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
