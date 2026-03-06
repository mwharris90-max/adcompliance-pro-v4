import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { createExtensionToken } from "@/lib/extension-auth";
import { extensionAuthLimiter, getIpKey } from "@/lib/rate-limit";

/**
 * POST /api/extension/token
 * Chrome extension login — exchanges email + password for a long-lived token.
 */
export async function POST(req: NextRequest) {
  const cors = corsHeaders();

  // Rate limit by IP
  const rl = extensionAuthLimiter.check(getIpKey(req));
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many login attempts. Please try again later." },
      { status: 429, headers: { ...cors, "Retry-After": String(Math.ceil(rl.resetMs / 1000)) } }
    );
  }

  try {
    const { email, username, password } = await req.json();
    const login = email || username;

    if (!login || !password) {
      return NextResponse.json(
        { error: "Username/email and password are required" },
        { status: 400, headers: cors }
      );
    }

    const loginValue = login.toLowerCase().trim();
    const user = await db.user.findFirst({
      where: {
        OR: [
          { email: loginValue },
          { username: loginValue },
        ],
      },
      select: { id: true, email: true, username: true, name: true, passwordHash: true, role: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401, headers: cors }
      );
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401, headers: cors }
      );
    }

    const token = createExtensionToken(user.id, user.email || user.username || user.id);

    return NextResponse.json(
      {
        token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
      },
      { headers: cors }
    );
  } catch {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400, headers: cors }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}
