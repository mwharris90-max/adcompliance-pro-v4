import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { Session } from "next-auth";

type AdminResult =
  | { session: Session & { user: { id: string; role: string } }; error: null }
  | { session: null; error: NextResponse };

/** Returns the session if the caller is an authenticated admin, else returns a 401/403 response. */
export async function requireAdmin(): Promise<AdminResult> {
  const session = await auth();
  if (!session) {
    return {
      session: null,
      error: NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 }),
    };
  }
  if (session.user.role !== "ADMIN") {
    return {
      session: null,
      error: NextResponse.json({ success: false, error: { message: "Forbidden" } }, { status: 403 }),
    };
  }
  return { session: session as Session & { user: { id: string; role: string } }, error: null };
}
