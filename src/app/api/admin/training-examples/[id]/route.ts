import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

const patchSchema = z.object({
  title: z.string().min(1).optional(),
  contentSample: z.string().min(1).optional(),
  imageUrl: z.string().url().optional().nullable().or(z.literal("")),
  verdict: z.enum(["COMPLIANT", "NON_COMPLIANT"]).optional(),
  explanation: z.string().min(1).optional(),
  rubric: z.array(z.object({ key: z.string(), value: z.string() })).optional().nullable(),
  categoryId: z.string().optional().nullable(),
  platformId: z.string().optional().nullable(),
  countryId: z.string().optional().nullable(),
  active: z.boolean().optional(),
});

const CONTENT_FIELDS = ["title", "contentSample", "imageUrl", "verdict", "explanation", "rubric"] as const;

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
      { success: false, error: { message: "Validation failed", details: parsed.error.flatten().fieldErrors } },
      { status: 400 }
    );
  }

  const existing = await db.complianceExample.findUnique({ where: { id } });
  if (!existing || existing.supersededAt !== null) {
    return NextResponse.json(
      { success: false, error: { message: "Example not found" } },
      { status: 404 }
    );
  }

  // Detect mode: active-only toggle vs content edit
  const keys = Object.keys(parsed.data);
  const isActiveOnly = keys.length === 1 && keys[0] === "active";

  if (isActiveOnly) {
    // In-place update
    const updated = await db.complianceExample.update({
      where: { id },
      data: { active: parsed.data.active },
      include: {
        category: { select: { id: true, name: true } },
        platform: { select: { id: true, name: true } },
        country: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json({ success: true, data: updated });
  }

  // Content edit: check if any content fields are present
  const hasContentChange = CONTENT_FIELDS.some((f) => f in parsed.data);

  if (!hasContentChange) {
    // Only non-content fields (categoryId, platformId, countryId, active) — in-place update
    const { rubric, imageUrl, ...rest } = parsed.data;
    const updateData = {
      ...rest,
      ...(imageUrl !== undefined ? { imageUrl: imageUrl || null } : {}),
      ...(rubric !== undefined ? { rubric: rubric === null ? Prisma.JsonNull : (rubric as Prisma.InputJsonValue) } : {}),
    };
    const updated = await db.complianceExample.update({
      where: { id },
      data: updateData,
      include: {
        category: { select: { id: true, name: true } },
        platform: { select: { id: true, name: true } },
        country: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json({ success: true, data: updated });
  }

  // Versioned edit: archive old, create new
  const { rubric, imageUrl, ...restData } = parsed.data;

  const [, newExample] = await db.$transaction([
    db.complianceExample.update({
      where: { id },
      data: { supersededAt: new Date() },
    }),
    db.complianceExample.create({
      data: {
        title: restData.title ?? existing.title,
        contentSample: restData.contentSample ?? existing.contentSample,
        imageUrl: imageUrl !== undefined ? (imageUrl || null) : existing.imageUrl,
        verdict: restData.verdict ?? existing.verdict,
        explanation: restData.explanation ?? existing.explanation,
        rubric: rubric !== undefined
          ? (rubric === null ? Prisma.JsonNull : (rubric as Prisma.InputJsonValue))
          : (existing.rubric ?? Prisma.JsonNull),
        categoryId: restData.categoryId !== undefined ? restData.categoryId : existing.categoryId,
        platformId: restData.platformId !== undefined ? restData.platformId : existing.platformId,
        countryId: restData.countryId !== undefined ? restData.countryId : existing.countryId,
        active: restData.active !== undefined ? restData.active : existing.active,
        version: existing.version + 1,
        createdById: session.user.id,
      },
      include: {
        category: { select: { id: true, name: true } },
        platform: { select: { id: true, name: true } },
        country: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true } },
      },
    }),
  ]);

  return NextResponse.json({ success: true, data: newExample });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;
  void req;

  const { id } = await params;

  await db.complianceExample.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
