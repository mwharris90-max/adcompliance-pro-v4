import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const quizSchema = z.object({
  question: z.string().min(1),
  adCopy: z.string().min(1),
  problemTerms: z.array(
    z.object({
      term: z.string().min(1),
      explanation: z.string().min(1),
    })
  ).min(1),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).default("MEDIUM"),
  articleId: z.string().optional().or(z.literal("")),
  platformId: z.string().optional().or(z.literal("")),
  categoryId: z.string().optional().or(z.literal("")),
  tags: z.array(z.string()).default([]),
  sortOrder: z.number().default(0),
  published: z.boolean().default(true),
});

/**
 * GET /api/admin/learn/quizzes — list all quizzes
 */
export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const quizzes = await db.policyQuiz.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: {
      article: { select: { title: true, slug: true } },
      platform: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ quizzes });
}

/**
 * POST /api/admin/learn/quizzes — create a quiz
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = quizSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const data = parsed.data;

  const quiz = await db.policyQuiz.create({
    data: {
      question: data.question,
      adCopy: data.adCopy,
      problemTerms: data.problemTerms,
      difficulty: data.difficulty,
      articleId: data.articleId || null,
      platformId: data.platformId || null,
      categoryId: data.categoryId || null,
      tags: data.tags,
      sortOrder: data.sortOrder,
      published: data.published,
    },
  });

  return NextResponse.json({ quiz }, { status: 201 });
}
