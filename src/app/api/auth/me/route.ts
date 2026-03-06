import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  updateProfileSchema,
  changePasswordSchema,
  resetPasswordSchema,
} from "@/lib/validators/auth";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, username: true, role: true, createdAt: true },
  });

  return NextResponse.json({ success: true, data: user });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  const body = await req.json();
  const { action } = body;

  // Update profile (name / email)
  if (action === "update-profile") {
    const parsed = updateProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "Validation failed",
            details: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    // Check email uniqueness if changing
    if (parsed.data.email !== session.user.email) {
      const existing = await db.user.findUnique({
        where: { email: parsed.data.email },
      });
      if (existing && existing.id !== session.user.id) {
        return NextResponse.json(
          { success: false, error: { message: "Email already in use" } },
          { status: 400 }
        );
      }
    }

    await db.user.update({
      where: { id: session.user.id },
      data: { name: parsed.data.name, email: parsed.data.email },
    });

    return NextResponse.json({ success: true });
  }

  // Change password (from settings or force-reset)
  if (action === "change-password") {
    const isForceReset = session.user.forcePasswordReset;

    if (isForceReset) {
      // Force reset: only need new password, no current password check
      const parsed = resetPasswordSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { success: false, error: { message: "Validation failed" } },
          { status: 400 }
        );
      }
      const passwordHash = await bcrypt.hash(parsed.data.password, 12);
      await db.user.update({
        where: { id: session.user.id },
        data: { passwordHash, forcePasswordReset: false },
      });
      return NextResponse.json({ success: true });
    }

    // Normal password change: verify current password
    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "Validation failed",
            details: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({ where: { id: session.user.id } });
    if (!user) return NextResponse.json({ success: false }, { status: 401 });

    const isValid = await bcrypt.compare(
      parsed.data.currentPassword,
      user.passwordHash
    );
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: { message: "Current password is incorrect" } },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
    await db.user.update({
      where: { id: session.user.id },
      data: { passwordHash },
    });

    return NextResponse.json({ success: true });
  }

  return NextResponse.json(
    { success: false, error: { message: "Unknown action" } },
    { status: 400 }
  );
}
