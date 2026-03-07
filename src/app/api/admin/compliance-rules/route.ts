import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { syncRuleToRuntime } from "@/lib/compliance/sync-rules";
import { Prisma } from "@prisma/client";

const createSchema = z.object({
  categoryId: z.string().optional(),
  categorySlug: z.string().optional(),
  platformId: z.string().optional(),
  platformName: z.string().optional(),
  countryId: z.string().optional(),
  countryName: z.string().optional(),
  sourceType: z.enum(["LEGISLATION", "PLATFORM_POLICY", "PLATFORM_INDEPENDENT"]),
  legislationId: z.string().optional().nullable(),
  platformPolicyId: z.string().optional().nullable(),
  status: z.enum(["ALLOWED", "RESTRICTED", "PROHIBITED", "UNKNOWN"]),
  title: z.string().min(1).max(300),
  description: z.string().optional().nullable(),
  conditions: z.record(z.string(), z.unknown()).optional().nullable(),
  aiCheckInstructions: z.string().optional().nullable(),
  maturity: z.enum(["ALPHA", "BETA", "LIVE"]).default("ALPHA"),
});

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const legislationId = req.nextUrl.searchParams.get("legislationId");
  const platformPolicyId = req.nextUrl.searchParams.get("platformPolicyId");
  const categoryId = req.nextUrl.searchParams.get("categoryId");
  const maturity = req.nextUrl.searchParams.get("maturity");

  const where: Record<string, unknown> = {};
  if (legislationId) where.legislationId = legislationId;
  if (platformPolicyId) where.platformPolicyId = platformPolicyId;
  if (categoryId) where.categoryId = categoryId;
  if (maturity) where.maturity = maturity;

  const rules = await db.complianceRule.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    include: {
      category: { select: { id: true, name: true, slug: true } },
      platform: { select: { id: true, name: true } },
      country: { select: { id: true, name: true, code: true } },
      legislation: { select: { id: true, title: true, slug: true } },
      platformPolicy: { select: { id: true, title: true, slug: true } },
    },
  });

  return NextResponse.json({ success: true, data: rules });
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

  const data = parsed.data;

  // Resolve category by slug if not by ID
  let categoryId = data.categoryId;
  if (!categoryId && data.categorySlug) {
    const cat = await db.category.findUnique({ where: { slug: data.categorySlug } });
    if (!cat) {
      return NextResponse.json(
        { success: false, error: { message: `Category not found: ${data.categorySlug}` } },
        { status: 400 }
      );
    }
    categoryId = cat.id;
  }
  if (!categoryId) {
    return NextResponse.json(
      { success: false, error: { message: "categoryId or categorySlug is required" } },
      { status: 400 }
    );
  }

  // Resolve platform by name if not by ID
  let platformId = data.platformId;
  if (!platformId && data.platformName) {
    const plat = await db.platform.findFirst({ where: { name: { equals: data.platformName, mode: "insensitive" } } });
    if (plat) platformId = plat.id;
  }

  // Resolve country by name if not by ID
  let countryId = data.countryId;
  if (!countryId && data.countryName) {
    const country = await db.country.findFirst({ where: { name: { equals: data.countryName, mode: "insensitive" } } });
    if (country) countryId = country.id;
  }

  const rule = await db.complianceRule.create({
    data: {
      categoryId,
      platformId: platformId ?? null,
      countryId: countryId ?? null,
      sourceType: data.sourceType,
      legislationId: data.legislationId ?? null,
      platformPolicyId: data.platformPolicyId ?? null,
      status: data.status,
      title: data.title,
      description: data.description ?? null,
      conditions: data.conditions ? (data.conditions as Prisma.InputJsonValue) : Prisma.JsonNull,
      aiCheckInstructions: data.aiCheckInstructions ?? null,
      maturity: data.maturity,
      lastVerifiedById: session.user.id,
      lastVerifiedAt: new Date(),
    },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      platform: { select: { id: true, name: true } },
      country: { select: { id: true, name: true, code: true } },
    },
  });

  // Sync to runtime tables
  await syncRuleToRuntime(rule.id);

  return NextResponse.json({ success: true, data: rule }, { status: 201 });
}
