import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

const adjustSchema = z.object({
  userId: z.string().min(1),
  type: z.enum(["GRANT", "REFUND"]),
  credits: z.number().int().positive("Credits must be positive"),
  reason: z.string().min(1, "Reason is required").max(200),
});

// GET — list all orgs with their credit balances and users
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const orgs = await db.organisation.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      creditBalance: true,
      monthlyLimit: true,
      users: {
        select: { id: true, name: true, email: true, role: true },
        orderBy: { name: "asc" },
      },
    },
  });

  // Also get recent transactions
  const recentTransactions = await db.creditTransaction.findMany({
    where: { type: { in: ["GRANT", "REFUND"] } },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      type: true,
      credits: true,
      packName: true,
      createdAt: true,
      user: { select: { name: true, email: true } },
      organisation: { select: { name: true } },
    },
  });

  return NextResponse.json({ success: true, data: { orgs, recentTransactions } });
}

// POST — grant or refund credits to a user's org
export async function POST(req: NextRequest) {
  const { error, session } = await requireAdmin();
  if (error) return error;

  const body = await req.json();
  const parsed = adjustSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { message: "Validation failed", details: parsed.error.flatten().fieldErrors } },
      { status: 400 }
    );
  }

  const { userId, type, credits, reason } = parsed.data;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { organisationId: true, name: true },
  });

  if (!user?.organisationId) {
    return NextResponse.json(
      { success: false, error: { message: "User has no organisation. Credits are stored at the org level." } },
      { status: 400 }
    );
  }

  await db.$transaction([
    db.organisation.update({
      where: { id: user.organisationId },
      data: { creditBalance: { increment: credits } },
    }),
    db.creditTransaction.create({
      data: {
        userId,
        organisationId: user.organisationId,
        type,
        credits,
        packName: `${type === "GRANT" ? "Admin grant" : "Refund"}: ${reason}`,
      },
    }),
  ]);

  console.log(
    `[admin-credits] ${session!.user.name} ${type.toLowerCase()}ed ${credits} credits to ${user.name} (org: ${user.organisationId}): ${reason}`
  );

  return NextResponse.json({ success: true });
}
