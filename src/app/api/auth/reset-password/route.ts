import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { resetPasswordSchema } from "@/lib/validators/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, ...rest } = body;

    if (!token || typeof token !== "string") {
      return NextResponse.json(
        { success: false, error: { message: "Reset token is required" } },
        { status: 400 }
      );
    }

    const parsed = resetPasswordSchema.safeParse(rest);
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

    const resetToken = await db.passwordResetToken.findUnique({
      where: { token },
    });

    if (!resetToken || resetToken.used || resetToken.expiresAt < new Date()) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "This reset link is invalid or has expired.",
          },
        },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);

    await db.$transaction([
      db.user.update({
        where: { email: resetToken.email },
        data: { passwordHash, forcePasswordReset: false },
      }),
      db.passwordResetToken.update({
        where: { token },
        data: { used: true },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: "Password updated successfully.",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Something went wrong" } },
      { status: 500 }
    );
  }
}
