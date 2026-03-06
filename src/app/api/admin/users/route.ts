import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

const createSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/, "Username may only contain letters, numbers, underscores and hyphens"),
  password: z.string().min(8),
  role: z.enum(["USER", "ADMIN"]).default("USER"),
});

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const users = await db.user.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      username: true,
      role: true,
      active: true,
      forcePasswordReset: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ success: true, data: users });
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

  // Check uniqueness
  const [existingEmail, existingUsername] = await Promise.all([
    db.user.findUnique({ where: { email: parsed.data.email } }),
    db.user.findUnique({ where: { username: parsed.data.username } }),
  ]);

  if (existingEmail) {
    return NextResponse.json(
      { success: false, error: { message: "A user with this email already exists" } },
      { status: 400 }
    );
  }
  if (existingUsername) {
    return NextResponse.json(
      { success: false, error: { message: "A user with this username already exists" } },
      { status: 400 }
    );
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  const user = await db.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      username: parsed.data.username,
      passwordHash,
      role: parsed.data.role,
      forcePasswordReset: true,
      active: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      username: true,
      role: true,
      active: true,
      forcePasswordReset: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ success: true, data: user }, { status: 201 });
}
