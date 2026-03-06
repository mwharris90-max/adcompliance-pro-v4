import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

const createSchema = z.object({
  email: z.string().email(),
  organisationId: z.string().optional(),
  expiryDays: z.number().int().min(1).max(30).default(7),
});

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const invites = await db.invite.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      organisation: { select: { name: true } },
      invitedBy: { select: { name: true } },
    },
  });

  return NextResponse.json({ success: true, data: invites });
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

  // Check email not already a user
  const existing = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    return NextResponse.json(
      { success: false, error: { message: "A user with this email already exists" } },
      { status: 400 }
    );
  }

  // Revoke any pending invites for this email
  await db.invite.updateMany({
    where: { email: parsed.data.email, usedAt: null },
    data: { expiresAt: new Date() }, // expire immediately
  });

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + parsed.data.expiryDays * 24 * 60 * 60 * 1000);

  const invite = await db.invite.create({
    data: {
      email: parsed.data.email,
      token,
      organisationId: parsed.data.organisationId ?? null,
      invitedById: session.user.id,
      expiresAt,
    },
    include: {
      organisation: { select: { name: true } },
    },
  });

  const inviteUrl = `${process.env.NEXTAUTH_URL}/invite/${token}`;

  return NextResponse.json({ success: true, data: { ...invite, inviteUrl } }, { status: 201 });
}
