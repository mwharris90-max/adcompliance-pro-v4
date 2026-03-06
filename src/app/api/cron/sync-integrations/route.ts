import { NextRequest, NextResponse } from "next/server";
import { processAutoSync } from "@/lib/integrations/sync";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || !authHeader || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processAutoSync();
    console.log(`[cron/sync-integrations] Done:`, result);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[cron/sync-integrations] Failed:`, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
