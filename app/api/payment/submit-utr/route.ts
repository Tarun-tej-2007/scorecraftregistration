import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Registration } from "@/lib/models/Registration";

// ─────────────────────────────────────────────────────────
// POST /api/payment/submit-utr
//
// Accepts multipart/form-data (because the frontend sends
// the screenshot as a real File object via FormData).
//
// Fields:
//   pendingId      — MongoDB _id of the registration
//   utr            — UTR / Transaction ID string
//   screenshot     — image File (optional but encouraged)
//   screenshotName — original filename
//
// Converts the File to a base64 data URL and stores in MongoDB.
// Changes status: PENDING_PAYMENT → PENDING_VERIFICATION
// ─────────────────────────────────────────────────────────

const UTR_MIN = 6;
const UTR_MAX = 50;
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

export async function POST(request: Request) {
  try {
    await connectDB();

    const contentType = request.headers.get("content-type") ?? "";

    let pendingId = "";
    let utr       = "";
    let screenshotBase64: string | null = null;
    let screenshotName: string | null   = null;

    // ── Parse FormData or JSON ──────────────────────────
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();

      pendingId     = (formData.get("pendingId") as string | null)     ?? "";
      utr           = (formData.get("utr")        as string | null)     ?? "";
      screenshotName = (formData.get("screenshotName") as string | null) ?? null;

      const file = formData.get("screenshot") as File | null;
      if (file && file.size > 0) {
        if (file.size > MAX_FILE_BYTES) {
          return NextResponse.json(
            { message: "Screenshot must be smaller than 5 MB." },
            { status: 400 }
          );
        }
        // Convert File → ArrayBuffer → base64 data URL
        const buffer = await file.arrayBuffer();
        const base64 = Buffer.from(buffer).toString("base64");
        screenshotBase64 = `data:${file.type || "image/jpeg"};base64,${base64}`;
        screenshotName    = screenshotName || file.name || "screenshot";
      }
    } else {
      // Fallback: legacy JSON body (screenshot already base64)
      const body = await request.json();
      pendingId      = body.pendingId      ?? "";
      utr            = body.utr            ?? "";
      screenshotBase64 = body.screenshot   ?? null;
      screenshotName   = body.screenshotName ?? null;
    }

    // ── Validation ───────────────────────────────────────
    if (!pendingId) {
      return NextResponse.json({ message: "Missing registration reference." }, { status: 400 });
    }

    const trimmedUtr = utr.toString().trim();
    if (!trimmedUtr) {
      return NextResponse.json({ message: "UTR / Transaction ID is required." }, { status: 400 });
    }
    if (trimmedUtr.length < UTR_MIN || trimmedUtr.length > UTR_MAX) {
      return NextResponse.json(
        { message: `UTR must be ${UTR_MIN}–${UTR_MAX} characters.` },
        { status: 400 }
      );
    }
    if (/<|>|script/i.test(trimmedUtr)) {
      return NextResponse.json({ message: "Invalid characters in UTR." }, { status: 400 });
    }

    // ── Find registration ────────────────────────────────
    const reg = await Registration.findById(pendingId);
    if (!reg) {
      return NextResponse.json({ message: "Registration not found." }, { status: 404 });
    }
    if (reg.registrationStatus === "CONFIRMED") {
      return NextResponse.json({ message: "This registration is already confirmed." }, { status: 409 });
    }
    if (reg.paymentStatus === "SUBMITTED" || reg.paymentStatus === "VERIFIED") {
      return NextResponse.json(
        { message: "Payment details have already been submitted for this registration." },
        { status: 409 }
      );
    }

    // ── Persist ──────────────────────────────────────────
    reg.utr                  = trimmedUtr;
    reg.screenshot           = screenshotBase64;
    reg.screenshotName       = screenshotName;
    reg.paymentStatus        = "SUBMITTED";
    reg.registrationStatus   = "PENDING_VERIFICATION";
    reg.submittedAt          = new Date();
    await reg.save();

    console.log(`[submit-utr] Saved UTR for ${reg.name} — screenshot: ${!!screenshotBase64}`);

    return NextResponse.json({
      success:            true,
      pendingReferenceId: reg.pendingReferenceId,
      utr:                trimmedUtr,
      paymentStatus:      "SUBMITTED",
      registrationStatus: "PENDING_VERIFICATION",
      amount:             reg.amount,
      screenshotSaved:    !!screenshotBase64,
      message:            "Payment details submitted. Pending verification by organisers.",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[POST /api/payment/submit-utr] ERROR:", msg);
    return NextResponse.json({ message: "Server error. Please try again.", detail: msg }, { status: 500 });
  }
}
