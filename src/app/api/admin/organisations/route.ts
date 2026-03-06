import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

const createSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(60).regex(/^[a-z0-9-]+$/),
  monthlyLimit: z.number().int().min(1).default(100),
});

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const orgs = await db.organisation.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { users: true, invites: true } } },
  });

  return NextResponse.json({ success: true, data: orgs });
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

  const existing = await db.organisation.findUnique({ where: { slug: parsed.data.slug } });
  if (existing) {
    return NextResponse.json(
      { success: false, error: { message: "An organisation with this slug already exists" } },
      { status: 400 }
    );
  }

  const org = await db.organisation.create({ data: parsed.data });
  return NextResponse.json({ success: true, data: org }, { status: 201 });
}
