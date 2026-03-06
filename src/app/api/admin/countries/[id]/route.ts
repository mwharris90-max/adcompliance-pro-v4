import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

const patchSchema = z.object({
  approved: z.boolean().optional(),
  complexRules: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAdmin();
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

  const data: Record<string, unknown> = { ...parsed.data };

  if (parsed.data.approved === true) {
    data.approvedAt = new Date();
    data.approvedById = session.user.id;
  } else if (parsed.data.approved === false) {
    data.approvedAt = null;
    data.approvedById = null;
  }

  const country = await db.country.update({ where: { id }, data });
  return NextResponse.json({ success: true, data: country });
}
