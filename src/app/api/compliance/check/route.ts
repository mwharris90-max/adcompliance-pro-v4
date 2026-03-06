import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { runComplianceCheck, type AdContentPayload } from "@/lib/ai/runComplianceCheck";
import { deductCredits } from "@/lib/usage";
import { checkLimiter } from "@/lib/rate-limit";

const checkSchema = z.object({
  platformIds: z.array(z.string()).min(1, "Select at least one platform"),
  categoryIds: z.array(z.string()).min(1, "Select at least one category"),
  countryIds: z.array(z.string()).min(1, "Select at least one country"),
  adContent: z.record(z.string(), z.unknown()),
  assetUrls: z.array(z.string()).default([]),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { success: false, error: { message: "Unauthorized" } },
      { status: 401 }
    );
  }

  const rl = checkLimiter.check(session.user.id);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: { message: "Too many requests. Please slow down." } },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.resetMs / 1000)) } }
    );
  }

  const body = await req.json();
  const parsed = checkSchema.safeParse(body);

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

  const { platformIds, categoryIds, countryIds, adContent, assetUrls } =
    parsed.data;

  // Create the check record with RUNNING status
  const check = await db.complianceCheck.create({
    data: {
      userId: session.user.id,
      platformIds,
      categoryIds,
      countryIds,
      adContent: adContent as Prisma.InputJsonValue,
      assetUrls,
      status: "RUNNING",
      source: "WEB",
    },
  });

  try {
    // Run the compliance check synchronously
    const result = await runComplianceCheck({
      platformIds,
      categoryIds,
      countryIds,
      adContent: adContent as AdContentPayload,
      assetUrls,
    });

    // Persist results
    const updated = await db.complianceCheck.update({
      where: { id: check.id },
      data: {
        status: result.overallStatus,
        overallStatus: result.overallStatus,
        results: result as unknown as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    });

    // Deduct 1 Checkdit credit
    await deductCredits(session.user.id, 1);

    return NextResponse.json(
      {
        success: true,
        data: {
          checkId: updated.id,
          status: updated.status,
          overallStatus: updated.overallStatus,
          results: result,
          completedAt: updated.completedAt,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    // Mark as error but don't lose the check record
    await db.complianceCheck.update({
      where: { id: check.id },
      data: { status: "ERROR" },
    });

    console.error("[compliance/check] Failed:", err);
    return NextResponse.json(
      { success: false, error: { message: "Compliance check failed. Please try again." } },
      { status: 500 }
    );
  }
}
