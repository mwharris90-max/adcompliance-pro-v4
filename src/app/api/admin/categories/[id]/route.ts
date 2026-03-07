import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

const patchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional().nullable(),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  maturity: z.enum(["ALPHA", "BETA", "LIVE"]).optional(),
  markReviewed: z.boolean().optional(),
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
      { success: false, error: { message: "Validation failed", details: parsed.error.flatten().fieldErrors } },
      { status: 400 }
    );
  }

  const { markReviewed, ...updateData } = parsed.data;

  const session = await auth();

  const category = await db.category.update({
    where: { id },
    data: {
      ...updateData,
      ...(markReviewed ? { lastReviewedAt: new Date(), lastReviewedById: session?.user?.id } : {}),
    },
  });

  return NextResponse.json({ success: true, data: category });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;

  const rulesCount = await db.platformRule.count({ where: { categoryId: id } });
  if (rulesCount > 0) {
    return NextResponse.json(
      { success: false, error: { message: "Cannot delete: category has associated rules. Deactivate it instead." } },
      { status: 400 }
    );
  }

  await db.category.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
