import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * POST /api/certifications/required
 * Given platformIds + categoryIds, returns which certifications are required
 * and whether the user/org already holds them.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const platformIds = (body.platformIds ?? []) as string[];
  const categoryIds = (body.categoryIds ?? []) as string[];

  if (!platformIds.length || !categoryIds.length) {
    return NextResponse.json({ success: true, data: { required: [], held: [] } });
  }

  // Find certifications that match selected platforms AND have overlapping categories
  const allCerts = await db.platformCertification.findMany({
    where: {
      active: true,
      platformId: { in: platformIds },
    },
    include: {
      platform: { select: { id: true, name: true, slug: true } },
    },
  });

  // Filter to certs where at least one selected category is in the cert's categoryIds
  const required = allCerts.filter((cert) =>
    cert.categoryIds.some((cid) => categoryIds.includes(cid))
  );

  if (!required.length) {
    return NextResponse.json({ success: true, data: { required: [], held: [] } });
  }

  // Check which the user/org already holds
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { organisationId: true },
  });

  const heldCerts = await db.orgCertification.findMany({
    where: {
      active: true,
      certificationId: { in: required.map((c) => c.id) },
      OR: [
        { userId: session.user.id },
        ...(user?.organisationId ? [{ organisationId: user.organisationId }] : []),
      ],
    },
    select: { certificationId: true },
  });

  const heldIds = new Set(heldCerts.map((h) => h.certificationId));

  // Fetch category names for display
  const categoryNames = await db.category.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, name: true },
  });
  const catNameMap = new Map(categoryNames.map((c) => [c.id, c.name]));

  return NextResponse.json({
    success: true,
    data: {
      required: required.map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        platform: c.platform,
        description: c.description,
        infoUrl: c.infoUrl,
        categoryIds: c.categoryIds,
        affectedCategories: c.categoryIds
          .filter((cid) => categoryIds.includes(cid))
          .map((cid) => catNameMap.get(cid) ?? cid),
        held: heldIds.has(c.id),
      })),
      held: Array.from(heldIds),
    },
  });
}
