import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { generateComplianceBriefPdf } from "@/lib/pdf/generateComplianceBrief";
import { internalError } from "@/lib/api-error";

/**
 * POST /api/compliance/brief/pdf
 * Generate a downloadable PDF brief with Must / Should / Should Not guidance.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { platformIds, categoryIds, countryIds, guidance } = body as {
      platformIds: string[];
      categoryIds: string[];
      countryIds: string[];
      guidance: {
        must: { text: string; source: string }[];
        should: { text: string; source: string }[];
        shouldNot: { text: string; source: string }[];
        prohibited: { text: string; source: string }[];
        legislationSummary?: { name: string; summary: string; jurisdiction: string }[];
        practicalRequirements?: { requirement: string; source: string }[];
      };
    };

    if (!platformIds?.length || !countryIds?.length || !guidance) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const [platforms, categories, countries] = await Promise.all([
      db.platform.findMany({
        where: { id: { in: platformIds } },
        select: { name: true },
      }),
      categoryIds.length
        ? db.category.findMany({
            where: { id: { in: categoryIds } },
            select: { name: true },
          })
        : Promise.resolve([]),
      db.country.findMany({
        where: { id: { in: countryIds } },
        select: { name: true },
      }),
    ]);

    const buffer = await generateComplianceBriefPdf({
      generatedAt: new Date(),
      platforms: platforms.map((p) => p.name),
      categories: categories.map((c) => c.name),
      countries: countries.map((c) => c.name),
      guidance,
    });

    const timestamp = new Date()
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, "");
    const filename = `compliance-brief-${timestamp}.pdf`;

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return internalError(err, "POST /api/compliance/brief/pdf");
  }
}
