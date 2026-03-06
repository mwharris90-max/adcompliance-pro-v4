import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const updateSchema = z.object({
  question: z.string().min(1).optional(),
  adCopy: z.string().min(1).optional(),
  problemTerms: z
    .array(z.object({ term: z.string().min(1), explanation: z.string().min(1) }))
    .min(1)
    .optional(),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).optional(),
  articleId: z.string().optional().or(z.literal("")),
  platformId: z.string().optional().or(z.literal("")),
  categoryId: z.string().optional().or(z.literal("")),
  tags: z.array(z.string()).optional(),
  sortOrder: z.number().optional(),
  published: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const data = parsed.data;

  const quiz = await db.policyQuiz.update({
    where: { id },
    data: {
      ...(data.question !== undefined && { question: data.question }),
      ...(data.adCopy !== undefined && { adCopy: data.adCopy }),
      ...(data.problemTerms !== undefined && { problemTerms: data.problemTerms }),
      ...(data.difficulty !== undefined && { difficulty: data.difficulty }),
      ...(data.articleId !== undefined && { articleId: data.articleId || null }),
      ...(data.platformId !== undefined && { platformId: data.platformId || null }),
      ...(data.categoryId !== undefined && { categoryId: data.categoryId || null }),
      ...(data.tags !== undefined && { tags: data.tags }),
      ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
      ...(data.published !== undefined && { published: data.published }),
    },
  });

  return NextResponse.json({ quiz });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await db.policyQuiz.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
