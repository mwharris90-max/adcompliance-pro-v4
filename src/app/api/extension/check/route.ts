import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { verifyExtensionToken } from "@/lib/extension-auth";
import { isOverLimit, deductCredits } from "@/lib/usage";
import {
  runComplianceCheck,
  type AdContentPayload,
} from "@/lib/ai/runComplianceCheck";

const checkSchema = z.object({
  headline: z.string().optional(),
  body: z.string().optional(),
  callToAction: z.string().optional(),
  displayUrl: z.string().optional(),
  platformIds: z.array(z.string()).min(1),
  categoryIds: z.array(z.string()).default([]),
  countryIds: z.array(z.string()).min(1),
  assetUrls: z.array(z.string()).default([]),
  sourceUrl: z.string().optional(),
});

/**
 * POST /api/extension/check
 * Run a compliance check from the Chrome extension.
 */
export async function POST(req: NextRequest) {
  const cors = corsHeaders();
  const auth = extractToken(req);

  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: cors });
  }

  const overLimit = await isOverLimit(auth.userId);
  if (overLimit) {
    return NextResponse.json(
      { error: "You have no Checkdits remaining. Please purchase more credits." },
      { status: 402, headers: cors }
    );
  }

  let parsed;
  try {
    const body = await req.json();
    parsed = checkSchema.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400, headers: cors });
  }

  const adContent: AdContentPayload = {};
  if (parsed.headline) adContent.headline = parsed.headline;
  if (parsed.body) adContent.body = parsed.body;
  if (parsed.callToAction) adContent.callToAction = parsed.callToAction;
  if (parsed.displayUrl) adContent.displayUrl = parsed.displayUrl;

  if (Object.keys(adContent).length === 0) {
    return NextResponse.json(
      { error: "At least one ad content field is required" },
      { status: 400, headers: cors }
    );
  }

  try {
    // Create the compliance check record
    const check = await db.complianceCheck.create({
      data: {
        userId: auth.userId,
        platformIds: parsed.platformIds,
        categoryIds: parsed.categoryIds,
        countryIds: parsed.countryIds,
        adContent: adContent as unknown as Prisma.InputJsonValue,
        assetUrls: parsed.assetUrls,
        status: "RUNNING",
        source: "EXTENSION",
      },
    });

    // Run the compliance check
    const result = await runComplianceCheck({
      platformIds: parsed.platformIds,
      categoryIds: parsed.categoryIds,
      countryIds: parsed.countryIds,
      adContent,
      assetUrls: parsed.assetUrls,
    });

    // Save results
    await db.complianceCheck.update({
      where: { id: check.id },
      data: {
        status: result.overallStatus,
        overallStatus: result.overallStatus,
        results: result as unknown as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    });

    // Deduct credit
    await deductCredits(auth.userId, 1);

    return NextResponse.json(
      {
        checkId: check.id,
        overallStatus: result.overallStatus,
        summary: result.summary,
        issues: result.issues,
        checklist: result.checklist,
      },
      { headers: cors }
    );
  } catch (err) {
    console.error("[extension/check] Error:", err);
    return NextResponse.json(
      { error: "Compliance check failed" },
      { status: 500, headers: cors }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

function extractToken(req: NextRequest) {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return verifyExtensionToken(header.slice(7));
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}
