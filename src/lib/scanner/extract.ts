import * as cheerio from "cheerio";

export interface PageExtraction {
  url: string;
  finalUrl: string;
  statusCode: number;
  redirectCount: number;
  ssl: boolean;
  loadTimeMs: number;
  // Meta
  title: string;
  metaDescription: string;
  metaRobots: string;
  viewport: string;
  // Footer / legal links
  legalLinks: {
    privacyPolicy: string | null;
    terms: string | null;
    contact: string | null;
    about: string | null;
    cookiePolicy: string | null;
  };
  // Content
  headings: string[];
  bodyText: string; // truncated to ~8000 chars for AI
  images: { src: string; alt: string }[];
  // Consent
  cookieConsentDetected: boolean;
  ageGateDetected: boolean;
  // Disclaimers found
  disclaimersFound: string[];
  // External scripts (analytics, tracking)
  externalScripts: string[];
}

const LEGAL_PATTERNS: Record<keyof PageExtraction["legalLinks"], RegExp[]> = {
  privacyPolicy: [/privacy\s*policy/i, /privacy\s*notice/i, /data\s*protection/i, /datenschutz/i],
  terms: [/terms\s*(of\s*service|&\s*conditions|of\s*use)/i, /t&c/i, /legal\s*notice/i],
  contact: [/contact\s*us/i, /get\s*in\s*touch/i, /contact/i],
  about: [/about\s*us/i, /about$/i, /who\s*we\s*are/i],
  cookiePolicy: [/cookie\s*policy/i, /cookie\s*notice/i, /use\s*of\s*cookies/i],
};

const CONSENT_PATTERNS = [
  /cookie\s*(consent|banner|notice|popup)/i,
  /accept\s*(all\s*)?cookies/i,
  /we\s*use\s*cookies/i,
  /cookie[-_]consent/i,
  /gdpr[-_]?consent/i,
  /consent[-_]?manager/i,
  /onetrust/i,
  /cookiebot/i,
  /quantcast/i,
  /cookie[-_]?law/i,
];

const AGE_GATE_PATTERNS = [
  /age\s*(gate|verification|check|confirm)/i,
  /are\s*you\s*(over|at\s*least)\s*\d+/i,
  /confirm\s*your\s*age/i,
  /you\s*must\s*be\s*\d+/i,
  /enter\s*your\s*(date\s*of\s*birth|dob|birthday)/i,
];

const DISCLAIMER_PATTERNS = [
  /financial\s*conduct\s*authority/i,
  /fca\s*(register|authorised|regulated)/i,
  /past\s*performance\s*(is\s*not|does\s*not)/i,
  /capital\s*at\s*risk/i,
  /drink\s*responsibly/i,
  /gamble\s*aware/i,
  /begambleaware/i,
  /when\s*the\s*fun\s*stops/i,
  /18\+|over\s*18|21\+/i,
  /terms\s*and\s*conditions\s*apply/i,
  /your\s*home\s*(may|could)\s*be\s*(repossessed|at\s*risk)/i,
  /not\s*(a\s*)?medical\s*advice/i,
  /consult\s*(your|a)\s*(doctor|physician|healthcare)/i,
  /results\s*may\s*vary/i,
  /ad|advertisement|sponsored|#ad|paid\s*partnership/i,
];

/**
 * Fetch and extract structured data from a URL for compliance analysis.
 */
