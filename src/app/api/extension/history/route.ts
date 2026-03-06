import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyExtensionToken } from "@/lib/extension-auth";

/**
 * GET /api/extension/history
 * Returns last 20 compliance checks for the user (most recent first).
 */
export async function GET(req: NextRequest) {
  const cors = corsHeaders();
  const auth = extractToken(req);

  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: cors });
  }

  const checks = await db.complianceCheck.findMany({
    where: { userId: auth.userId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      status: true,
      overallStatus: true,
      adContent: true,
      source: true,
      createdAt: true,
      completedAt: true,
    },
  });

  const items = checks.map((c) => {
    const content = c.adContent as Record<string, string> | null;
    return {
      id: c.id,
      status: c.overallStatus ?? c.status,
      headline: content?.headline ?? content?.googleHeadlines?.[0] ?? "",
      body: content?.body ?? "",
      source: c.source ?? "WEB",
      createdAt: c.createdAt.toISOString(),
    };
  });

  return NextResponse.json({ checks: items }, { headers: cors });
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
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}
