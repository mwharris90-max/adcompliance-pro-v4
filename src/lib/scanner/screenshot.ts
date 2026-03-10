/**
 * Website screenshot capture via Browserless.io (remote headless Chrome).
 *
 * Connects to a remote Chrome instance via WebSocket — no local Chromium
 * binary needed, so it works within Vercel's serverless function size limits.
 *
 * Free tier: 1,000 units/month (1 unit = 30s of browser time).
 * Set BROWSERLESS_TOKEN in your environment variables.
 *
 * Falls back to ApiFlash if BROWSERLESS_TOKEN is not set but
 * APIFLASH_ACCESS_KEY is available (clean screenshot only, no annotations).
 */

import puppeteer from "puppeteer-core";

export interface AnnotationBox {
  label: string;
  severity: "pass" | "warning" | "fail";
  selector?: string;
  region?: "header" | "footer" | "full-page-banner";
}

export interface ScreenshotResult {
  /** Viewport screenshot without annotations (PNG buffer) */
  clean: Buffer;
  /** Viewport screenshot with coloured annotation overlays (PNG buffer), or null if no annotations */
  annotated: Buffer | null;
}

/**
 * Capture a page screenshot and overlay compliance annotation boxes.
 *
 * Uses Browserless.io for remote headless Chrome with DOM injection.
 * Falls back to ApiFlash (clean-only) if Browserless is not configured.
 */
export async function captureScreenshot(
  url: string,
  annotations: AnnotationBox[] = []
): Promise<ScreenshotResult> {
  const browserlessToken = process.env.BROWSERLESS_TOKEN;

  if (browserlessToken) {
    return captureViaBrowserless(url, annotations, browserlessToken);
  }

  // Fallback: ApiFlash (clean screenshot only, no annotations)
  const apiflashKey = process.env.APIFLASH_ACCESS_KEY;
  if (apiflashKey) {
    return captureViaApiFlash(url, apiflashKey);
  }

  throw new Error("No screenshot service configured. Set BROWSERLESS_TOKEN or APIFLASH_ACCESS_KEY.");
}

// ── Browserless (full annotation support) ──────────────────────────────────

async function captureViaBrowserless(
  url: string,
  annotations: AnnotationBox[],
  token: string
): Promise<ScreenshotResult> {
  const browser = await puppeteer.connect({
    browserWSEndpoint: `wss://production-sfo.browserless.io?token=${token}`,
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });

    // Brief pause for above-the-fold content to render
    await page.evaluate(() => new Promise((r) => setTimeout(r, 500)));

    // -- Clean screenshot --
    const cleanBuffer = await page.screenshot({ type: "png", fullPage: false });

    // -- Inject annotation overlays --
    let annotatedBuffer: Buffer | null = null;

    if (annotations.length > 0) {
      await page.evaluate((anns: AnnotationBox[]) => {
        const COLORS = {
          pass: { bg: "rgba(34, 197, 94, 0.15)", border: "#22c55e", text: "#15803d" },
          warning: { bg: "rgba(245, 158, 11, 0.15)", border: "#f59e0b", text: "#b45309" },
          fail: { bg: "rgba(239, 68, 68, 0.2)", border: "#ef4444", text: "#b91c1c" },
        };

        for (const ann of anns) {
          const color = COLORS[ann.severity];
          let targetEl: Element | null = null;

          // Try to find the element by selector
          if (ann.selector) {
            targetEl = document.querySelector(ann.selector);
          }

          // Fall back to region-based targeting
          if (!targetEl && ann.region) {
            switch (ann.region) {
              case "footer":
                targetEl = document.querySelector("footer") || document.querySelector("[role=contentinfo]");
                break;
              case "header":
                targetEl = document.querySelector("header") || document.querySelector("[role=banner]") || document.querySelector("nav");
                break;
              case "full-page-banner":
                break;
            }
          }

          if (targetEl) {
            const rect = targetEl.getBoundingClientRect();
            const overlay = document.createElement("div");
            overlay.style.cssText = `
              position: fixed;
              top: ${rect.top}px;
              left: ${rect.left}px;
              width: ${rect.width}px;
              height: ${rect.height}px;
              background: ${color.bg};
              border: 2px solid ${color.border};
              border-radius: 4px;
              z-index: 999999;
              pointer-events: none;
              box-sizing: border-box;
            `;
            const label = document.createElement("div");
            label.textContent = ann.label;
            label.style.cssText = `
              position: absolute;
              top: -22px;
              left: 0;
              background: ${color.border};
              color: white;
              font-size: 11px;
              font-weight: bold;
              padding: 2px 8px;
              border-radius: 3px 3px 0 0;
              white-space: nowrap;
              font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            `;
            overlay.appendChild(label);
            document.body.appendChild(overlay);
          } else if (ann.region === "full-page-banner") {
            const banner = document.createElement("div");
            banner.style.cssText = `
              position: fixed;
              top: 0;
              left: 0;
              right: 0;
              background: ${color.border};
              color: white;
              font-size: 13px;
              font-weight: bold;
              padding: 8px 16px;
              z-index: 999999;
              text-align: center;
              font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            `;
            banner.textContent = ann.label;
            document.body.appendChild(banner);
          }
        }
      }, annotations);

      annotatedBuffer = Buffer.from(
        await page.screenshot({ type: "png", fullPage: false })
      );
    }

    return {
      clean: Buffer.from(cleanBuffer),
      annotated: annotatedBuffer,
    };
  } finally {
    await browser.close();
  }
}

// ── ApiFlash fallback (clean screenshot only) ──────────────────────────────

async function captureViaApiFlash(
  url: string,
  accessKey: string
): Promise<ScreenshotResult> {
  const params = new URLSearchParams({
    access_key: accessKey,
    url,
    format: "png",
    width: "1280",
    height: "800",
    full_page: "false",
    delay: "3",
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

  return { clean: buffer, annotated: null };
}

/**
 * Build annotation boxes from scan findings.
 * Maps compliance findings to DOM selectors / page regions.
 */
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
      annotations.push({ label: f.title, severity: f.severity, selector: "img:not([alt]), img[alt='']" });
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
