import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { auth } from "@/auth";

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/).optional(),
  type: z.enum(["STATUTE", "REGULATION", "DIRECTIVE", "INDUSTRY_CODE", "GUIDANCE"]).optional(),
  jurisdictionId: z.string().optional().nullable(),
  region: z.string().optional().nullable(),
  sourceUrl: z.string().url().optional().nullable(),
  summary: z.string().optional().nullable(),
  fullText: z.string().optional().nullable(),
  effectiveDate: z.string().optional().nullable(),
  expiryDate: z.string().optional().nullable(),
  maturity: z.enum(["ALPHA", "BETA", "LIVE"]).optional(),
  tags: z.array(z.string()).optional(),
  active: z.boolean().optional(),
  markVerified: z.boolean().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;

  const legislation = await db.legislation.findUnique({
    where: { id },
    include: {
      jurisdiction: { select: { id: true, name: true, code: true } },
      complianceRules: {
        where: { active: true },
        orderBy: { sortOrder: "asc" },
        include: {
          category: { select: { id: true, name: true, slug: true } },
          platform: { select: { id: true, name: true } },
          country: { select: { id: true, name: true, code: true } },
        },
      },
      platformPolicies: {
        include: {
          platformPolicy: {
            select: { id: true, title: true, slug: true, platform: { select: { name: true } } },
          },
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

  if (!legislation) {
    return NextResponse.json(
      { success: false, error: { message: "Not found" } },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, data: legislation });
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

  const { markVerified, effectiveDate, expiryDate, ...rest } = parsed.data;
  const session = await auth();

  const updateData: Record<string, unknown> = { ...rest };
  if (effectiveDate !== undefined) updateData.effectiveDate = effectiveDate ? new Date(effectiveDate) : null;
  if (expiryDate !== undefined) updateData.expiryDate = expiryDate ? new Date(expiryDate) : null;
  if (markVerified) {
    updateData.lastVerifiedAt = new Date();
    updateData.lastVerifiedById = session?.user?.id;
  }

  const legislation = await db.legislation.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json({ success: true, data: legislation });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;

  const ruleCount = await db.complianceRule.count({ where: { legislationId: id } });
  if (ruleCount > 0) {
    return NextResponse.json(
      { success: false, error: { message: "Cannot delete: legislation has derived rules. Deactivate it instead." } },
      { status: 400 }
    );
  }

  await db.legislation.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
