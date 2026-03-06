import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { internalError } from "@/lib/api-error";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { success: false, error: { message: "Unauthorized" } },
      { status: 401 }
    );
  }

  try {
    const platforms = await db.platform.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        parentName: true,
      },
    });
    return NextResponse.json({ success: true, data: platforms });
  } catch (err) {
    return internalError(err, "GET /api/platforms");
  }
}
