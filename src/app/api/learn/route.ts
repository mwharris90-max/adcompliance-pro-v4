import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * GET /api/learn
 * Returns published policy articles with optional filtering.
 *
 * Query params:
 *   platform: platform ID
 *   category: category ID
 *   tag: tag string
 *   q: search query (title/summary)
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = req.nextUrl.searchParams;
  const platformId = params.get("platform");
  const categoryId = params.get("category");
  const tag = params.get("tag");
  const q = params.get("q");

  const where: Record<string, unknown> = { published: true };
  if (platformId) where.platformId = platformId;
  if (categoryId) where.categoryId = categoryId;
  if (tag) where.tags = { has: tag };
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { summary: { contains: q, mode: "insensitive" } },
    ];
  }

  const [articles, platforms, categories, allTags] = await Promise.all([
    db.policyArticle.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
      select: {
        id: true,
        slug: true,
        title: true,
        summary: true,
        videoUrl: true,
        tags: true,
        platformId: true,
        categoryId: true,
        countryId: true,
        platform: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        country: { select: { id: true, name: true } },
      },
    }),
    db.platform.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { sortOrder: "asc" },
    }),
    db.category.findMany({
      where: {
        active: true,
        policyArticles: { some: { published: true } },
      },
      select: { id: true, name: true },
      orderBy: { sortOrder: "asc" },
    }),
    // Get all unique tags
    db.policyArticle.findMany({
      where: { published: true },
      select: { tags: true },
    }),
  ]);

  const uniqueTags = [...new Set(allTags.flatMap((a) => a.tags))].sort();

  return NextResponse.json({
    articles,
    filters: { platforms, categories, tags: uniqueTags },
  });
}
