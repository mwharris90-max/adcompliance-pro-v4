import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";

const schema = z.object({
  bulkRowId: z.string().min(1),
  bulkJobId: z.string().min(1),
  originalCategoryId: z.string().min(1),
  originalCategoryName: z.string().min(1),
  overrideCategoryId: z.string().min(1),
  overrideCategoryName: z.string().min(1),
  restrictionLevel: z.enum(["allowed", "restricted", "prohibited"]),
  acknowledgement: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  const data = parsed.data;

  // Update the row's override category
  await db.bulkCheckRow.update({
    where: { id: data.bulkRowId },
    data: {
      overrideCategoryIds: [data.overrideCategoryId],
      detectedCategoryId: data.overrideCategoryId,
      detectedCategoryName: data.overrideCategoryName,
    },
  });

  // Create audit trail entry
  const audit = await db.categoryOverrideAudit.create({
    data: {
      userId: session.user.id,
      bulkRowId: data.bulkRowId,
      bulkJobId: data.bulkJobId,
      originalCategoryId: data.originalCategoryId,
      originalCategoryName: data.originalCategoryName,
      overrideCategoryId: data.overrideCategoryId,
      overrideCategoryName: data.overrideCategoryName,
      restrictionLevel: data.restrictionLevel,
      acknowledgement: data.acknowledgement,
    },
  });

  return NextResponse.json({ success: true, auditId: audit.id });
}
