import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyExtensionToken } from "@/lib/extension-auth";
import { getCreditBalance } from "@/lib/usage";

/**
 * GET /api/extension/me
 * Returns current user info + credit balance for the extension.
 */
export async function GET(req: NextRequest) {
  const cors = corsHeaders();
  const auth = extractToken(req);

  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: cors });
  }

  const user = await db.user.findUnique({
    where: { id: auth.userId },
    select: { id: true, name: true, email: true, role: true, organisationId: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 401, headers: cors });
  }

  const creditBalance = await getCreditBalance(user.id);

  return NextResponse.json(
    { user: { id: user.id, name: user.name, email: user.email, role: user.role }, creditBalance },
    { headers: cors }
  );
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
