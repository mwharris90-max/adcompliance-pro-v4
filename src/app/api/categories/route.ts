import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { internalError } from "@/lib/api-error";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { success: false, error: { message: "Unauthorized" } },
      { status: 401 }
    );
  }

  try {
    const categories = await db.category.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        parentId: true,
        platformRules: { select: { status: true } },
        geoRules: { select: { status: true } },
      },
    });

    // Derive the worst restriction level for each category
    const STATUS_RANK: Record<string, number> = { ALLOWED: 0, UNKNOWN: 1, RESTRICTED: 2, PROHIBITED: 3 };
    const data = categories.map((cat) => {
      const allStatuses = [
        ...cat.platformRules.map((r) => r.status),
        ...cat.geoRules.map((r) => r.status),
      ];
      let worstLevel: "allowed" | "restricted" | "prohibited" = "allowed";
      for (const s of allStatuses) {
        if (STATUS_RANK[s] === 3) { worstLevel = "prohibited"; break; }
        if (STATUS_RANK[s] === 2) worstLevel = "restricted";
      }
      return {
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        parentId: cat.parentId,
        restrictionLevel: worstLevel,
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (err) {
    return internalError(err, "GET /api/categories");
  }
}
