import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

export interface AnnotationBox {
  label: string;
  severity: "pass" | "warning" | "fail";
  selector?: string;
  region?: "header" | "footer" | "full-page-banner";
}

export interface ScreenshotResult {
  /** Viewport screenshot without annotations (PNG buffer) */
  clean: Buffer;
  /** Viewport screenshot with coloured annotation overlays (PNG buffer) */
  annotated: Buffer;
}

/**
 * Capture a page screenshot and overlay compliance annotation boxes.
 *
 * Annotations are drawn by injecting coloured overlay divs into the live page
 * before taking the second screenshot — no image-manipulation library needed.
 */
export async function captureScreenshot(
  url: string,
  annotations: AnnotationBox[] = []
): Promise<ScreenshotResult> {
  // Launch headless Chromium
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: { width: 1280, height: 800 },
    executablePath: await chromium.executablePath(),
    headless: true,
  });

  try {
    const page = await browser.newPage();

    // Set a realistic user-agent
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    // Navigate — domcontentloaded is faster than networkidle2
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });

    // Brief pause for above-the-fold images to render
    await page.evaluate(() => new Promise((r) => setTimeout(r, 500)));

    // -- Clean screenshot --
    const cleanBuffer = await page.screenshot({
      type: "png",
      fullPage: false,
    });

    // -- Inject annotation overlays --
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
                // Create a banner at the top of the viewport
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
            // Label
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
            // Add a banner at the top
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
    }

    // -- Annotated screenshot --
    const annotatedBuffer = await page.screenshot({
      type: "png",
      fullPage: false,
    });

    return {
      clean: Buffer.from(cleanBuffer),
      annotated: Buffer.from(annotatedBuffer),
    };
  } finally {
    await browser.close();
  }
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
    if (f.severity === "pass") continue; // Only annotate issues

    const titleLower = f.title.toLowerCase();

    // Privacy Policy / Terms / Legal links -> footer
    if (
      titleLower.includes("privacy") ||
      titleLower.includes("terms") ||
      titleLower.includes("contact") ||
      titleLower.includes("legal")
    ) {
      annotations.push({
        label: f.title,
        severity: f.severity,
        region: "footer",
      });
      continue;
    }

    // Cookie consent -> header/banner area
    if (titleLower.includes("cookie") || titleLower.includes("consent") || titleLower.includes("gdpr")) {
      annotations.push({
        label: f.title,
        severity: f.severity,
        region: "full-page-banner",
      });
      continue;
    }

    // SSL / HTTPS -> banner
    if (titleLower.includes("ssl") || titleLower.includes("https") || titleLower.includes("http")) {
      annotations.push({
        label: f.title,
        severity: f.severity,
        region: "full-page-banner",
      });
      continue;
    }

    // Age gate -> header area
    if (titleLower.includes("age") || titleLower.includes("18+") || titleLower.includes("21+")) {
      annotations.push({
        label: f.title,
        severity: f.severity,
        region: "header",
      });
      continue;
    }

    // Disclaimer-related -> try specific selectors
    if (titleLower.includes("disclaimer") || titleLower.includes("disclosure")) {
      annotations.push({
        label: f.title,
        severity: f.severity,
        region: "footer",
      });
      continue;
    }

    // Mobile viewport -> banner
    if (titleLower.includes("viewport") || titleLower.includes("mobile")) {
      annotations.push({
        label: f.title,
        severity: f.severity,
        region: "full-page-banner",
      });
      continue;
    }

    // Alt text / images
    if (titleLower.includes("alt text") || titleLower.includes("image")) {
      annotations.push({
        label: f.title,
        severity: f.severity,
        selector: "img:not([alt]), img[alt='']",
      });
      continue;
    }
  }

  // Deduplicate by region (only show one annotation per region)
  const seen = new Set<string>();
  return annotations.filter((a) => {
    const key = a.selector || a.region || "";
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
