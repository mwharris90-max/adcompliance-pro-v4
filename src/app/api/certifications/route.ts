import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * GET /api/certifications
 * Returns all active platform certifications.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const certifications = await db.platformCertification.findMany({
    where: { active: true },
    include: {
      platform: { select: { id: true, name: true, slug: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    success: true,
    data: certifications.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      platform: c.platform,
      description: c.description,
      infoUrl: c.infoUrl,
      categoryIds: c.categoryIds,
    })),
  });
}
