import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

interface ProblemTerm {
  term: string;
  explanation: string;
}

/**
 * POST /api/learn/quizzes/[id]/check — check user's answers
 * Body: { selectedTerms: string[] }
 * Returns: { score, total, results: { term, found, explanation }[], missed: { term, explanation }[] }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const selectedTerms: string[] = body.selectedTerms ?? [];

  const quiz = await db.policyQuiz.findUnique({
    where: { id, published: true },
  });

  if (!quiz) {
    return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
  }

  const problemTerms = quiz.problemTerms as unknown as ProblemTerm[];
  const normalise = (s: string) => s.toLowerCase().trim();

  // Check which problem terms the user found
  const results = problemTerms.map((pt) => {
    const found = selectedTerms.some((sel) => {
      const normSel = normalise(sel);
      const normTerm = normalise(pt.term);
      // Exact match or the selected text contains/is contained in the term
      return normSel === normTerm || normSel.includes(normTerm) || normTerm.includes(normSel);
    });
    return { term: pt.term, found, explanation: pt.explanation };
  });

  // False positives: terms the user selected that don't match any problem term
  const falsePositives = selectedTerms.filter((sel) => {
    const normSel = normalise(sel);
    return !problemTerms.some((pt) => {
      const normTerm = normalise(pt.term);
      return normSel === normTerm || normSel.includes(normTerm) || normTerm.includes(normSel);
    });
  });

  const score = results.filter((r) => r.found).length;
  const total = problemTerms.length;

  return NextResponse.json({
    score,
    total,
    results,
    falsePositives,
  });
}
