import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * GET /api/learn/[slug]
 * Returns a single policy article by slug with full content.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;

  const article = await db.policyArticle.findUnique({
    where: { slug },
    include: {
      platform: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
      country: { select: { id: true, name: true } },
    },
  });

  if (!article || !article.published) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  // Get related articles (same platform or category)
  const related = await db.policyArticle.findMany({
    where: {
      published: true,
      id: { not: article.id },
      OR: [
        ...(article.platformId ? [{ platformId: article.platformId }] : []),
        ...(article.categoryId ? [{ categoryId: article.categoryId }] : []),
      ],
    },
    take: 4,
    select: {
      slug: true,
      title: true,
      summary: true,
      tags: true,
      platform: { select: { name: true } },
      category: { select: { name: true } },
    },
  });

  return NextResponse.json({ article, related });
}
