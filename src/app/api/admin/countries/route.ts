import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const region = req.nextUrl.searchParams.get("region");
  const approved = req.nextUrl.searchParams.get("approved");
  const search = req.nextUrl.searchParams.get("search") ?? "";

  const countries = await db.country.findMany({
    where: {
      ...(region ? { region: region as never } : {}),
      ...(approved !== null && approved !== ""
        ? { approved: approved === "true" }
        : {}),
      ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
    },
    orderBy: [{ region: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      code: true,
      region: true,
      approved: true,
      approvedAt: true,
      complexRules: true,
      _count: { select: { geoRules: true } },
    },
  });

  return NextResponse.json({ success: true, data: countries });
}
