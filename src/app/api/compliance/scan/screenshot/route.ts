import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { v2 as cloudinary } from "cloudinary";
import { captureScreenshot } from "@/lib/scanner/screenshot";
import { internalError } from "@/lib/api-error";

export const maxDuration = 60;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function uploadBuffer(buffer: Buffer, folder: string, publicId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        resource_type: "image",
        format: "png",
        overwrite: true,
      },
      (err, result) => {
        if (err) reject(err);
        else resolve(result!.secure_url);
      }
    );
    stream.end(buffer);
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check required services are configured
  if (!process.env.APIFLASH_ACCESS_KEY) {
    return NextResponse.json(
      { error: "Screenshot service not configured. APIFLASH_ACCESS_KEY is missing." },
      { status: 503 }
    );
  }

  if (
    !process.env.CLOUDINARY_CLOUD_NAME ||
    !process.env.CLOUDINARY_API_KEY ||
    !process.env.CLOUDINARY_API_SECRET
  ) {
    return NextResponse.json(
      { error: "Image storage not configured." },
      { status: 503 }
    );
  }

  try {
    const body = await req.json();
    const { url } = body as { url: string };

    if (!url?.trim()) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Capture screenshot via ApiFlash
    const { clean } = await captureScreenshot(url);

    // Upload to Cloudinary
    const timestamp = Date.now();
    const hostname = new URL(url).hostname.replace(/\./g, "-");
    const folder = `scan-screenshots/${session.user.id}`;

    const cleanUrl = await uploadBuffer(clean, folder, `${hostname}-${timestamp}`);

    return NextResponse.json({
      success: true,
      screenshots: {
        clean: cleanUrl,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("APIFLASH") || message.includes("ApiFlash")) {
      return NextResponse.json(
        { error: "Screenshot service unavailable. Please try again later." },
        { status: 503 }
      );
    }
    return internalError(err, "POST /api/compliance/scan/screenshot");
  }
}
