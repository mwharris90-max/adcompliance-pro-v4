import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";
import { extractPage, type PageExtraction } from "@/lib/scanner/extract";
import { captureScreenshot } from "@/lib/scanner/screenshot";
import { deductCredits } from "@/lib/usage";
import { internalError } from "@/lib/api-error";
import { v2 as cloudinary } from "cloudinary";

export const maxDuration = 60; // allow up to 60s for crawl + AI

interface ScanFinding {
  severity: "pass" | "warning" | "fail";
  category: string;
  title: string;
  detail: string;
  recommendation?: string;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.includes("REPLACE")) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  try {
    const body = await req.json();
    const { url, platformIds, categoryIds, countryIds, withScreenshot } = body as {
      url: string;
      platformIds: string[];
      categoryIds: string[];
      countryIds: string[];
      withScreenshot?: boolean;
    };

    if (!url?.trim()) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }
    if (!platformIds?.length || !countryIds?.length) {
      return NextResponse.json(
        { error: "At least one platform and one country required" },
        { status: 400 }
      );
    }

    // ── 1. Deduct checkdits: 1 for scan + 1 if screenshot requested ──
    const cost = withScreenshot ? 2 : 1;
    const charged = await deductCredits(session.user.id, cost);
    if (!charged) {
      return NextResponse.json(
        { error: "Insufficient checkdits. Purchase more to continue." },
        { status: 402 }
      );
    }

    // ── 2. Extract page data ──
    let extraction: PageExtraction;
    try {
      extraction = await extractPage(url);
    } catch (err) {
      return NextResponse.json(
        {
          error: "Could not fetch the URL. Check it is publicly accessible.",
          detail: err instanceof Error ? err.message : String(err),
        },
        { status: 422 }
      );
    }

    // ── 3. Fetch context (platforms, categories, countries) ──
    const [platforms, categories, countries] = await Promise.all([
      db.platform.findMany({
        where: { id: { in: platformIds } },
        select: { name: true },
      }),
      categoryIds.length
        ? db.category.findMany({
            where: { id: { in: categoryIds } },
            select: { name: true, description: true },
          })
        : Promise.resolve([]),
      db.country.findMany({
        where: { id: { in: countryIds } },
        select: { name: true, code: true },
      }),
    ]);

    const platformNames = platforms.map((p) => p.name).join(", ");
    const countryNames = countries.map((c) => `${c.name} (${c.code})`).join(", ");
    const categoryNames = categories.length
      ? categories.map((c) => c.name).join(", ")
      : "General";

    // ── 4. Build extraction summary for AI ──
    const pageContext = {
      url: extraction.url,
      finalUrl: extraction.finalUrl,
      statusCode: extraction.statusCode,
      redirectCount: extraction.redirectCount,
      ssl: extraction.ssl,
      loadTimeMs: extraction.loadTimeMs,
      title: extraction.title,
      metaDescription: extraction.metaDescription,
      metaRobots: extraction.metaRobots,
      viewport: extraction.viewport,
      legalLinks: extraction.legalLinks,
      headings: extraction.headings,
      bodyText: extraction.bodyText,
      imageCount: extraction.images.length,
      imagesWithoutAlt: extraction.images.filter((img) => !img.alt).length,
      cookieConsentDetected: extraction.cookieConsentDetected,
      ageGateDetected: extraction.ageGateDetected,
      disclaimersFound: extraction.disclaimersFound,
      externalScripts: extraction.externalScripts,
    };

    // ── 5. AI compliance analysis ──
    const anthropic = new Anthropic({ apiKey });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: `You are an advertising compliance analyst reviewing a landing page for ad platform compliance.

CONTEXT:
- Advertising platforms: ${platformNames}
- Target countries: ${countryNames}
- Industry categories: ${categoryNames}

PAGE DATA:
${JSON.stringify(pageContext, null, 2)}

INSTRUCTIONS:
Analyse this page against advertising platform destination requirements and industry-specific compliance rules. Use the report_findings tool to produce a structured compliance report.

Check these areas:

1. PLATFORM READINESS
   - Is the page accessible (200 status)?
   - Is SSL/HTTPS in use?
   - How many redirects? (Google Ads max is 10)
   - Is there a mobile viewport configured?
   - Does the meta robots tag block ad crawlers? (noindex/nofollow is a problem for ads)
   - Is page load time reasonable? (>5s is poor)

2. LEGAL & REGULATORY
   - Is there a Privacy Policy link?
   - Is there a Terms & Conditions link?
   - Is there a Contact page or contact information?
   - Is there a cookie consent mechanism? (required for UK/EU under GDPR/PECR)
   - Are there required disclaimers for the industry? (e.g. FCA for financial services in UK, age gates for alcohol/gambling)

3. CONTENT COMPLIANCE
   - Are there potentially misleading claims?
   - Are health/financial claims substantiated or disclaimed?
   - Are testimonials properly disclosed?
   - Is the page content consistent with what ads would promise?
   - Does the page provide genuine value (not just an ad/landing page with no substance)?

4. INDUSTRY-SPECIFIC
   - Based on the categories selected, are there specific requirements being met or missed?
   - Regulatory body registration numbers displayed where required?
   - Age-gating where required?
   - Required badges or logos?

5. ACCESSIBILITY
   - Do images have alt text?
   - Is the page structure reasonable?

For each finding:
- severity: "pass" (compliant), "warning" (potential issue, should review), or "fail" (non-compliant, must fix)
- category: one of "platform_readiness", "legal_regulatory", "content_compliance", "industry_specific", "accessibility"
- title: short (under 80 chars) description of the check
- detail: 1-2 sentence explanation of what was found
- recommendation: (for warnings and fails only) what to do to fix it

Be practical and specific. Don't flag things that are clearly fine. Focus on real compliance risks.
If something is genuinely compliant, mark it as "pass" — do not manufacture issues.`,
      messages: [
        {
          role: "user",
          content: "Analyse this landing page and report your compliance findings.",
        },
      ],
      tools: [
        {
          name: "report_findings",
          description: "Report structured compliance findings for the scanned page.",
          input_schema: {
            type: "object" as const,
            properties: {
              summary: {
                type: "string",
                description: "2-3 sentence overall summary of the page's compliance status",
              },
              overallScore: {
                type: "string",
                enum: ["compliant", "needs_attention", "non_compliant"],
                description: "Overall compliance verdict",
              },
              findings: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    severity: {
                      type: "string",
                      enum: ["pass", "warning", "fail"],
                    },
                    category: {
                      type: "string",
                      enum: [
                        "platform_readiness",
                        "legal_regulatory",
                        "content_compliance",
                        "industry_specific",
                        "accessibility",
                      ],
                    },
                    title: { type: "string" },
                    detail: { type: "string" },
                    recommendation: { type: "string" },
                  },
                  required: ["severity", "category", "title", "detail"],
                },
              },
            },
            required: ["summary", "overallScore", "findings"],
          },
        },
      ],
    });

    // Parse AI response
    let report: {
      summary: string;
      overallScore: "compliant" | "needs_attention" | "non_compliant";
      findings: ScanFinding[];
    } | null = null;

    for (const block of response.content) {
      if (block.type === "tool_use" && block.name === "report_findings") {
        report = block.input as typeof report;
      }
    }

    if (!report) {
      return NextResponse.json(
        { error: "AI did not produce a compliance report" },
        { status: 500 }
      );
    }

    // ── 6. Capture screenshot if requested ──
    let screenshotUrl: string | null = null;
    if (withScreenshot && process.env.APIFLASH_ACCESS_KEY) {
      try {
        const { clean } = await captureScreenshot(url);

        // Upload to Cloudinary if configured, otherwise skip
        if (
          process.env.CLOUDINARY_CLOUD_NAME &&
          process.env.CLOUDINARY_API_KEY &&
          process.env.CLOUDINARY_API_SECRET
        ) {
          cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET,
          });

          const hostname = new URL(url).hostname.replace(/\./g, "-");
          const folder = `scan-screenshots/${session.user.id}`;
          const publicId = `${hostname}-${Date.now()}`;

          screenshotUrl = await new Promise<string>((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
              { folder, public_id: publicId, resource_type: "image", format: "png", overwrite: true },
              (err, uploadResult) => {
                if (err) reject(err);
                else resolve(uploadResult!.secure_url);
              }
            );
            stream.end(clean);
          });
        }
      } catch (screenshotErr) {
        // Screenshot failure is non-fatal — the scan still succeeds
        console.error("[scan] Screenshot capture failed:", screenshotErr);
      }
    }

    return NextResponse.json({
      success: true,
      scan: {
        url: extraction.url,
        finalUrl: extraction.finalUrl,
        title: extraction.title,
        statusCode: extraction.statusCode,
        ssl: extraction.ssl,
        redirectCount: extraction.redirectCount,
        loadTimeMs: extraction.loadTimeMs,
        cookieConsentDetected: extraction.cookieConsentDetected,
        ageGateDetected: extraction.ageGateDetected,
        imageCount: extraction.images.length,
        imagesWithoutAlt: extraction.images.filter((img) => !img.alt).length,
      },
      report,
      screenshotUrl,
    });
  } catch (err) {
    return internalError(err, "POST /api/compliance/scan");
  }
}
