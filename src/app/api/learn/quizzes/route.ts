import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * GET /api/learn/quizzes — list published quizzes for users
 */
export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const quizzes = await db.policyQuiz.findMany({
    where: { published: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      question: true,
      adCopy: true,
      difficulty: true,
      tags: true,
      article: { select: { slug: true, title: true } },
      platform: { select: { name: true } },
      category: { select: { name: true } },
    },
  });

  return NextResponse.json({ quizzes });
}
