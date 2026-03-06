import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { WELCOME_CREDITS } from "@/lib/stripe";

const registerSchema = z.object({
  token: z.string().min(1),
  name: z.string().min(1).max(100),
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/, "Username may only contain letters, numbers, underscores and hyphens"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: "Validation failed", details: parsed.error.flatten().fieldErrors } },
        { status: 400 }
      );
    }

    const { token, name, username, password } = parsed.data;

    // Validate invite
    const invite = await db.invite.findUnique({ where: { token } });
    if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
      return NextResponse.json(
        { success: false, error: { message: "Invalid or expired invite link" } },
        { status: 400 }
      );
    }

    // Check username not taken
    const existingUsername = await db.user.findUnique({ where: { username } });
    if (existingUsername) {
      return NextResponse.json(
        { success: false, error: { message: "This username is already taken" } },
        { status: 400 }
      );
    }

    // Check email not already registered (shouldn't be, but belt-and-braces)
    const existingEmail = await db.user.findUnique({ where: { email: invite.email } });
    if (existingEmail) {
      return NextResponse.json(
        { success: false, error: { message: "An account with this email already exists" } },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Create user, mark invite used, and grant welcome credits
    const newUser = await db.user.create({
      data: {
        name,
        email: invite.email,
        username,
        passwordHash,
        role: "USER",
        active: true,
        forcePasswordReset: false,
        organisationId: invite.organisationId ?? null,
      },
    });

    await db.invite.update({
      where: { id: invite.id },
      data: { usedAt: new Date() },
    });

    // Grant welcome credits
    if (WELCOME_CREDITS > 0 && newUser.organisationId) {
      await db.$transaction([
        db.organisation.update({
          where: { id: newUser.organisationId },
          data: { creditBalance: { increment: WELCOME_CREDITS } },
        }),
        db.creditTransaction.create({
          data: {
            userId: newUser.id,
            organisationId: newUser.organisationId,
            type: "WELCOME",
            credits: WELCOME_CREDITS,
            packName: "Welcome Credits",
          },
        }),
      ]);
    }

    return NextResponse.json({ success: true, message: "Account created. You can now log in." }, { status: 201 });
  } catch (err) {
    console.error("[register] error:", err);
    return NextResponse.json(
      { success: false, error: { message: "Something went wrong. Please try again." } },
      { status: 500 }
    );
  }
}
