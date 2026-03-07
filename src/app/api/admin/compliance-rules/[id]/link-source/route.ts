import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

const linkSchema = z.object({
  action: z.enum(["link_existing", "create_and_link"]),
  sourceType: z.enum(["LEGISLATION", "PLATFORM_POLICY"]),
  // For link_existing
  legislationId: z.string().optional(),
  platformPolicyId: z.string().optional(),
  // For create_and_link
  title: z.string().optional(),
  sourceUrl: z.string().optional(),
  summary: z.string().optional(),
  jurisdiction: z.string().optional(),
});

/**
 * POST /api/admin/compliance-rules/[id]/link-source
 * Link a source document to a compliance rule. Can link an existing one or create a new one.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const parsed = linkSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { message: "Validation failed" } },
      { status: 400 }
    );
  }

  const rule = await db.complianceRule.findUnique({ where: { id } });
  if (!rule) {
    return NextResponse.json(
      { success: false, error: { message: "Rule not found" } },
      { status: 404 }
    );
  }

  const data = parsed.data;

  if (data.action === "link_existing") {
    if (data.sourceType === "LEGISLATION" && data.legislationId) {
      await db.complianceRule.update({
        where: { id },
        data: {
          legislationId: data.legislationId,
          sourceType: "LEGISLATION",
        },
      });
    } else if (data.sourceType === "PLATFORM_POLICY" && data.platformPolicyId) {
      await db.complianceRule.update({
        where: { id },
        data: {
          platformPolicyId: data.platformPolicyId,
          sourceType: "PLATFORM_POLICY",
        },
      });
    }

    const updated = await db.complianceRule.findUnique({
      where: { id },
      include: {
        legislation: { select: { id: true, title: true } },
        platformPolicy: { select: { id: true, title: true } },
      },
    });

    return NextResponse.json({ success: true, data: updated });
  }

  // create_and_link
  if (!data.title) {
    return NextResponse.json(
      { success: false, error: { message: "Title is required" } },
      { status: 400 }
    );
  }

  if (data.sourceType === "LEGISLATION") {
    // Find or create jurisdiction
    let jurisdictionId: string | undefined;
    if (rule.countryId) {
      jurisdictionId = rule.countryId;
    } else if (data.jurisdiction) {
      const country = await db.country.findFirst({
        where: {
          OR: [
            { name: { contains: data.jurisdiction, mode: "insensitive" } },
            { code: { equals: data.jurisdiction, mode: "insensitive" } },
          ],
        },
      });
      if (country) jurisdictionId = country.id;
    }

    const legislation = await db.legislation.create({
      data: {
        title: data.title,
        slug: data.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "")
          .slice(0, 100),
        type: "STATUTE",
        sourceUrl: data.sourceUrl ?? null,
        summary: data.summary ?? null,
        jurisdictionId: jurisdictionId ?? null,
        maturity: "ALPHA",
      },
    });

    await db.complianceRule.update({
      where: { id },
      data: {
        legislationId: legislation.id,
        sourceType: "LEGISLATION",
      },
    });

    return NextResponse.json({
      success: true,
      data: { legislationId: legislation.id, title: legislation.title },
    });
  } else {
    // PLATFORM_POLICY
    if (!rule.platformId) {
      return NextResponse.json(
        { success: false, error: { message: "Cannot create a platform policy without a platform. Link a platform to this rule first." } },
        { status: 400 }
      );
    }

    const platformPolicy = await db.platformPolicy.create({
      data: {
        title: data.title,
        slug: data.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "")
          .slice(0, 100),
        sourceUrl: data.sourceUrl ?? null,
        summary: data.summary ?? null,
        platform: { connect: { id: rule.platformId } },
        maturity: "ALPHA",
      },
    });

    await db.complianceRule.update({
      where: { id },
      data: {
        platformPolicyId: platformPolicy.id,
        sourceType: "PLATFORM_POLICY",
      },
    });

    return NextResponse.json({
      success: true,
      data: { platformPolicyId: platformPolicy.id, title: platformPolicy.title },
    });
  }
}

/**
 * DELETE /api/admin/compliance-rules/[id]/link-source
 * Unlink a source from a compliance rule (does not delete the source itself).
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;

  await db.complianceRule.update({
    where: { id },
    data: {
      legislationId: null,
      platformPolicyId: null,
      sourceType: "PLATFORM_INDEPENDENT",
    },
  });

  return NextResponse.json({ success: true });
}
