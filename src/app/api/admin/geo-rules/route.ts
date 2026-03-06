import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

const createSchema = z.object({
  countryId: z.string(),
  categoryId: z.string(),
  platformId: z.string().optional().nullable(),
  status: z.enum(["ALLOWED", "RESTRICTED", "PROHIBITED", "UNKNOWN"]).default("UNKNOWN"),
  restrictions: z.record(z.string(), z.unknown()).optional().nullable(),
  notes: z.string().optional().nullable(),
  legislationUrl: z.string().url().optional().nullable().or(z.literal("")),
});

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const countryId = req.nextUrl.searchParams.get("countryId");
  const platformId = req.nextUrl.searchParams.get("platformId");
  const search = req.nextUrl.searchParams.get("search") ?? "";
  const status = req.nextUrl.searchParams.get("status");

  const rules = await db.geoRule.findMany({
    where: {
      ...(countryId ? { countryId } : {}),
      ...(platformId === "null" ? { platformId: null } : platformId ? { platformId } : {}),
      ...(status ? { status: status as never } : {}),
      ...(search
        ? { category: { name: { contains: search, mode: "insensitive" } } }
        : {}),
    },
    orderBy: [{ country: { name: "asc" } }, { category: { name: "asc" } }],
    include: {
      country: { select: { id: true, name: true, code: true } },
      category: { select: { id: true, name: true } },
      platform: { select: { id: true, name: true, slug: true } },
    },
  });

  return NextResponse.json({ success: true, data: rules });
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

  const { restrictions, ...restData } = parsed.data;
  const data = {
    ...restData,
    platformId: parsed.data.platformId || null,
    legislationUrl: parsed.data.legislationUrl || null,
    ...(restrictions !== undefined && restrictions !== null
      ? { restrictions: restrictions as Prisma.InputJsonValue }
      : {}),
  };

  const rule = await db.geoRule.create({ data });
  return NextResponse.json({ success: true, data: rule }, { status: 201 });
}
