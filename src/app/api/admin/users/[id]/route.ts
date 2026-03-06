import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

const patchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  role: z.enum(["USER", "ADMIN"]).optional(),
  active: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { message: "Validation failed" } },
      { status: 400 }
    );
  }

  // Self-protection rules
  if (id === session.user.id) {
    if (parsed.data.role !== undefined && parsed.data.role !== session.user.role) {
      return NextResponse.json(
        { success: false, error: { message: "You cannot change your own role" } },
        { status: 400 }
      );
    }
    if (parsed.data.active === false) {
      return NextResponse.json(
        { success: false, error: { message: "You cannot deactivate your own account" } },
        { status: 400 }
      );
    }
  }

  // Check email uniqueness if changing
  if (parsed.data.email) {
    const existing = await db.user.findUnique({ where: { email: parsed.data.email } });
    if (existing && existing.id !== id) {
      return NextResponse.json(
        { success: false, error: { message: "Email already in use by another account" } },
        { status: 400 }
      );
    }
  }

  const user = await db.user.update({
    where: { id },
    data: parsed.data,
    select: {
      id: true,
      name: true,
      email: true,
      username: true,
      role: true,
      active: true,
      forcePasswordReset: true,
      lastLoginAt: true,
    },
  });

  return NextResponse.json({ success: true, data: user });
}
