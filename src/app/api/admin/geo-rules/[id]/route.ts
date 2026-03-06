import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

const patchSchema = z.object({
  status: z.enum(["ALLOWED", "RESTRICTED", "PROHIBITED", "UNKNOWN"]).optional(),
  restrictions: z.record(z.string(), z.unknown()).optional().nullable(),
  notes: z.string().optional().nullable(),
  legislationUrl: z.string().url().optional().nullable().or(z.literal("")),
  markVerified: z.boolean().optional(),
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

  const { markVerified, legislationUrl, restrictions, ...rest } = parsed.data;
  const updateData = {
    ...rest,
    ...(restrictions !== undefined ? { restrictions: restrictions === null ? Prisma.JsonNull : restrictions as Prisma.InputJsonValue } : {}),
    ...(legislationUrl !== undefined ? { legislationUrl: legislationUrl || null } : {}),
    ...(markVerified ? { lastVerifiedAt: new Date() } : {}),
  };

  const rule = await db.geoRule.update({ where: { id }, data: updateData });
  return NextResponse.json({ success: true, data: rule });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  await db.geoRule.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
