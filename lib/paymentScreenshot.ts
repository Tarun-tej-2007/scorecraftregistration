import { Db, GridFSBucket, ObjectId } from "mongodb";
import mongoose from "mongoose";

const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;

type ScreenshotData = {
  buffer: Buffer;
  contentType: "image/jpeg" | "image/png" | "image/webp";
};

function getBucket() {
  const db = mongoose.connection.db;
  if (!db) throw new Error("MongoDB connection is not ready.");
  // Mongoose and the direct driver can expose different compatible Db typings.
  return new GridFSBucket(db as unknown as Db, { bucketName: "paymentScreenshots" });
}

export function validatePaymentScreenshot(buffer: Buffer, contentTypeValue: unknown): ScreenshotData {
  if (typeof contentTypeValue !== "string") throw new Error("Please upload a JPG, PNG, or WEBP image.");

  const contentType = contentTypeValue.toLowerCase() as ScreenshotData["contentType"];
  if (!buffer.length || buffer.length > MAX_SCREENSHOT_BYTES) {
    throw new Error("Screenshot must be smaller than 5 MB.");
  }

  const isJpeg = contentType === "image/jpeg" && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng = contentType === "image/png" && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const isWebp = contentType === "image/webp" && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
  if (!isJpeg && !isPng && !isWebp) throw new Error("Please upload a JPG, PNG, or WEBP image.");

  return { buffer, contentType };
}

export async function storePaymentScreenshot(data: ScreenshotData, originalName: unknown) {
  const bucket = getBucket();
  const key = new ObjectId();
  const filename = `payment-${key.toHexString()}`;
  const upload = bucket.openUploadStreamWithId(key, filename, {
    metadata: {
      contentType: data.contentType,
      originalName: typeof originalName === "string" ? originalName.slice(0, 180) : null,
    },
  });

  await new Promise<void>((resolve, reject) => {
    upload.once("finish", resolve);
    upload.once("error", reject);
    upload.end(data.buffer);
  });

  return key.toHexString();
}

export async function readPaymentScreenshot(key: string) {
  if (!ObjectId.isValid(key)) return null;
  const bucket = getBucket();
  const file = await bucket.find({ _id: new ObjectId(key) }).next();
  if (!file) return null;
  return { file, stream: bucket.openDownloadStream(new ObjectId(key)) };
}