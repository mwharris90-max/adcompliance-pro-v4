import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

const createSchema = z.object({
  title: z.string().min(1).max(300),
  slug: z.string().min(1).max(300).regex(/^[a-z0-9-]+$/),
  platformId: z.string(),
  sourceUrl: z.string().url().optional().nullable(),
  summary: z.string().optional().nullable(),
  fullText: z.string().optional().nullable(),
  effectiveDate: z.string().optional().nullable(),
  maturity: z.enum(["ALPHA", "BETA", "LIVE"]).default("ALPHA"),
  legislationIds: z.array(z.string()).optional(),
});

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const platformId = req.nextUrl.searchParams.get("platformId");
  const search = req.nextUrl.searchParams.get("search");
  const maturity = req.nextUrl.searchParams.get("maturity");

  const where: Record<string, unknown> = { active: true };
  if (platformId) where.platformId = platformId;
  if (maturity) where.maturity = maturity;
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { summary: { contains: search, mode: "insensitive" } },
    ];
  }

  const policies = await db.platformPolicy.findMany({
    where,
    orderBy: { title: "asc" },
    include: {
      platform: { select: { id: true, name: true } },
      _count: { select: { complianceRules: true } },
    },
  });

  return NextResponse.json({ success: true, data: policies });
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { message: "Validation failed", details: parsed.error.flatten().fieldErrors } },
      { status: 400 }
    );
  }

  const { legislationIds, effectiveDate, ...rest } = parsed.data;

  const policy = await db.platformPolicy.create({
    data: {
      ...rest,
      effectiveDate: effectiveDate ? new Date(effectiveDate) : null,
      lastVerifiedById: session.user.id,
      lastVerifiedAt: new Date(),
      ...(legislationIds && legislationIds.length > 0
        ? {
            legislation: {
              create: legislationIds.map((legId) => ({
                legislationId: legId,
              })),
            },
          }
        : {}),
    },
    include: {
      platform: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ success: true, data: policy }, { status: 201 });
}
