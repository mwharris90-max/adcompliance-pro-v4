import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

const createSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  active: z.boolean().default(true),
  parentId: z.string().optional(),
  iconName: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const search = req.nextUrl.searchParams.get("search") ?? "";
  const parentId = req.nextUrl.searchParams.get("parentId");
  const groupView = req.nextUrl.searchParams.get("groupView") === "true";

  // Group view: return parent groups with aggregated child info
  if (groupView) {
    const groups = await db.category.findMany({
      where: {
        parentId: null,
        iconName: { not: null },
        ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
      },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        iconName: true,
        active: true,
        children: {
          select: {
            id: true,
            lastReviewedAt: true,
            active: true,
            platformRules: { select: { status: true } },
            geoRules: { select: { status: true } },
          },
        },
      },
    });

    const STATUS_RANK: Record<string, number> = { ALLOWED: 0, UNKNOWN: 1, RESTRICTED: 2, PROHIBITED: 3 };

    const data = groups.map((g) => {
      const childCount = g.children.length;
      const activeCount = g.children.filter((c) => c.active).length;
      const reviewedCount = g.children.filter((c) => c.lastReviewedAt).length;

      // Find oldest review and newest review
      const reviewDates = g.children
        .map((c) => c.lastReviewedAt)
        .filter((d): d is Date => d !== null);
      const oldestReview = reviewDates.length > 0
        ? new Date(Math.min(...reviewDates.map((d) => d.getTime())))
        : null;
      const newestReview = reviewDates.length > 0
        ? new Date(Math.max(...reviewDates.map((d) => d.getTime())))
        : null;

      // Worst restriction level across all children
      let worstLevel: "allowed" | "restricted" | "prohibited" = "allowed";
      for (const child of g.children) {
        for (const r of [...child.platformRules, ...child.geoRules]) {
          if (STATUS_RANK[r.status] === 3) { worstLevel = "prohibited"; break; }
          if (STATUS_RANK[r.status] === 2) worstLevel = "restricted";
        }
        if (worstLevel === "prohibited") break;
      }

      return {
        id: g.id,
        name: g.name,
        slug: g.slug,
        description: g.description,
        iconName: g.iconName,
        active: g.active,
        childCount,
        activeCount,
        reviewedCount,
        oldestReview,
        newestReview,
        restrictionLevel: worstLevel,
      };
    });

    return NextResponse.json({ success: true, data });
  }

  // Detail view: return children of a specific parent, or all categories
  const where = parentId
    ? { parentId, ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}) }
    : search
      ? { name: { contains: search, mode: "insensitive" as const } }
      : undefined;

  const categories = await db.category.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      active: true,
      sortOrder: true,
      parentId: true,
      iconName: true,
      lastReviewedAt: true,
      lastReviewedById: true,
      reviewedBy: { select: { name: true } },
      _count: { select: { platformRules: true, geoRules: true } },
      platformRules: { select: { status: true } },
      geoRules: { select: { status: true } },
    },
  });

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
      active: cat.active,
      sortOrder: cat.sortOrder,
      parentId: cat.parentId,
      iconName: cat.iconName,
      lastReviewedAt: cat.lastReviewedAt,
      reviewedByName: cat.reviewedBy?.name ?? null,
      ruleCount: cat._count.platformRules + cat._count.geoRules,
      restrictionLevel: worstLevel,
    };
  });

  return NextResponse.json({ success: true, data });
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { message: "Validation failed", details: parsed.error.flatten().fieldErrors } },
      { status: 400 }
    );
  }

  const existing = await db.category.findFirst({
    where: { OR: [{ name: parsed.data.name }, { slug: parsed.data.slug }] },
  });
  if (existing) {
    return NextResponse.json(
      { success: false, error: { message: "A category with this name or slug already exists" } },
      { status: 400 }
    );
  }

  const category = await db.category.create({ data: parsed.data });
  return NextResponse.json({ success: true, data: category }, { status: 201 });
}