export async function extractPage(url: string): Promise<PageExtraction> {
  // Normalise URL
  let targetUrl = url.trim();
  if (!/^https?:\/\//i.test(targetUrl)) {
    targetUrl = `https://${targetUrl}`;
  }

  const start = Date.now();
  let redirectCount = 0;
  let currentUrl = targetUrl;
  let response: Response | null = null;

  // Follow redirects manually to count them
  for (let i = 0; i < 15; i++) {
    response = await fetch(currentUrl, {
      redirect: "manual",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; AdCompliancePro/1.0; +https://adcompliancepro.com)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(15000),
    });

    const location = response.headers.get("location");
    if (location && response.status >= 300 && response.status < 400) {
      redirectCount++;
      // Resolve relative redirects
      currentUrl = new URL(location, currentUrl).href;
      continue;
    }
    break;
  }

  if (!response) {
    throw new Error("Failed to fetch URL after redirects");
  }

  const loadTimeMs = Date.now() - start;
  const html = await response.text();
  const $ = cheerio.load(html);

  // ── Meta ──
  const title = $("title").first().text().trim() || "";
  const metaDescription =
    $('meta[name="description"]').attr("content")?.trim() || "";
  const metaRobots =
    $('meta[name="robots"]').attr("content")?.trim() || "";
  const viewport =
    $('meta[name="viewport"]').attr("content")?.trim() || "";

  // ── Legal links ──
  const allLinks: { href: string; text: string }[] = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    const text = $(el).text().trim();
    if (href && text) allLinks.push({ href, text });
  });

  const legalLinks: PageExtraction["legalLinks"] = {
    privacyPolicy: null,
    terms: null,
    contact: null,
    about: null,
    cookiePolicy: null,
  };

  for (const [key, patterns] of Object.entries(LEGAL_PATTERNS)) {
    for (const link of allLinks) {
      if (patterns.some((p) => p.test(link.text) || p.test(link.href))) {
        legalLinks[key as keyof typeof legalLinks] = link.href;
        break;
      }
    }
  }

  // ── Headings ──
  const headings: string[] = [];
  $("h1, h2, h3").each((_, el) => {
    const text = $(el).text().trim();
    if (text) headings.push(text.slice(0, 200));
  });

  // ── Body text (truncated for AI context) ──
  // Remove scripts, styles, and non-visible elements
  $("script, style, noscript, svg, path, iframe").remove();
  let bodyText = $("body").text().replace(/\s+/g, " ").trim();
  bodyText = bodyText.slice(0, 8000);

  // ── Images ──
  const images: { src: string; alt: string }[] = [];
  $("img").each((_, el) => {
    const src = $(el).attr("src") || $(el).attr("data-src") || "";
    const alt = $(el).attr("alt")?.trim() || "";
    if (src) images.push({ src: src.slice(0, 300), alt: alt.slice(0, 200) });
  });

  // ── Cookie consent detection ──
  const fullHtml = html.toLowerCase();
  const cookieConsentDetected = CONSENT_PATTERNS.some(
    (p) => p.test(fullHtml) || p.test(bodyText)
  );

  // ── Age gate detection ──
  const ageGateDetected = AGE_GATE_PATTERNS.some(
    (p) => p.test(fullHtml) || p.test(bodyText)
  );

  // ── Disclaimers ──
  const disclaimersFound: string[] = [];
  for (const pattern of DISCLAIMER_PATTERNS) {
    const match = bodyText.match(pattern);
    if (match) {
      disclaimersFound.push(match[0]);
    }
  }

  // ── External scripts ──
  const externalScripts: string[] = [];
  $("script[src]").each((_, el) => {
    const src = $(el).attr("src") || "";
    if (src && /^https?:\/\//i.test(src)) {
      try {
        const hostname = new URL(src).hostname;
        if (!externalScripts.includes(hostname)) {
          externalScripts.push(hostname);
        }
      } catch {
        // skip malformed URLs
      }
    }
  });

  return {
    url: targetUrl,
    finalUrl: currentUrl,
    statusCode: response.status,
    redirectCount,
    ssl: currentUrl.startsWith("https://"),
    loadTimeMs,
    title,
    metaDescription,
    metaRobots,
    viewport,
    legalLinks,
    headings: headings.slice(0, 20),
    bodyText,
    images: images.slice(0, 30),
    cookieConsentDetected,
    ageGateDetected,
    disclaimersFound,
    externalScripts: externalScripts.slice(0, 20),
  };
}
