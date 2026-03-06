import { db } from "@/lib/db";

/** Returns the number of compliance checks the user's organisation has run this calendar month. */
export async function getMonthlyUsage(userId: string): Promise<{ used: number; limit: number | null }> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { organisationId: true, organisation: { select: { monthlyLimit: true } } },
  });

  const limit = user?.organisation?.monthlyLimit ?? null;

  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);

  // Count checks for the whole organisation this month (or just this user if no org)
  let used: number;
  if (user?.organisationId) {
    const orgUsers = await db.user.findMany({
      where: { organisationId: user.organisationId },
      select: { id: true },
    });
    const userIds = orgUsers.map((u) => u.id);
    used = await db.complianceCheck.count({
      where: { userId: { in: userIds }, createdAt: { gte: start } },
    });
  } else {
    used = await db.complianceCheck.count({
      where: { userId, createdAt: { gte: start } },
    });
  }

  return { used, limit };
}

/** Returns true if the user cannot run checks (over monthly limit OR zero credit balance). Always false for ADMIN users. */
export async function isOverLimit(userId: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true, organisationId: true },
  });
  if (user?.role === "ADMIN") return false;

  // Check monthly limit
  const { used, limit } = await getMonthlyUsage(userId);
  if (limit !== null && used >= limit) return true;

  // Check credit balance
  if (user?.organisationId) {
    const org = await db.organisation.findUnique({
      where: { id: user.organisationId },
      select: { creditBalance: true },
    });
    if ((org?.creditBalance ?? 0) <= 0) return true;
  }

  return false;
}

/** Returns the user's org credit balance. */
export async function getCreditBalance(userId: string): Promise<number> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { organisationId: true },
  });
  if (!user?.organisationId) return 0;

  const org = await db.organisation.findUnique({
    where: { id: user.organisationId },
    select: { creditBalance: true },
  });
  return org?.creditBalance ?? 0;
}

/** Deduct credits from the user's org creditBalance. Returns true if deduction succeeded. */
export async function deductCredits(userId: string, amount: number = 1): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true, organisationId: true },
  });

  // Admins don't consume credits
  if (user?.role === "ADMIN") return true;

  if (!user?.organisationId) return true;

  const org = await db.organisation.findUnique({
    where: { id: user.organisationId },
    select: { creditBalance: true },
  });

  if ((org?.creditBalance ?? 0) < amount) return false;

  await db.$transaction([
    db.organisation.update({
      where: { id: user.organisationId },
      data: {
        creditBalance: { decrement: amount },
        monthlyCreditsUsed: { increment: amount },
      },
    }),
    db.creditTransaction.create({
      data: {
        userId,
        organisationId: user.organisationId,
        type: "DEDUCTION",
        credits: amount,
        packName: `Compliance check`,
      },
    }),
  ]);

  return true;
}
