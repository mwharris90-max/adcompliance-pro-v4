import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

/** Generate a random password that satisfies the app's password policy:
 *  min 8 chars, at least 1 uppercase, at least 1 number */
function generatePassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const special = "!@#$%&*";
  const all = upper + lower + digits + special;

  // Guarantee policy requirements
  let pw = "";
  pw += upper[Math.floor(Math.random() * upper.length)];
  pw += digits[Math.floor(Math.random() * digits.length)];
  pw += lower[Math.floor(Math.random() * lower.length)];
  pw += special[Math.floor(Math.random() * special.length)];

  // Fill to 12 chars
  for (let i = 4; i < 12; i++) {
    pw += all[Math.floor(Math.random() * all.length)];
  }

  // Shuffle
  return pw.split("").sort(() => Math.random() - 0.5).join("");
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;

  const plainPassword = generatePassword();
  const passwordHash = await bcrypt.hash(plainPassword, 12);

  await db.user.update({
    where: { id },
    data: { passwordHash, forcePasswordReset: true },
  });

  // Return the plain password so the admin can share it with the user (shown once)
  return NextResponse.json({ success: true, data: { temporaryPassword: plainPassword } });
}
