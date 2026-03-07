import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

const createSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/),
  type: z.enum(["STATUTE", "REGULATION", "DIRECTIVE", "INDUSTRY_CODE", "GUIDANCE"]),
  jurisdictionId: z.string().optional().nullable(),
  region: z.string().optional().nullable(),
  sourceUrl: z.string().url().optional().nullable(),
  summary: z.string().optional().nullable(),
  fullText: z.string().optional().nullable(),
  effectiveDate: z.string().optional().nullable(),
  expiryDate: z.string().optional().nullable(),
  tags: z.array(z.string()).default([]),
  active: z.boolean().default(true),
});

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const search = req.nextUrl.searchParams.get("search") ?? "";
  const type = req.nextUrl.searchParams.get("type");
  const region = req.nextUrl.searchParams.get("region");
  const maturity = req.nextUrl.searchParams.get("maturity");
  const jurisdictionId = req.nextUrl.searchParams.get("jurisdictionId");

  const where: Record<string, unknown> = {};
  if (search) where.title = { contains: search, mode: "insensitive" };
  if (type) where.type = type;
  if (region) where.region = region;
  if (maturity) where.maturity = maturity;
  if (jurisdictionId) where.jurisdictionId = jurisdictionId;

  const legislation = await db.legislation.findMany({
    where,
    orderBy: [{ title: "asc" }],
    select: {
      id: true,
      title: true,
      slug: true,
      type: true,
      region: true,
      sourceUrl: true,
      summary: true,
      effectiveDate: true,
      expiryDate: true,
      maturity: true,
      lastVerifiedAt: true,
      tags: true,
      active: true,
      createdAt: true,
      jurisdiction: { select: { id: true, name: true, code: true } },
      _count: { select: { complianceRules: true } },
    },
  });

  return NextResponse.json({ success: true, data: legislation });
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { message: "Validation failed", details: parsed.error.flatten().fieldErrors } },
      { status: 400 }
    );
  }

  const existing = await db.legislation.findUnique({ where: { slug: parsed.data.slug } });
  if (existing) {
    return NextResponse.json(
      { success: false, error: { message: "A legislation entry with this slug already exists" } },
      { status: 400 }
    );
  }

  const { effectiveDate, expiryDate, jurisdictionId, ...rest } = parsed.data;
  const legislation = await db.legislation.create({
    data: {
      ...rest,
      jurisdictionId: jurisdictionId ?? null,
      effectiveDate: effectiveDate ? new Date(effectiveDate) : null,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
    } as Parameters<typeof db.legislation.create>[0]["data"],
  });

  return NextResponse.json({ success: true, data: legislation }, { status: 201 });
}
