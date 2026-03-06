import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { z } from "zod";

/**
 * GET /api/user/certifications
 * Returns the user/org's declared certifications.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { organisationId: true },
  });

  const certs = await db.orgCertification.findMany({
    where: {
      active: true,
      OR: [
        { userId: session.user.id },
        ...(user?.organisationId ? [{ organisationId: user.organisationId }] : []),
      ],
    },
    include: {
      certification: {
        include: {
          platform: { select: { name: true, slug: true } },
        },
      },
    },
    orderBy: { declaredAt: "desc" },
  });

  return NextResponse.json({
    success: true,
    data: certs.map((c) => ({
      id: c.id,
      certificationId: c.certificationId,
      name: c.certification.name,
      slug: c.certification.slug,
      platform: c.certification.platform,
      description: c.certification.description,
      infoUrl: c.certification.infoUrl,
      declaredAt: c.declaredAt.toISOString(),
      notes: c.notes,
    })),
  });
}

const declareSchema = z.object({
  certificationId: z.string().min(1),
  notes: z.string().optional(),
});

/**
 * POST /api/user/certifications
 * Declare that the user/org holds a certification.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = declareSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Validation failed" }, { status: 400 });
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { organisationId: true },
  });

  // Upsert — if org exists, use org scope; otherwise user scope
  const orgId = user?.organisationId ?? null;

  // Check if already declared
  const existing = await db.orgCertification.findFirst({
    where: {
      certificationId: parsed.data.certificationId,
      ...(orgId
        ? { organisationId: orgId }
        : { userId: session.user.id }),
    },
  });

  if (existing) {
    // Reactivate if inactive
    if (!existing.active) {
      await db.orgCertification.update({
        where: { id: existing.id },
        data: {
          active: true,
          declaredAt: new Date(),
          declaredById: session.user.id,
          notes: parsed.data.notes ?? existing.notes,
        },
      });
    }
    return NextResponse.json({ success: true });
  }

  await db.orgCertification.create({
    data: {
      organisationId: orgId,
      userId: session.user.id,
      certificationId: parsed.data.certificationId,
      declaredById: session.user.id,
      notes: parsed.data.notes ?? null,
    },
  });

  return NextResponse.json({ success: true });
}

const deleteSchema = z.object({
  certificationId: z.string().min(1),
});

/**
 * DELETE /api/user/certifications
 * Revoke a certification declaration.
 */
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Validation failed" }, { status: 400 });
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { organisationId: true },
  });

  const orgId = user?.organisationId ?? null;

  await db.orgCertification.updateMany({
    where: {
      certificationId: parsed.data.certificationId,
      ...(orgId
        ? { organisationId: orgId }
        : { userId: session.user.id }),
    },
    data: { active: false },
  });

  return NextResponse.json({ success: true });
}
