import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

const createSchema = z.object({
  url: z.string().url(),
  label: z.string().min(1).max(200),
  platformId: z.string().optional().nullable(),
  countryId: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  active: z.boolean().default(true),
});

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const sources = await db.scanSource.findMany({
    orderBy: [{ active: "desc" }, { label: "asc" }],
    include: {
      platform: { select: { id: true, name: true } },
      country: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ success: true, data: sources });
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

  const existing = await db.scanSource.findUnique({ where: { url: parsed.data.url } });
  if (existing) {
    return NextResponse.json(
      { success: false, error: { message: "A source with this URL already exists" } },
      { status: 400 }
    );
  }

  const source = await db.scanSource.create({
    data: {
      ...parsed.data,
      platformId: parsed.data.platformId || null,
      countryId: parsed.data.countryId || null,
      categoryId: parsed.data.categoryId || null,
    },
  });

  return NextResponse.json({ success: true, data: source }, { status: 201 });
}
