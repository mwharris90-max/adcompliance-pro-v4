import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { generateComplianceReport } from "@/lib/pdf/generateComplianceReport";
import type { ComplianceResult } from "@/lib/ai/runComplianceCheck";
import { internalError } from "@/lib/api-error";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ checkId: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { success: false, error: { message: "Unauthorized" } },
      { status: 401 }
    );
  }

  const { checkId } = await params;

  try {
    const check = await db.complianceCheck.findUnique({
      where: { id: checkId },
      select: {
        id: true,
        userId: true,
        overallStatus: true,
        status: true,
        platformIds: true,
        categoryIds: true,
        countryIds: true,
        results: true,
        completedAt: true,
      },
    });

    if (!check) {
      return NextResponse.json(
        { success: false, error: { message: "Check not found" } },
        { status: 404 }
      );
    }

    if (check.userId !== session.user.id && session.user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: { message: "Forbidden" } },
        { status: 403 }
      );
    }

    const platforms = await db.platform.findMany({
      where: { id: { in: check.platformIds } },
      select: { name: true },
      orderBy: { sortOrder: "asc" },
    });

    const buffer = await generateComplianceReport({
      checkId: check.id,
      overallStatus: check.overallStatus ?? check.status,
      results: check.results as ComplianceResult | null,
      platformNames: platforms.map((p) => p.name),
      categoryCount: check.categoryIds.length,
      countryCount: check.countryIds.length,
      completedAt: check.completedAt,
    });

    const filename = `compliance-report-${check.id.slice(-8).toUpperCase()}.pdf`;

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return internalError(err, `GET /api/compliance/${checkId}/report`);
  }
}
