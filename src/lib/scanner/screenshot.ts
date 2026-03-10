/**
 * Website screenshot capture using ApiFlash (external service).
 *
 * ApiFlash provides a simple REST API that returns a PNG screenshot.
 * Free tier: 100 screenshots/month, no credit card required.
 *
 * Set APIFLASH_ACCESS_KEY in your environment variables.
 * Sign up at https://apiflash.com to get a free key.
 */

export interface ScreenshotResult {
  /** Clean viewport screenshot (PNG buffer) */
  clean: Buffer;
}

/**
 * Capture a page screenshot via ApiFlash.
 * Returns the screenshot as a PNG buffer ready for upload.
 */
export async function captureScreenshot(
  url: string,
  options?: {
    width?: number;
    height?: number;
    fullPage?: boolean;
    delay?: number;
  }
): Promise<ScreenshotResult> {
  const accessKey = process.env.APIFLASH_ACCESS_KEY;
  if (!accessKey) {
    throw new Error("APIFLASH_ACCESS_KEY is not configured");
  }

  const params = new URLSearchParams({
    access_key: accessKey,
    url,
    format: "png",
    width: String(options?.width ?? 1280),
    height: String(options?.height ?? 800),
    full_page: String(options?.fullPage ?? false),
    delay: String(options?.delay ?? 3),
    fresh: "true",
    quality: "80",
    response_type: "image",
  });

  const apiUrl = `https://api.apiflash.com/v1/urltoimage?${params.toString()}`;

  const response = await fetch(apiUrl, { signal: AbortSignal.timeout(30000) });

  if (!response.ok) {
    const text = await response.text().catch(() => "Unknown error");
    throw new Error(`ApiFlash error ${response.status}: ${text}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.length < 1000) {
    throw new Error("Screenshot appears empty or failed to render");
  }

  return { clean: buffer };
}

/**
 * Build annotation boxes from scan findings.
 * These are used for display in the UI overlay, not for screenshot injection.
 */
export interface AnnotationBox {
  label: string;
  severity: "pass" | "warning" | "fail";
  selector?: string;
  region?: "header" | "footer" | "full-page-banner";
}

export function buildAnnotations(
  findings: { severity: "pass" | "warning" | "fail"; category: string; title: string }[]
): AnnotationBox[] {
  const annotations: AnnotationBox[] = [];

  for (const f of findings) {
    if (f.severity === "pass") continue;

    const titleLower = f.title.toLowerCase();

    if (
      titleLower.includes("privacy") ||
      titleLower.includes("terms") ||
      titleLower.includes("contact") ||
      titleLower.includes("legal")
    ) {
      annotations.push({ label: f.title, severity: f.severity, region: "footer" });
      continue;
    }

    if (titleLower.includes("cookie") || titleLower.includes("consent") || titleLower.includes("gdpr")) {
      annotations.push({ label: f.title, severity: f.severity, region: "full-page-banner" });
      continue;
    }

    if (titleLower.includes("ssl") || titleLower.includes("https") || titleLower.includes("http")) {
      annotations.push({ label: f.title, severity: f.severity, region: "full-page-banner" });
      continue;
    }

    if (titleLower.includes("age") || titleLower.includes("18+") || titleLower.includes("21+")) {
      annotations.push({ label: f.title, severity: f.severity, region: "header" });
      continue;
    }

    if (titleLower.includes("disclaimer") || titleLower.includes("disclosure")) {
      annotations.push({ label: f.title, severity: f.severity, region: "footer" });
      continue;
    }

    if (titleLower.includes("viewport") || titleLower.includes("mobile")) {
      annotations.push({ label: f.title, severity: f.severity, region: "full-page-banner" });
      continue;
    }

    if (titleLower.includes("alt text") || titleLower.includes("image")) {
      annotations.push({ label: f.title, severity: f.severity, selector: "img:not([alt])" });
      continue;
    }
  }

  const seen = new Set<string>();
  return annotations.filter((a) => {
    const key = a.selector || a.region || "";
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
