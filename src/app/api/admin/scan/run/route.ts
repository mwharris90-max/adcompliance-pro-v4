import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { runScan } from "@/lib/scan/runScan";

export async function POST() {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const summary = await runScan("MANUAL");
    return NextResponse.json({ success: true, data: summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: { message: `Scan failed: ${message}` } },
      { status: 500 }
    );
  }
}
