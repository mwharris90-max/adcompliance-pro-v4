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
    const countries = await db.country.findMany({
      where: { approved: true },
      orderBy: [{ region: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        code: true,
        region: true,
        complexRules: true,
      },
    });
    return NextResponse.json({ success: true, data: countries });
  } catch (err) {
    return internalError(err, "GET /api/countries/approved");
  }
}
