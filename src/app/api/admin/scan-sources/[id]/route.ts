import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

const patchSchema = z.object({
  url: z.string().url().optional(),
  label: z.string().min(1).max(200).optional(),
  platformId: z.string().optional().nullable(),
  countryId: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  active: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { message: "Validation failed" } },
      { status: 400 }
    );
  }

  const data = {
    ...parsed.data,
    ...(parsed.data.platformId !== undefined ? { platformId: parsed.data.platformId || null } : {}),
    ...(parsed.data.countryId !== undefined ? { countryId: parsed.data.countryId || null } : {}),
    ...(parsed.data.categoryId !== undefined ? { categoryId: parsed.data.categoryId || null } : {}),
  };

  const source = await db.scanSource.update({ where: { id }, data });
  return NextResponse.json({ success: true, data: source });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  await db.scanSource.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
