import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { success: false, error: { message: "Unauthorized" } },
      { status: 401 }
    );
  }

  // Return stub when Cloudinary is not configured (or still has placeholder values)
  const cn = process.env.CLOUDINARY_CLOUD_NAME;
  const ck = process.env.CLOUDINARY_API_KEY;
  const cs = process.env.CLOUDINARY_API_SECRET;
  if (!cn || cn.includes("REPLACE") || !ck || ck.includes("REPLACE") || !cs || cs.includes("REPLACE")) {
    return NextResponse.json({
      success: true,
      data: {
        url: "https://placehold.co/1080x1080/e2e8f0/94a3b8?text=Preview+Unavailable",
        publicId: "stub",
        format: "jpg",
        width: 1080,
        height: 1080,
        bytes: 0,
      },
    });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json(
      { success: false, error: { message: "No file provided" } },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { success: false, error: { message: "File exceeds 50 MB limit" } },
      { status: 400 }
    );
  }

  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "video/mp4",
    "video/quicktime",
  ];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json(
      { success: false, error: { message: "Unsupported file type" } },
      { status: 400 }
    );
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = `data:${file.type};base64,${buffer.toString("base64")}`;

    const result = await cloudinary.uploader.upload(base64, {
      folder: "adcompliance-pro/assets",
      resource_type: "auto",
    });

    return NextResponse.json({
      success: true,
      data: {
        url: result.secure_url,
        publicId: result.public_id,
        format: result.format,
        width: result.width,
        height: result.height,
        bytes: result.bytes,
      },
    });
  } catch (err) {
    console.error("[upload] Cloudinary error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: { message } },
      { status: 500 }
    );
  }
}
