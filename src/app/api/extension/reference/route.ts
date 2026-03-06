import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyExtensionToken } from "@/lib/extension-auth";

/**
 * GET /api/extension/reference
 * Returns platforms, categories, and countries for the extension's check form.
 */
export async function GET(req: NextRequest) {
  const cors = corsHeaders();
  const auth = extractToken(req);

  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: cors });
  }

  const [platforms, categories, countries] = await Promise.all([
    db.platform.findMany({
      where: { active: true },
      select: { id: true, name: true, slug: true },
      orderBy: { name: "asc" },
    }),
    db.category.findMany({
      where: { active: true },
      select: { id: true, name: true, slug: true },
      orderBy: { sortOrder: "asc" },
    }),
    db.country.findMany({
      where: { approved: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return NextResponse.json({ platforms, categories, countries }, { headers: cors });
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
