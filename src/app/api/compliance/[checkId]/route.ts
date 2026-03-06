import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
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
        status: true,
        overallStatus: true,
        platformIds: true,
        categoryIds: true,
        countryIds: true,
        adContent: true,
        assetUrls: true,
        results: true,
        createdAt: true,
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

    return NextResponse.json({ success: true, data: check });
  } catch (err) {
    return internalError(err, `GET /api/compliance/${checkId}`);
  }
}

// PATCH — persist overrides back into the results JSON
export async function PATCH(
  req: NextRequest,
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
      select: { userId: true, results: true },
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

    const body = await req.json();
    const { overrides, acceptedRewrites } = body as {
      overrides?: unknown[];
      acceptedRewrites?: unknown[];
    };

    // Merge overrides and acceptedRewrites into the existing results JSON
    const existing = (check.results ?? {}) as Record<string, unknown>;
    const updated: Record<string, unknown> = { ...existing };
    if (overrides !== undefined) updated.overrides = overrides;
    if (acceptedRewrites !== undefined) updated.acceptedRewrites = acceptedRewrites;

    await db.complianceCheck.update({
      where: { id: checkId },
      data: { results: updated as Prisma.InputJsonValue },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return internalError(err, `PATCH /api/compliance/${checkId}`);
  }
}
