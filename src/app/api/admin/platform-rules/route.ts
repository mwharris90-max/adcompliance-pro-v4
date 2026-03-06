import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

const createSchema = z.object({
  platformId: z.string(),
  categoryId: z.string(),
  status: z.enum(["ALLOWED", "RESTRICTED", "PROHIBITED", "UNKNOWN"]).default("UNKNOWN"),
  notes: z.string().optional().nullable(),
  conditions: z.record(z.string(), z.unknown()).optional().nullable(),
  referenceUrl: z.string().url().optional().nullable().or(z.literal("")),
});

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const platformId = req.nextUrl.searchParams.get("platformId");
  const search = req.nextUrl.searchParams.get("search") ?? "";
  const status = req.nextUrl.searchParams.get("status");

  const rules = await db.platformRule.findMany({
    where: {
      ...(platformId ? { platformId } : {}),
      ...(status ? { status: status as never } : {}),
      ...(search
        ? { category: { name: { contains: search, mode: "insensitive" } } }
        : {}),
    },
    orderBy: [{ platform: { name: "asc" } }, { category: { name: "asc" } }],
    include: {
      platform: { select: { id: true, name: true, slug: true } },
      category: { select: { id: true, name: true, slug: true } },
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

  const existing = await db.platformRule.findUnique({
    where: { platformId_categoryId: { platformId: parsed.data.platformId, categoryId: parsed.data.categoryId } },
  });
  if (existing) {
    return NextResponse.json(
      { success: false, error: { message: "A rule for this platform/category already exists" } },
      { status: 400 }
    );
  }

  const { conditions, ...restData } = parsed.data;
  const data = {
    ...restData,
    referenceUrl: parsed.data.referenceUrl || null,
    ...(conditions !== undefined && conditions !== null
      ? { conditions: conditions as Prisma.InputJsonValue }
      : {}),
  };

  const rule = await db.platformRule.create({ data });
  return NextResponse.json({ success: true, data: rule }, { status: 201 });
}
