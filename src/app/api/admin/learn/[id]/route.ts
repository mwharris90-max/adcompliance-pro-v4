import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/).optional(),
  summary: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
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
  tags: z.array(z.string()).optional(),
  sortOrder: z.number().optional(),
  published: z.boolean().optional(),
});

/**
 * PATCH /api/admin/learn/[id] — update an article
 */
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

  const article = await db.policyArticle.update({
    where: { id },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.slug !== undefined && { slug: data.slug }),
      ...(data.summary !== undefined && { summary: data.summary }),
      ...(data.content !== undefined && { content: data.content }),
      ...(data.examples !== undefined && { examples: data.examples }),
      ...(data.videoUrl !== undefined && { videoUrl: data.videoUrl || null }),
      ...(data.videoTitle !== undefined && { videoTitle: data.videoTitle || null }),
      ...(data.platformId !== undefined && { platformId: data.platformId || null }),
      ...(data.categoryId !== undefined && { categoryId: data.categoryId || null }),
      ...(data.countryId !== undefined && { countryId: data.countryId || null }),
      ...(data.tags !== undefined && { tags: data.tags }),
      ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
      ...(data.published !== undefined && { published: data.published }),
    },
  });

  return NextResponse.json({ article });
}

/**
 * DELETE /api/admin/learn/[id] — delete an article
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await db.policyArticle.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
