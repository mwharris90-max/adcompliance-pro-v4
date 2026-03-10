import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { generateScanReportPdf } from "@/lib/pdf/generateScanReport";
import { internalError } from "@/lib/api-error";

/**
 * POST /api/compliance/scan/pdf
 * Generate a downloadable PDF scan report.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      scan,
      report,
      platformIds,
      categoryIds,
      countryIds,
      screenshotUrl,
    } = body as {
      scan: {
        url: string;
        finalUrl: string;
        title: string;
        statusCode: number;
        ssl: boolean;
        redirectCount: number;
        loadTimeMs: number;
        cookieConsentDetected: boolean;
        ageGateDetected: boolean;
        imageCount: number;
        imagesWithoutAlt: number;
      };
      report: {
        summary: string;
        overallScore: "compliant" | "needs_attention" | "non_compliant";
        findings: {
          severity: "pass" | "warning" | "fail";
          category: string;
          title: string;
          detail: string;
          recommendation?: string;
        }[];
      };
      platformIds: string[];
      categoryIds: string[];
      countryIds: string[];
      screenshotUrl?: string | null;
    };

    if (!scan || !report) {
      return NextResponse.json(
        { error: "Missing scan data or report" },
        { status: 400 }
      );
    }

    const [platforms, categories, countries] = await Promise.all([
      platformIds?.length
        ? db.platform.findMany({
            where: { id: { in: platformIds } },
            select: { name: true },
          })
        : Promise.resolve([]),
      categoryIds?.length
        ? db.category.findMany({
            where: { id: { in: categoryIds } },
            select: { name: true },
          })
        : Promise.resolve([]),
      countryIds?.length
        ? db.country.findMany({
            where: { id: { in: countryIds } },
            select: { name: true },
          })
        : Promise.resolve([]),
    ]);

    const buffer = await generateScanReportPdf({
      generatedAt: new Date(),
      url: scan.url,
      finalUrl: scan.finalUrl,
      title: scan.title,
      statusCode: scan.statusCode,
      ssl: scan.ssl,
      redirectCount: scan.redirectCount,
      loadTimeMs: scan.loadTimeMs,
      cookieConsentDetected: scan.cookieConsentDetected,
      imageCount: scan.imageCount,
      imagesWithoutAlt: scan.imagesWithoutAlt,
      platforms: platforms.map((p) => p.name),
      categories: categories.map((c) => c.name),
      countries: countries.map((c) => c.name),
      report,
      screenshotUrl: screenshotUrl ?? null,
    });

    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const hostname = new URL(scan.url).hostname.replace(/\./g, "-");
    const filename = `site-scan-${hostname}-${timestamp}.pdf`;

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return internalError(err, "POST /api/compliance/scan/pdf");
  }
}
