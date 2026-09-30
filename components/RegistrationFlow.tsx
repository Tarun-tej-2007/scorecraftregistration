"use client";

import { useRef, useState, useEffect } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Clock3,
  Download,
  ImagePlus,
  Loader2,
  MapPin,
  ShieldCheck,
  Trash2,
  XCircle,
} from "lucide-react";

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

type FormData = {
  name: string;
  registerNo: string;
  email: string;
  phone: string;
  department: string;
  year: string;
};

// "confirmed" is only reached via admin action (checked via localStorage)
type Step = "form" | "review" | "payment" | "processing" | "whatsapp" | "submitted" | "failed" | "resuming";

type SubmittedData = {
  pendingReferenceId: string;
  utr: string;
  paymentStatus: string;
  registrationStatus: string;
  amount: number;
};

type AdminStatus = {
  registrationStatus: "CONFIRMED" | "REJECTED";
  registrationId?: string;
  verifiedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
};

const DEPARTMENTS = ["CSE", "ECE", "EEE", "MECH", "CIVIL", "IT", "Other"];
const YEARS = ["3rd Year", "4th Year"];

const initialForm: FormData = {
  name: "",
  registerNo: "",
  email: "",
  phone: "",
  department: "",
  year: "",
};

// ─────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────

const MAX_SCREENSHOT_SIZE_MB = 5;

// ── LocalStorage keys ──────────────────────────────────
const LS_PENDING_ID   = "scorecraft-pending-id";   // MongoDB _id
const LS_PENDING_FORM = "scorecraft-pending-form"; // form data for resume display

function lsSave(key: string, val: unknown) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* quota / SSR */ }
}
function lsGet<T>(key: string): T | null {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : null; } catch { return null; }
}
function lsClear(...keys: string[]) {
  try { keys.forEach((k) => localStorage.removeItem(k)); } catch { /* SSR */ }
}

