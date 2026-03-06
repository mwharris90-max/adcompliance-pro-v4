import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

// Revoke an invite
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  await db.invite.update({
    where: { id },
    data: { expiresAt: new Date() }, // expire immediately = revoked
  });

  return NextResponse.json({ success: true });
}
