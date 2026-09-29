import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Registration } from "@/lib/models/Registration";
import { requireAdmin } from "@/lib/adminAuth";
import { readPaymentScreenshot } from "@/lib/paymentScreenshot";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  try {
    await connectDB();
    const { id } = await params;
    const registration = await Registration.findById(id).select("paymentScreenshotKey screenshot").lean();
    if (!registration) return NextResponse.json({ message: "Not found." }, { status: 404 });

    if (registration.paymentScreenshotKey) {
      const stored = await readPaymentScreenshot(registration.paymentScreenshotKey);
      if (!stored) return NextResponse.json({ message: "Screenshot not found." }, { status: 404 });

      const chunks: Buffer[] = [];
      for await (const chunk of stored.stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      return new NextResponse(Buffer.concat(chunks), {
        headers: {
          "Content-Type": (stored.file.metadata?.contentType as string | undefined) ?? "application/octet-stream",
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    // Serve older records that predate private GridFS storage.
    if (registration.screenshot?.startsWith("data:image/")) {
      const match = registration.screenshot.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/i);
      if (match) {
        return new NextResponse(Buffer.from(match[2], "base64"), {
          headers: {
            "Content-Type": match[1].toLowerCase(),
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
          },
        });
      }
    }

    return NextResponse.json({ message: "Screenshot not uploaded." }, { status: 404 });
  } catch (err) {
    console.error("[GET /api/admin/registrations/[id]/payment-screenshot]", err);
    return NextResponse.json({ message: "Server error." }, { status: 500 });
  }
}
