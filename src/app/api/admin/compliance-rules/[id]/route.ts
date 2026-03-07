import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { auth } from "@/auth";
import { syncRuleToRuntime } from "@/lib/compliance/sync-rules";

const patchSchema = z.object({
  status: z.enum(["ALLOWED", "RESTRICTED", "PROHIBITED", "UNKNOWN"]).optional(),
  title: z.string().min(1).max(300).optional(),
  description: z.string().optional().nullable(),
  conditions: z.record(z.string(), z.unknown()).optional().nullable(),
  aiCheckInstructions: z.string().optional().nullable(),
  maturity: z.enum(["ALPHA", "BETA", "LIVE"]).optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  markVerified: z.boolean().optional(),
  legislationId: z.string().optional().nullable(),
  platformPolicyId: z.string().optional().nullable(),
  sourceType: z.enum(["LEGISLATION", "PLATFORM_POLICY", "PLATFORM_INDEPENDENT"]).optional(),
  parentRuleId: z.string().optional().nullable(),
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

  const { markVerified, ...rest } = parsed.data;
  const session = await auth();

  const updateData: Record<string, unknown> = { ...rest };
  if (markVerified) {
    updateData.lastVerifiedAt = new Date();
    updateData.lastVerifiedById = session?.user?.id;
  }

  const rule = await db.complianceRule.update({
    where: { id },
    data: updateData,
  });

  // Re-sync to runtime tables
  await syncRuleToRuntime(rule.id);

  return NextResponse.json({ success: true, data: rule });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;

  // Clean up synced runtime rules
  const rule = await db.complianceRule.findUnique({ where: { id } });
  if (rule?.syncedPlatformRuleId) {
    await db.platformRule.delete({ where: { id: rule.syncedPlatformRuleId } }).catch(() => {});
  }
  if (rule?.syncedGeoRuleId) {
    await db.geoRule.delete({ where: { id: rule.syncedGeoRuleId } }).catch(() => {});
  }

  await db.complianceRule.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
