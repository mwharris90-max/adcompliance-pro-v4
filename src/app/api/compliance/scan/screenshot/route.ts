import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { v2 as cloudinary } from "cloudinary";
import { captureScreenshot, buildAnnotations } from "@/lib/scanner/screenshot";
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

  // Check Cloudinary is configured
  if (
    !process.env.CLOUDINARY_CLOUD_NAME ||
    !process.env.CLOUDINARY_API_KEY ||
    !process.env.CLOUDINARY_API_SECRET
  ) {
    return NextResponse.json(
      { error: "Screenshot service not configured" },
      { status: 503 }
    );
  }

  try {
    const body = await req.json();
    const { url, findings } = body as {
      url: string;
      findings: {
        severity: "pass" | "warning" | "fail";
        category: string;
        title: string;
      }[];
    };

    if (!url?.trim()) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Build annotations from findings
    const annotations = buildAnnotations(findings ?? []);

    // Capture screenshots
    const { clean, annotated } = await captureScreenshot(url, annotations);

    // Upload to Cloudinary
    const timestamp = Date.now();
    const hostname = new URL(url).hostname.replace(/\./g, "-");
    const folder = `scan-screenshots/${session.user.id}`;

    const [cleanUrl, annotatedUrl] = await Promise.all([
      uploadBuffer(clean, folder, `${hostname}-clean-${timestamp}`),
      uploadBuffer(annotated, folder, `${hostname}-annotated-${timestamp}`),
    ]);

    return NextResponse.json({
      success: true,
      screenshots: {
        clean: cleanUrl,
        annotated: annotatedUrl,
      },
    });
  } catch (err) {
    // Provide a more helpful error for Chromium issues
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("chromium") || message.includes("browser") || message.includes("launch")) {
      return NextResponse.json(
        { error: "Screenshot capture unavailable. Headless browser failed to launch." },
        { status: 503 }
      );
    }
    return internalError(err, "POST /api/compliance/scan/screenshot");
  }
}
