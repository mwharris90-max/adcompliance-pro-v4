import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const articleSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  summary: z.string().min(1),
  content: z.string().min(1),
  examples: z
    .array(
      z.object({
        good: z.string().optional(),
        bad: z.string().optional(),
        explanation: z.string(),
      })
    )
    .optional(),
  videoUrl: z.string().url().optional().or(z.literal("")),
  videoTitle: z.string().optional(),
  platformId: z.string().optional().or(z.literal("")),
  categoryId: z.string().optional().or(z.literal("")),
  countryId: z.string().optional().or(z.literal("")),
  tags: z.array(z.string()).default([]),
  sortOrder: z.number().default(0),
  published: z.boolean().default(true),
});

/**
 * GET /api/admin/learn — list all articles (including unpublished)
 */
export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const articles = await db.policyArticle.findMany({
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    include: {
      platform: { select: { name: true } },
      category: { select: { name: true } },
      country: { select: { name: true } },
    },
  });

  return NextResponse.json({ articles });
}

/**
 * POST /api/admin/learn — create a new article
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = articleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const data = parsed.data;

  const article = await db.policyArticle.create({
    data: {
      title: data.title,
      slug: data.slug,
      summary: data.summary,
      content: data.content,
      examples: data.examples ?? undefined,
      videoUrl: data.videoUrl || null,
      videoTitle: data.videoTitle || null,
      platformId: data.platformId || null,
      categoryId: data.categoryId || null,
      countryId: data.countryId || null,
      tags: data.tags,
      sortOrder: data.sortOrder,
      published: data.published,
      createdById: session.user.id,
    },
  });

  return NextResponse.json({ article }, { status: 201 });
}
