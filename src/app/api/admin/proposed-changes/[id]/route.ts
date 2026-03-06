import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("confirm"),
    overrideData: z.record(z.string(), z.unknown()).optional(),
  }),
  z.object({
    action: z.literal("reject"),
    reviewNotes: z.string().optional(),
  }),
]);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const change = await db.proposedChange.findUnique({
    where: { id },
    include: {
      category: { select: { id: true, name: true } },
      country: { select: { id: true, name: true, code: true } },
      reviewedBy: { select: { id: true, name: true } },
    },
  });

  if (!change) {
    return NextResponse.json({ success: false, error: { message: "Not found" } }, { status: 404 });
  }

  // Fetch the current rule for side-by-side display
  let currentRule = null;
  if (change.currentRuleId) {
    if (change.ruleType === "PLATFORM_RULE") {
      currentRule = await db.platformRule.findUnique({
        where: { id: change.currentRuleId },
        include: {
          platform: { select: { id: true, name: true } },
          category: { select: { id: true, name: true } },
        },
      });
    } else if (change.ruleType === "GEO_RULE") {
      currentRule = await db.geoRule.findUnique({
        where: { id: change.currentRuleId },
        include: {
          country: { select: { id: true, name: true, code: true } },
          category: { select: { id: true, name: true } },
          platform: { select: { id: true, name: true } },
        },
      });
    }
  }

  return NextResponse.json({ success: true, data: { change, currentRule } });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const parsed = actionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { message: "Validation failed" } },
      { status: 400 }
    );
  }

  const change = await db.proposedChange.findUnique({ where: { id } });
  if (!change) {
    return NextResponse.json({ success: false, error: { message: "Not found" } }, { status: 404 });
  }
  if (change.status !== "PENDING") {
    return NextResponse.json(
      { success: false, error: { message: "This change has already been reviewed" } },
      { status: 400 }
    );
  }

  if (parsed.data.action === "reject") {
    await db.proposedChange.update({
      where: { id },
      data: {
        status: "REJECTED",
        reviewedById: session.user.id,
        reviewedAt: new Date(),
        reviewNotes: parsed.data.reviewNotes ?? null,
      },
    });
    return NextResponse.json({ success: true });
  }

  // Confirm action — apply proposedData to the relevant rule
  const applyData = parsed.data.overrideData ?? (change.proposedData as Record<string, unknown>);

  await db.$transaction(async (tx) => {
    if (change.ruleType === "PLATFORM_RULE") {
      if (change.changeType === "NEW_RULE") {
        if (!change.platformId || !change.categoryId) {
          throw new Error("Missing platformId or categoryId for new platform rule");
        }
        await tx.platformRule.create({
          data: {
            platformId: change.platformId,
            categoryId: change.categoryId,
            status: (applyData.status as never) ?? "UNKNOWN",
            notes: (applyData.notes as string) ?? null,
            conditions: applyData.conditions
              ? (applyData.conditions as Prisma.InputJsonValue)
              : Prisma.JsonNull,
            referenceUrl: (applyData.referenceUrl as string) ?? null,
            lastVerifiedAt: new Date(),
          },
        });
      } else if (change.changeType === "REMOVED_RULE" && change.currentRuleId) {
        await tx.platformRule.delete({ where: { id: change.currentRuleId } });
      } else if (change.currentRuleId) {
        await tx.platformRule.update({
          where: { id: change.currentRuleId },
          data: {
            ...(applyData.status ? { status: applyData.status as never } : {}),
            ...(applyData.notes !== undefined ? { notes: applyData.notes as string | null } : {}),
            ...(applyData.conditions !== undefined
              ? { conditions: applyData.conditions ? (applyData.conditions as Prisma.InputJsonValue) : Prisma.JsonNull }
              : {}),
            ...(applyData.referenceUrl !== undefined
              ? { referenceUrl: (applyData.referenceUrl as string) || null }
              : {}),
            lastVerifiedAt: new Date(),
          },
        });
      }
    } else if (change.ruleType === "GEO_RULE") {
      if (change.changeType === "NEW_RULE") {
        if (!change.countryId || !change.categoryId) {
          throw new Error("Missing countryId or categoryId for new geo rule");
        }
        await tx.geoRule.create({
          data: {
            countryId: change.countryId,
            categoryId: change.categoryId,
            platformId: change.platformId ?? null,
            status: (applyData.status as never) ?? "UNKNOWN",
            restrictions: applyData.restrictions
              ? (applyData.restrictions as Prisma.InputJsonValue)
              : Prisma.JsonNull,
            notes: (applyData.notes as string) ?? null,
            legislationUrl: (applyData.legislationUrl as string) ?? null,
            lastVerifiedAt: new Date(),
          },
        });
      } else if (change.changeType === "REMOVED_RULE" && change.currentRuleId) {
        await tx.geoRule.delete({ where: { id: change.currentRuleId } });
      } else if (change.currentRuleId) {
        await tx.geoRule.update({
          where: { id: change.currentRuleId },
          data: {
            ...(applyData.status ? { status: applyData.status as never } : {}),
            ...(applyData.restrictions !== undefined
              ? { restrictions: applyData.restrictions ? (applyData.restrictions as Prisma.InputJsonValue) : Prisma.JsonNull }
              : {}),
            ...(applyData.notes !== undefined ? { notes: applyData.notes as string | null } : {}),
            ...(applyData.legislationUrl !== undefined
              ? { legislationUrl: (applyData.legislationUrl as string) || null }
              : {}),
            lastVerifiedAt: new Date(),
          },
        });
      }
    }

    await tx.proposedChange.update({
      where: { id },
      data: {
        status: "CONFIRMED",
        reviewedById: session.user.id,
        reviewedAt: new Date(),
      },
    });
  });

  return NextResponse.json({ success: true });
}
