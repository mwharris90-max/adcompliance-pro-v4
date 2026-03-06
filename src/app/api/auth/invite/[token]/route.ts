import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Public endpoint — validate an invite token and return the email
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const invite = await db.invite.findUnique({
    where: { token },
    include: { organisation: { select: { name: true } } },
  });

  if (!invite) {
    return NextResponse.json({ success: false, error: { message: "Invalid invite link" } }, { status: 404 });
  }
  if (invite.usedAt) {
    return NextResponse.json({ success: false, error: { message: "This invite has already been used" } }, { status: 410 });
  }
  if (invite.expiresAt < new Date()) {
    return NextResponse.json({ success: false, error: { message: "This invite link has expired" } }, { status: 410 });
  }

  return NextResponse.json({
    success: true,
    data: {
      email: invite.email,
      organisationName: invite.organisation?.name ?? null,
    },
  });
}
