import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { internalError } from "@/lib/api-error";

const createCheckSchema = z.object({
  platformIds: z.array(z.string()).min(1),
  categoryIds: z.array(z.string()).min(1),
  countryIds: z.array(z.string()).min(1),
  adContent: z.record(z.string(), z.unknown()),
  assetUrls: z.array(z.string()).default([]),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { success: false, error: { message: "Unauthorized" } },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: { message: "Invalid JSON body" } },
      { status: 400 }
    );
  }

  const parsed = createCheckSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          message: "Validation failed",
          details: parsed.error.flatten().fieldErrors,
        },
      },
      { status: 400 }
    );
  }

  try {
    const check = await db.complianceCheck.create({
      data: {
        userId: session.user.id,
        platformIds: parsed.data.platformIds,
        categoryIds: parsed.data.categoryIds,
        countryIds: parsed.data.countryIds,
        adContent: parsed.data.adContent as Prisma.InputJsonValue,
        assetUrls: parsed.data.assetUrls,
        status: "PENDING",
      },
    });
    return NextResponse.json({ success: true, data: check }, { status: 201 });
  } catch (err) {
    return internalError(err, "POST /api/checks");
  }
}

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { success: false, error: { message: "Unauthorized" } },
      { status: 401 }
    );
  }

  try {
    const checks = await db.complianceCheck.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        status: true,
        overallStatus: true,
        platformIds: true,
        categoryIds: true,
        countryIds: true,
        createdAt: true,
        completedAt: true,
      },
    });

    // Resolve platform names in a single query
    const allPlatformIds = [...new Set(checks.flatMap((c) => c.platformIds))];
    const platforms = allPlatformIds.length
      ? await db.platform.findMany({
          where: { id: { in: allPlatformIds } },
          select: { id: true, name: true },
        })
      : [];
    const platformMap = new Map(platforms.map((p) => [p.id, p.name]));

    const data = checks.map((c) => ({
      ...c,
      platformNames: c.platformIds.map((id) => platformMap.get(id) ?? id),
    }));

    return NextResponse.json({ success: true, data });
  } catch (err) {
    return internalError(err, "GET /api/checks");
  }
}
