import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

const createSchema = z.object({
  platformId: z.string(),
  specType: z.enum(["CHARACTER_LIMIT", "FILE_SIZE", "FILE_FORMAT", "DIMENSIONS", "DURATION", "SAFE_ZONE", "OTHER"]),
  specKey: z.string().min(1),
  value: z.string().min(1),
  notes: z.string().optional().nullable(),
});

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const platformId = req.nextUrl.searchParams.get("platformId");

  const requirements = await db.channelRequirement.findMany({
    where: platformId ? { platformId } : undefined,
    orderBy: [{ specType: "asc" }, { specKey: "asc" }],
    include: { platform: { select: { id: true, name: true, slug: true } } },
  });

  return NextResponse.json({ success: true, data: requirements });
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

  const existing = await db.channelRequirement.findUnique({
    where: { platformId_specKey: { platformId: parsed.data.platformId, specKey: parsed.data.specKey } },
  });
  if (existing) {
    return NextResponse.json(
      { success: false, error: { message: "A requirement with this key already exists for this platform" } },
      { status: 400 }
    );
  }

  const req2 = await db.channelRequirement.create({ data: parsed.data });
  return NextResponse.json({ success: true, data: req2 }, { status: 201 });
}