export default function RegistrationFlow() {
  const [step, setStep] = useState<Step>("resuming"); // start in resuming while we check localStorage
  const [form, setForm] = useState<FormData>(initialForm);
  const [errorMsg, setErrorMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [pendingId, setPendingId] = useState("");
  const [utr, setUtr] = useState("");
  const [screenshot, setScreenshot] = useState<string | null>(null); // base64 data URL
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotName, setScreenshotName] = useState("");
  const [screenshotError, setScreenshotError] = useState("");
  const [submittedData, setSubmittedData] = useState<SubmittedData | null>(null);
  const [adminStatus, setAdminStatus] = useState<AdminStatus | null>(null);
  const [qrError, setQrError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const update = (key: keyof FormData, value: string) =>
    setForm((c) => ({ ...c, [key]: value }));

  // ── On mount: attempt to resume a pending registration ──────
  // This is the core persistence fix. React state is volatile
  // (lost on refresh). localStorage survives refreshes. We use
  // the stored pendingId to call the server and restore state.
  useEffect(() => {
    async function tryResume() {
      const savedId = lsGet<string>(LS_PENDING_ID);

      if (!savedId) {
        // No pending registration — start fresh
        setStep("form");
        return;
      }

      try {
        const res = await fetch(`/api/registrations/${savedId}/status`);

        if (!res.ok) {
          // Registration not found or error — clear stale localStorage and start fresh
          lsClear(LS_PENDING_ID, LS_PENDING_FORM);
          setStep("form");
          return;
        }

        const data = await res.json();

        // Restore form data from server (authoritative) so UI can display participant info
        const restoredForm: FormData = {
          name:       data.name       || "",
          registerNo: data.registerNo || "",
          email:      data.email      || "",
          phone:      data.phone      || "",
          department: data.department || "",
          year:       data.year       || "",
        };
        setForm(restoredForm);
        setPendingId(savedId);

        // Determine correct step from server-side state
        const rStatus = data.registrationStatus as string;
        const pStatus = data.paymentStatus      as string;

        if (rStatus === "CONFIRMED") {
          // Admin already confirmed — jump straight to confirmed screen
          setSubmittedData({
            pendingReferenceId: data.pendingReferenceId,
            utr: data.utr ?? "",
            paymentStatus: pStatus,
            registrationStatus: rStatus,
            amount: data.amount ?? 250,
          });
          setAdminStatus({
            registrationStatus: "CONFIRMED",
            registrationId: data.registrationId,
            verifiedAt: data.verifiedAt,
          });
          lsClear(LS_PENDING_ID, LS_PENDING_FORM); // clean up — done!
          setStep("submitted");
        } else if (rStatus === "REJECTED") {
          setSubmittedData({
            pendingReferenceId: data.pendingReferenceId,
            utr: data.utr ?? "",
            paymentStatus: pStatus,
            registrationStatus: rStatus,
            amount: data.amount ?? 250,
          });
          setAdminStatus({
            registrationStatus: "REJECTED",
            rejectedAt: data.rejectedAt,
            rejectionReason: data.rejectionReason,
          });
          lsClear(LS_PENDING_ID, LS_PENDING_FORM); // clean up — rejected means closed
          setStep("submitted");
        } else if (rStatus === "PENDING_VERIFICATION" || pStatus === "SUBMITTED") {
          // UTR + screenshot already submitted — show pending/whatsapp step
          setSubmittedData({
            pendingReferenceId: data.pendingReferenceId,
            utr: data.utr ?? "",
            paymentStatus: pStatus,
            registrationStatus: rStatus,
            amount: data.amount ?? 250,
          });
          setStep("whatsapp");
        } else {
          // PENDING_PAYMENT — user paid or is about to pay, needs UTR entry
          // Resume at the payment step, keep the same registration
          setStep("payment");
        }
      } catch {
        // Network error — safe fallback: clear and start fresh
        lsClear(LS_PENDING_ID, LS_PENDING_FORM);
        setStep("form");
      }
    }

    tryResume();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Step 1 → 2: Validate form, go to review ──
  function handleProceedToReview() {
    setErrorMsg("");
    const { name, registerNo, email, phone, department, year } = form;
    if (!name.trim()) { setErrorMsg("Full Name is required."); return; }
    if (!registerNo.trim()) { setErrorMsg("Register Number is required."); return; }
    if (!email.trim() || !email.includes("@")) { setErrorMsg("A valid KARE email address is required."); return; }
    if (!phone.trim() || phone.replace(/\D/g, "").length < 10) { setErrorMsg("A valid 10-digit mobile number is required."); return; }
    if (!department) { setErrorMsg("Please select your Department."); return; }
    if (!year) { setErrorMsg("Please select your Year."); return; }
    setStep("review");
  }

  // ── Step 2 → 3: Create pending registration, go to payment ──
  // IMPORTANT: Registration is created HERE — before payment.
  // The pendingId is immediately persisted to localStorage so that
  // a browser refresh during/after payment can resume the same registration.
  async function handleProceedToPayment() {
    setIsLoading(true);
    setErrorMsg("");
    try {
      const regRes = await fetch("/api/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          registerNo: form.registerNo.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          department: form.department,
          year: form.year,
        }),
      });
      const regData = await regRes.json();
      if (!regRes.ok) {
        if (regRes.status === 409 && regData.code === "SEATS_FULL") {
          setErrorMsg("⚠ Registrations are now closed — all 180 seats have been filled. Thank you for your interest!");
        } else if (regRes.status === 409 && regData.code === "DUPLICATE") {
          // Their registration already exists — try to resume it
          if (regData.existingId) {
            lsSave(LS_PENDING_ID, regData.existingId);
            lsSave(LS_PENDING_FORM, form);
            setPendingId(regData.existingId);
            setStep("payment");
            return;
          }
          setErrorMsg(regData.message || "A registration already exists for this Register Number.");
        } else {
          setErrorMsg(regData.message || "Failed to create registration. Please try again.");
        }
        return;
      }

      // ✅ Persist immediately — survives page refresh
      lsSave(LS_PENDING_ID, regData.pendingId);
      lsSave(LS_PENDING_FORM, form);

      setPendingId(regData.pendingId);
      setStep("payment");
    } catch {
      setErrorMsg("Network error. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  }

  // ── Screenshot upload handler ──
  function handleScreenshotUpload(e: React.ChangeEvent<HTMLInputElement>) {
    setScreenshotError("");
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setScreenshotError("Please upload a JPG, PNG, or WEBP image.");
      return;
    }
    if (file.size > MAX_SCREENSHOT_SIZE_MB * 1024 * 1024) {
      setScreenshotError("Screenshot must be smaller than 5 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      setScreenshot(ev.target?.result as string);
      setScreenshotFile(file);
      setScreenshotName(file.name);
    };
    reader.readAsDataURL(file);
  }

  function removeScreenshot() {
    setScreenshot(null);
    setScreenshotFile(null);
    setScreenshotName("");
    setScreenshotError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // ── Step 3 → 4: Submit UTR ──
  async function handleSubmitUTR() {
    setErrorMsg("");
    const trimmed = utr.trim();
    if (!screenshot || !screenshotFile) { setErrorMsg("Please upload your payment screenshot."); return; }
    if (!trimmed) { setErrorMsg("Please enter your UTR / Transaction ID."); return; }
    if (trimmed.length < 6) { setErrorMsg("UTR / Transaction ID seems too short. Please check and try again."); return; }
    if (trimmed.length > 50) { setErrorMsg("UTR / Transaction ID is too long. Please check and try again."); return; }

    setStep("processing");

    try {
      const formData = new FormData();
      formData.append("pendingId", pendingId);
      formData.append("utr", trimmed);
      formData.append("screenshot", screenshotFile);
      formData.append("screenshotName", screenshotName);

      const res = await fetch("/api/payment/submit-utr", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.message || "Failed to submit payment details.");
        setStep("payment");
        return;
      }

      const submitted: SubmittedData = {
        pendingReferenceId: data.pendingReferenceId,
        utr: trimmed,
        paymentStatus: "SUBMITTED",
        registrationStatus: "PENDING_VERIFICATION",
        amount: 250,
      };
      setSubmittedData(submitted);

      // localStorage already has the pendingId from when registration was created.
      // We keep it until confirmed/rejected so the WhatsApp/pending screen is
      // also resumable. No need to re-save sensitive data.

      setStep("whatsapp"); // Show WhatsApp join step before the status screen
    } catch {
      setErrorMsg("Network error while submitting. Please try again.");
      setStep("payment");
    }
  }

  // ── Check if admin has verified/rejected ──
  // Calls the real MongoDB status endpoint.
  async function checkAdminStatus() {
    setErrorMsg("");
    try {
      const res = await fetch(`/api/registrations/${pendingId}/status`);
      if (!res.ok) {
        setErrorMsg("Could not fetch status. Please try again.");
        return;
      }
      const data = await res.json();
      if (data.registrationStatus === "CONFIRMED" || data.registrationStatus === "REJECTED") {
        setAdminStatus({
          registrationStatus: data.registrationStatus,
          registrationId: data.registrationId,
          verifiedAt: data.verifiedAt,
          rejectedAt: data.rejectedAt,
          rejectionReason: data.rejectionReason,
        });
      } else {
        setAdminStatus(null);
        setErrorMsg("Payment is still pending verification by the event organisers.");
      }
    } catch {
      setErrorMsg("Network error. Please check your connection and try again.");
    }
  }

  // ── Reset — also clears localStorage so next participant starts fresh ──
  function reset() {
    lsClear(LS_PENDING_ID, LS_PENDING_FORM);
    setStep("form");
    setForm(initialForm);
    setErrorMsg("");
    setPendingId("");
    setUtr("");
    setScreenshot(null);
    setScreenshotFile(null);
    setScreenshotName("");
    setScreenshotError("");
    setSubmittedData(null);
    setAdminStatus(null);
    setQrError(false);
    setIsLoading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const isSubmitted   = step === "submitted";
  const isWhatsapp    = step === "whatsapp";
  const pastPayment   = (["whatsapp", "submitted"] as string[]).includes(step);

  // Progress step states for the 5-step bar
  // ("resuming" step shows no active indicator while loading)
  const progStates = {
    details:   { active: step === "form",                    done: !(["form","resuming"] as string[]).includes(step) },
    review:    { active: step === "review",                  done: (["payment","processing","whatsapp","submitted"] as string[]).includes(step) },
    payment:   { active: (["payment","processing"] as string[]).includes(step), done: pastPayment },
    joinGroup: { active: isWhatsapp,                         done: isSubmitted },
    confirm:   { active: false,                              done: false, waiting: isSubmitted },
  };

  return (
    <div className="registration-card">

      {/* ── Progress bar ── */}
      <div className="reg-progress" role="progressbar" aria-label="Registration steps">
        <ProgStep num={1} label="DETAILS"    active={progStates.details.active}   done={progStates.details.done} />
        <div className="prog-line" />
        <ProgStep num={2} label="REVIEW"     active={progStates.review.active}    done={progStates.review.done} />
        <div className="prog-line" />
        <ProgStep num={3} label="PAYMENT"    active={progStates.payment.active}   done={progStates.payment.done} />
        <div className="prog-line" />
        <ProgStep num={4} label="JOIN GROUP" active={progStates.joinGroup.active} done={progStates.joinGroup.done} />
        <div className="prog-line" />
        <ProgStep num={5} label="CONFIRM"    active={false} done={false} waiting={progStates.confirm.waiting} />
      </div>

      {/* ════════════════════════════════════════
          RESUMING — shown while checking localStorage + server
          (replaces the "flash of empty form" on page load)
      ════════════════════════════════════════ */}
      {step === "resuming" && (
        <div className="resuming-wrap">
          <Loader2 size={36} className="spin-icon resuming-spinner" />
          <p className="resuming-text">RESUMING YOUR REGISTRATION…</p>
          <small className="resuming-sub">Checking for an existing session</small>
        </div>
      )}

      {/* ════════════════════════════════════════
          STEP 1 — FORM
      ════════════════════════════════════════ */}
      {step === "form" && (
        <>
          <div className="form-title">
            <span>01</span>
            <div><b>PERSONAL DETAILS</b><small>Tell us who you are</small></div>
          </div>
          <div className="form-grid">
            <Field label="Full Name" value={form.name} onChange={(v) => update("name", v)} placeholder="Your full name" />
            <Field label="Register Number" value={form.registerNo} onChange={(v) => update("registerNo", v)} placeholder="e.g. 9923000000" />
            <Field label="KARE Email" type="email" value={form.email} onChange={(v) => update("email", v)} placeholder="you@klu.ac.in" />
            <Field label="Mobile Number" value={form.phone} onChange={(v) => update("phone", v)} placeholder="10-digit mobile number" />
          </div>

          <div className="form-title second">
            <span>02</span>
            <div><b>ACADEMIC DETAILS</b><small>Help us place you correctly</small></div>
          </div>
          <div className="form-grid">
            <SelectField label="Department" value={form.department} onChange={(v) => update("department", v)} options={DEPARTMENTS} />
            <SelectField label="Year" value={form.year} onChange={(v) => update("year", v)} options={YEARS} />
          </div>

          {errorMsg && <div className="error-box" role="alert">{errorMsg}</div>}

          <div className="payment-row">
            <div><small>REGISTRATION FEE</small><strong>₹250</strong></div>
            <button className="primary-button" onClick={handleProceedToReview} id="btn-proceed-review">
              PROCEED · ₹250 <ArrowRight size={18} />
            </button>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════
          STEP 2 — REVIEW
      ════════════════════════════════════════ */}
      {step === "review" && (
        <div className="step-section">
          <div className="step-header">
            <span className="brush-label">REVIEW YOUR REGISTRATION</span>
            <h3 className="step-heading-text">Confirm your details.</h3>
            <p className="step-subtext">Please verify everything before proceeding to payment.</p>
          </div>

          <div className="review-event-block">
            <small>REGISTERING FOR</small>
            <p className="review-event-name">PRODUCT DESIGN AND MARKET DRIVEN INNOVATION</p>
            <div className="review-event-meta">
              <span><CalendarDays size={13} /> October 3 &amp; 4, 2026</span>
              <span><MapPin size={13} /> Admin Block · Seminar Hall</span>
            </div>
          </div>

          <div className="review-details">
            <ReviewRow label="Full Name"       value={form.name} />
            <ReviewRow label="Register Number" value={form.registerNo} />
            <ReviewRow label="KARE Email"      value={form.email} />
            <ReviewRow label="Mobile Number"   value={form.phone} />
            <ReviewRow label="Department"      value={form.department} />
            <ReviewRow label="Year"            value={form.year} />
          </div>

          <div className="review-fee-block">
            <span className="review-fee-label">REGISTRATION FEE</span>
            <span className="review-fee-amount">₹250/-</span>
          </div>

          {errorMsg && <div className="error-box" role="alert">{errorMsg}</div>}

          <div className="step-actions">
            <button className="step-back-btn" onClick={() => { setStep("form"); setErrorMsg(""); }}>
              <ArrowLeft size={15} /> Edit Details
            </button>
            <button className="primary-button" onClick={handleProceedToPayment} disabled={isLoading} id="btn-proceed-payment">
              {isLoading
                ? <><Loader2 size={16} className="spin-icon" /> PREPARING...</>
                : <>PROCEED TO PAYMENT · ₹250 <ArrowRight size={18} /></>}
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════
          STEP 3 — PAYMENT (UPI QR)
      ════════════════════════════════════════ */}
      {step === "payment" && (
        <div className="step-section">
          <div className="step-header">
            <span className="brush-label">COMPLETE PAYMENT</span>
            <h3 className="step-heading-text">Scan &amp; Pay.</h3>
          </div>

          {/* Event summary */}
          <div className="pay-summary-box">
            <div className="pay-event-name">PRODUCT DESIGN AND MARKET DRIVEN INNOVATION</div>
            <div className="pay-meta-row"><CalendarDays size={13} /> October 3 &amp; 4, 2026 &nbsp;·&nbsp; <MapPin size={13} /> Admin Block · Seminar Hall</div>
            <div className="pay-amount-row">
              <span>Registration Fee</span>
              <strong>₹250/-</strong>
            </div>
          </div>

          {/* ── QR Payment box ── */}
          <div className="qr-payment-box">

            {/* Amount */}
            <div className="qr-amount-banner">
              <span className="qr-amount-label">AMOUNT TO PAY</span>
              <span className="qr-amount-value">₹250/-</span>
            </div>

            {/* QR code */}
            <div className="qr-code-wrap">
              <p className="qr-scan-label">Scan to pay using any UPI app</p>

              {!qrError ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src="/assets/scorecraft-payment-qr.png"
                  alt="SCORECRAFT UPI payment QR code — scan to pay ₹250"
                  className="qr-code-img"
                  onError={() => setQrError(true)}
                />
              ) : (
                <div className="qr-placeholder">
                  <span className="qr-placeholder-icon">▣</span>
                  <p>QR code image not found.</p>
                  <small>Place the official QR image at:<br /><code>/public/assets/scorecraft-payment-qr.png</code></small>
                </div>
              )}

              <div className="qr-upi-apps">
                <span className="qr-apps-label">UPI PAYMENT</span>
                <div className="qr-apps-list">
                  <span>Google Pay</span>
                  <span className="qr-dot">·</span>
                  <span>PhonePe</span>
                  <span className="qr-dot">·</span>
                  <span>Paytm</span>
                  <span className="qr-dot">·</span>
                  <span>BHIM</span>
                </div>
              </div>
            </div>

            {/* Important warning */}
            <div className="qr-amount-warning">
              <span className="qr-warning-icon">⚠</span>
              <span>Please pay <strong>exactly ₹250/-</strong>. Incorrect amounts cannot be verified.</span>
            </div>

            {/* How to pay instructions */}
            <div className="qr-instructions">
              <p className="qr-instructions-title">HOW TO PAY</p>
              <ol className="qr-steps-list">
                <li>Open your UPI app (Google Pay, PhonePe, Paytm, BHIM, etc.)</li>
                <li>Scan the QR code above.</li>
                <li>Pay exactly <strong>₹250/-</strong> and complete the transaction.</li>
                <li>After payment, your UPI app will show a <strong>UTR / Transaction ID</strong>.</li>
                <li>Copy that UTR / Transaction ID.</li>
                <li>Enter it in the field below and submit.</li>
              </ol>
            </div>
          </div>

          {/* ── UTR input ── */}
          <div className="utr-section">
            <label className="utr-label" htmlFor="utr-input">
              <span className="utr-label-text">PAYMENT REFERENCE</span>
              <span className="utr-label-sub">UTR / Transaction ID *</span>
            </label>
            <input
              id="utr-input"
              type="text"
              className="utr-input"
              value={utr}
              onChange={(e) => setUtr(e.target.value)}
              placeholder="e.g. 123456789012"
              maxLength={50}
              autoComplete="off"
            />
            <p className="utr-helper">
              Enter the transaction or reference number shown in your UPI app after successful payment.
              <br />
              <span className="utr-helper-warn">Do not enter your Register Number here.</span>
            </p>
          </div>

          {/* ── Payment screenshot upload ── */}
          <div className="screenshot-section">
            <div className="screenshot-label-row">
              <span className="utr-label-text">PAYMENT SCREENSHOT</span>
              <span className="screenshot-optional-badge">REQUIRED</span>
            </div>
            <p className="screenshot-desc">
              Upload a screenshot of your payment confirmation from your UPI app.
              This is required so the admin can verify your payment.
            </p>

            {!screenshot ? (
              <label className="screenshot-upload-area" htmlFor="screenshot-input">
                <ImagePlus size={28} className="screenshot-upload-icon" />
                <span className="screenshot-upload-text">Click to upload payment screenshot</span>
                <span className="screenshot-upload-hint">JPG, PNG, WEBP · Max {MAX_SCREENSHOT_SIZE_MB}MB</span>
                <input
                  id="screenshot-input"
                  ref={fileInputRef}
                  type="file"
                  required
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={handleScreenshotUpload}
                  className="screenshot-file-input"
                />
              </label>
            ) : (
              <div className="screenshot-preview-wrap">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={screenshot}
                  alt="Payment screenshot preview"
                  className="screenshot-preview-img"
                />
                <div className="screenshot-preview-meta">
                  <span className="screenshot-preview-name">{screenshotName}</span>
                  <button className="screenshot-remove-btn" onClick={removeScreenshot} type="button">
                    <Trash2 size={14} /> Remove
                  </button>
                </div>
              </div>
            )}

            {screenshotError && (
              <p className="screenshot-error" role="alert">{screenshotError}</p>
            )}
          </div>

          {errorMsg && <div className="error-box" role="alert">{errorMsg}</div>}

          <div className="step-actions">
            <button className="step-back-btn" onClick={() => { setStep("review"); setErrorMsg(""); }}>
              <ArrowLeft size={15} /> Back to Review
            </button>
            <button className="primary-button" onClick={handleSubmitUTR} id="btn-submit-utr">
              SUBMIT PAYMENT DETAILS <ArrowRight size={18} />
            </button>
          </div>

          <div className="pay-security-note">
            <ShieldCheck size={14} />
            <span>Your payment will be verified by the event organisers before confirmation.</span>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════
          PROCESSING
      ════════════════════════════════════════ */}
      {step === "processing" && (
        <div className="step-processing">
          <Loader2 size={56} className="processing-spinner" />
          <h3 className="processing-title">SUBMITTING...</h3>
          <p className="processing-note">Saving your payment details. Please wait.</p>
        </div>
      )}

      {/* ════════════════════════════════════════
          STEP 4 — SUBMITTED (PENDING VERIFICATION)
          NOT the same as confirmed. Admin must verify.
      ════════════════════════════════════════ */}
      {step === "submitted" && submittedData && (
        <div className="step-submitted">

          {/* If admin has verified or rejected */}
          {adminStatus?.registrationStatus === "CONFIRMED" && (
            <div className="admin-confirmed-banner">
              <span className="admin-confirmed-icon">✓</span>
              <div>
                <b>REGISTRATION CONFIRMED</b>
                <p>Registration ID: <strong>{adminStatus.registrationId}</strong></p>
                <p className="small-muted">Verified at {adminStatus.verifiedAt ? new Date(adminStatus.verifiedAt).toLocaleString() : ""}</p>
              </div>
            </div>
          )}

          {adminStatus?.registrationStatus === "REJECTED" && (
            <div className="admin-rejected-banner">
              <span className="admin-rejected-icon"><XCircle size={28} /></span>
              <div>
                <b>PAYMENT COULD NOT BE VERIFIED</b>
                {adminStatus.rejectionReason && <p>Reason: {adminStatus.rejectionReason}</p>}
                <p className="small-muted">Please contact the event coordinators.</p>
              </div>
            </div>
          )}

          {/* Default: pending verification */}
          {!adminStatus && (
            <>
              <div className="pending-icon-wrap">
                <Clock3 size={48} />
              </div>
              <span className="brush-label">PAYMENT DETAILS SUBMITTED</span>
              <h3 className="pending-heading">Pending Verification</h3>
              <p className="pending-desc">
                Your payment details have been submitted to the event organisers for verification.
                Your registration will be confirmed after the payment is verified.
              </p>
            </>
          )}

          {/* Reference block */}
          <div className="pending-ref-block">
            <small>PENDING REFERENCE</small>
            <div className="pending-ref-id">{submittedData.pendingReferenceId}</div>
            <small className="small-muted">Save this reference number. Your final Registration ID will be issued after verification.</small>
          </div>

          {/* Summary table */}
          <div className="confirmed-details">
            <ConfRow label="Participant"      value={form.name} />
            <ConfRow label="Register No."     value={form.registerNo} />
            <ConfRow label="Department"       value={form.department} />
            <ConfRow label="Amount"           value="₹250/-" />
            <ConfRow label="Payment Method"   value="UPI QR" />
            <ConfRow label="UTR / Txn ID"     value={submittedData.utr} mono />
            <ConfRow label="Screenshot"       value={screenshot ? `✓ ${screenshotName}` : "Not uploaded"} />
            <ConfRow label="Payment Status"   value="SUBMITTED — PENDING VERIFICATION" highlight />
          </div>

          {/* Screenshot thumbnail on submitted page */}
          {screenshot && (
            <div className="submitted-screenshot-wrap">
              <span className="utr-label-text">PAYMENT SCREENSHOT SUBMITTED</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={screenshot}
                alt="Your submitted payment screenshot"
                className="submitted-screenshot-img"
              />
            </div>
          )}

          {errorMsg && <div className="error-box" role="alert">{errorMsg}</div>}

          {/* Check status button */}
          {!adminStatus && (
            <button className="check-status-btn" onClick={checkAdminStatus} id="btn-check-status">
              <ArrowRight size={15} /> Check Registration Status
            </button>
          )}

          <div className="pending-footer-note">
            After verification, you will receive your final Registration ID.
            Keep this page or note your Pending Reference number.
          </div>

          <div className="confirmed-actions">
            <button className="secondary-button" onClick={() => window.print()} id="btn-print-pending">
              <Download size={15} /> Save / Print
            </button>
            <button className="secondary-button" onClick={reset} id="btn-register-another">
              Register Another Participant
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════
          STEP 4 — JOIN WHATSAPP GROUP
      ════════════════════════════════════════ */}
      {step === "whatsapp" && (
        <div className="step-section whatsapp-step">
          <div className="step-header">
            <span className="brush-label">STEP 4 OF 4</span>
            <h3 className="step-heading-text">Join the Community</h3>
            <p className="step-subtext">
              Stay updated with workshop announcements, schedule changes,
              and important information.
            </p>
          </div>

          {/* WhatsApp QR card */}
          <div className="wa-qr-card">
            <div className="wa-qr-header">
              <svg className="wa-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              OFFICIAL WHATSAPP GROUP
            </div>

            {/* The real QR code asset */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/scorecraft-whatsapp-qr.png"
              alt="Official SCORECRAFT workshop WhatsApp group QR code"
              className="wa-qr-img"
            />

            <div className="wa-scan-label">SCAN TO JOIN</div>

            <div className="wa-event-label">
              <b>PRODUCT DESIGN AND MARKET DRIVEN INNOVATION</b>
              <small>SCORECRAFT</small>
            </div>

            {/* Join button — opens invite link in new tab */}
            {process.env.NEXT_PUBLIC_WHATSAPP_GROUP_URL && (
              <a
                href={process.env.NEXT_PUBLIC_WHATSAPP_GROUP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="primary-button wa-join-btn"
                aria-label="Join WhatsApp Group"
                id="btn-join-whatsapp"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" width={16} height={16} aria-hidden="true">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                JOIN WHATSAPP GROUP →
              </a>
            )}
          </div>

          {/* Status note */}
          <div className="wa-status-note">
            Your payment details have been submitted and are&nbsp;
            <strong>pending verification</strong> by the event organisers.
          </div>

          {/* Continue button */}
          <div className="wa-continue-row">
            <button
              className="primary-button"
              onClick={() => setStep("submitted")}
              id="btn-wa-continue"
              aria-label="Continue to registration status"
            >
              CONTINUE TO REGISTRATION STATUS <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════
          FAILED
      ════════════════════════════════════════ */}
      {step === "failed" && (
        <div className="step-failed">
          <div className="failed-icon-wrap"><XCircle size={52} /></div>
          <h3 className="failed-heading">SUBMISSION FAILED</h3>
          <p className="failed-desc">Your payment details could not be submitted. Please try again.</p>
          {errorMsg && <div className="error-box" role="alert">{errorMsg}</div>}
          <div className="step-actions">
            <button className="step-back-btn" onClick={() => { setStep("payment"); setErrorMsg(""); }}>
              <ArrowLeft size={15} /> Back to Payment
            </button>
            <button className="primary-button" onClick={() => { setStep("form"); setErrorMsg(""); }}>
              Start Again <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────

function ProgStep({
  num, label, active, done, waiting,
}: { num: number; label: string; active: boolean; done: boolean; waiting?: boolean }) {
  return (
    <div className={`prog-step ${active ? "prog-active" : ""} ${done ? "prog-done" : ""} ${waiting ? "prog-waiting" : ""}`}>
      <div className="prog-num" aria-hidden="true">
        {done ? "✓" : waiting ? "⏳" : num}
      </div>
      <span className="prog-label">{label}</span>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="review-row">
      <span className="review-row-label">{label}</span>
      <b className="review-row-value">{value}</b>
    </div>
  );
}

function ConfRow({
  label, value, highlight, mono,
}: { label: string; value: string; highlight?: boolean; mono?: boolean }) {
  return (
    <div className={`conf-row ${highlight ? "conf-row-highlight" : ""}`}>
      <span>{label}</span>
      <b className={mono ? "conf-mono" : ""}>{value}</b>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder: string; type?: string;
}) {
  return (
    <label className="field-label">
      {label}
      <input required type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </label>
  );
}

function SelectField({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <label className="field-label">
      {label}
      <select required value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select</option>
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
    </label>
  );
}
