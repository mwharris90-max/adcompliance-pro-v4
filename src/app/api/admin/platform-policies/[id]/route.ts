import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { auth } from "@/auth";

const patchSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  slug: z.string().min(1).max(300).regex(/^[a-z0-9-]+$/).optional(),
  sourceUrl: z.string().url().optional().nullable(),
  summary: z.string().optional().nullable(),
  fullText: z.string().optional().nullable(),
  effectiveDate: z.string().optional().nullable(),
  maturity: z.enum(["ALPHA", "BETA", "LIVE"]).optional(),
  active: z.boolean().optional(),
  markVerified: z.boolean().optional(),
  legislationIds: z.array(z.string()).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;

  const policy = await db.platformPolicy.findUnique({
    where: { id },
    include: {
      platform: { select: { id: true, name: true } },
      complianceRules: {
        where: { active: true },
        orderBy: { sortOrder: "asc" },
        include: {
          category: { select: { id: true, name: true, slug: true } },
          country: { select: { id: true, name: true, code: true } },
        },
      },
      legislation: {
        include: {
          legislation: { select: { id: true, title: true, slug: true, type: true } },
        },
      },
      resourceLinks: {
        include: {
          article: { select: { id: true, title: true, slug: true } },
          quiz: { select: { id: true, question: true } },
        },
      },
    },
  });

  if (!policy) {
    return NextResponse.json(
      { success: false, error: { message: "Not found" } },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, data: policy });
}

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

  const { markVerified, effectiveDate, legislationIds, ...rest } = parsed.data;
  const session = await auth();

  const updateData: Record<string, unknown> = { ...rest };
  if (effectiveDate !== undefined) updateData.effectiveDate = effectiveDate ? new Date(effectiveDate) : null;
  if (markVerified) {
    updateData.lastVerifiedAt = new Date();
    updateData.lastVerifiedById = session?.user?.id;
  }

  // Update legislation links if provided
  if (legislationIds !== undefined) {
    // Remove existing links and re-create
    await db.platformPolicyLegislation.deleteMany({ where: { platformPolicyId: id } });
    if (legislationIds.length > 0) {
      await db.platformPolicyLegislation.createMany({
        data: legislationIds.map((legId) => ({
          platformPolicyId: id,
          legislationId: legId,
        })),
      });
    }
  }

  const policy = await db.platformPolicy.update({
    where: { id },
    data: updateData,
    include: {
      platform: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ success: true, data: policy });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;

  const ruleCount = await db.complianceRule.count({ where: { platformPolicyId: id } });
  if (ruleCount > 0) {
    return NextResponse.json(
      { success: false, error: { message: "Cannot delete: policy has derived rules. Deactivate it instead." } },
      { status: 400 }
    );
  }

  await db.platformPolicy.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
