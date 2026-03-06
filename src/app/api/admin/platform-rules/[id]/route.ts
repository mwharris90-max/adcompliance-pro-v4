import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

const patchSchema = z.object({
  status: z.enum(["ALLOWED", "RESTRICTED", "PROHIBITED", "UNKNOWN"]).optional(),
  notes: z.string().optional().nullable(),
  conditions: z.record(z.string(), z.unknown()).optional().nullable(),
  referenceUrl: z.string().url().optional().nullable().or(z.literal("")),
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

  const { markVerified, referenceUrl, conditions, ...rest } = parsed.data;
  const updateData = {
    ...rest,
    ...(conditions !== undefined ? { conditions: conditions === null ? Prisma.JsonNull : conditions as Prisma.InputJsonValue } : {}),
    ...(referenceUrl !== undefined ? { referenceUrl: referenceUrl || null } : {}),
    ...(markVerified ? { lastVerifiedAt: new Date() } : {}),
  };

  const rule = await db.platformRule.update({ where: { id }, data: updateData });
  return NextResponse.json({ success: true, data: rule });
}
