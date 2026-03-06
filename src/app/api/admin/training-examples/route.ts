import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

const createSchema = z.object({
  title: z.string().min(1),
  contentSample: z.string().min(1),
  imageUrl: z.string().url().optional().nullable().or(z.literal("")),
  verdict: z.enum(["COMPLIANT", "NON_COMPLIANT"]),
  explanation: z.string().min(1),
  rubric: z.array(z.object({ key: z.string(), value: z.string() })).optional().nullable(),
  categoryId: z.string().optional().nullable(),
  platformId: z.string().optional().nullable(),
  countryId: z.string().optional().nullable(),
  active: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  const { session, error } = await requireAdmin();
  if (error) return error;
  void session;

  const search = req.nextUrl.searchParams.get("search") ?? "";
  const categoryId = req.nextUrl.searchParams.get("categoryId");
  const platformId = req.nextUrl.searchParams.get("platformId");
  const countryId = req.nextUrl.searchParams.get("countryId");
  const verdict = req.nextUrl.searchParams.get("verdict");

  const examples = await db.complianceExample.findMany({
    where: {
      supersededAt: null,
      ...(categoryId ? { categoryId } : {}),
      ...(platformId ? { platformId } : {}),
      ...(countryId ? { countryId } : {}),
      ...(verdict ? { verdict: verdict as "COMPLIANT" | "NON_COMPLIANT" } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" } },
              { contentSample: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      category: { select: { id: true, name: true } },
      platform: { select: { id: true, name: true } },
      country: { select: { id: true, name: true, code: true } },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  return NextResponse.json({ success: true, data: examples });
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { message: "Validation failed", details: parsed.error.flatten().fieldErrors } },
      { status: 400 }
    );
  }

  const { rubric, imageUrl, ...rest } = parsed.data;

  const example = await db.complianceExample.create({
    data: {
      ...rest,
      imageUrl: imageUrl || null,
      version: 1,
      createdById: session.user.id,
      ...(rubric != null ? { rubric: rubric as Prisma.InputJsonValue } : {}),
    },
    include: {
      category: { select: { id: true, name: true } },
      platform: { select: { id: true, name: true } },
      country: { select: { id: true, name: true, code: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ success: true, data: example }, { status: 201 });
}
