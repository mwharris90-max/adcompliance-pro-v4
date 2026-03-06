import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { detectChanges } from "./detectChanges";
import { sendConsolidatedScanEmail } from "@/lib/email";

function sha256(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function extractText(html: string): string {
  return html
    // Remove non-visible / navigational sections entirely
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<aside[\s\S]*?<\/aside>/gi, " ")
    // Strip remaining tags, decode entities, collapse whitespace
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export interface ScanSummary {
  sourcesScanned: number;
  sourcesChanged: number;
  changesCreated: number;
  errors: { sourceUrl: string; error: string }[];
}

export async function runScan(triggeredBy: "CRON" | "MANUAL" = "CRON"): Promise<ScanSummary> {
  // Create a ScanLog record immediately so the run is visible even if it errors
  const log = await db.scanLog.create({
    data: { triggeredBy, startedAt: new Date() },
  });

  const sources = await db.scanSource.findMany({
    where: { active: true },
    include: {
      platform: { select: { name: true } },
      country: { select: { name: true } },
      category: { select: { name: true } },
    },
  });

  const summary: ScanSummary = {
    sourcesScanned: sources.length,
    sourcesChanged: 0,
    changesCreated: 0,
    errors: [],
  };

  // Track changed sources for the consolidated email
  const changedSources: { label: string; url: string; changesCount: number }[] = [];

  for (const source of sources) {
    try {
      // 1. Fetch current content
      const response = await fetch(source.url, {
        headers: { "User-Agent": "AdCompliancePro/1.0 (+https://adcompliance.pro)" },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      const textContent = extractText(html);
      const currentHash = sha256(textContent);

      // 2. Update lastScannedAt regardless of content change
      if (currentHash === source.lastHash) {
        await db.scanSource.update({
          where: { id: source.id },
          data: { lastScannedAt: new Date() },
        });
        continue; // no change
      }

      summary.sourcesChanged++;

      // 3. Ask Claude to analyse the diff
      const result = await detectChanges({
        sourceUrl: source.url,
        previousContent: source.lastContent ?? "",
        currentContent: textContent,
        categoryName: source.category?.name,
        countryName: source.country?.name,
        platformName: source.platform?.name,
      });

      // 4. Persist ProposedChange records
      if (result.hasChanged) {
        for (const change of result.changes) {
          await db.proposedChange.create({
            data: {
              changeType: change.changeType,
              ruleType: change.ruleType,
              platformId: source.platformId ?? null,
              categoryId: source.categoryId ?? null,
              countryId: source.countryId ?? null,
              proposedData: change.proposedData as Prisma.InputJsonValue,
              aiSummary: change.aiSummary,
              sourceUrl: source.url,
              detectedAt: new Date(),
            },
          });
          summary.changesCreated++;
        }

        changedSources.push({
          label: source.label,
          url: source.url,
          changesCount: result.changes.length,
        });
      }

      // 5. Update hash, content, and timestamp
      await db.scanSource.update({
        where: { id: source.id },
        data: {
          lastHash: currentHash,
          lastContent: textContent.slice(0, 50000),
          lastScannedAt: new Date(),
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[scan] Failed for ${source.url}:`, message);
      summary.errors.push({ sourceUrl: source.url, error: message });
    }
  }

  // 6. Send consolidated email once (not per-source)
  if (changedSources.length > 0) {
    try {
      await sendConsolidatedScanEmail(summary, changedSources);
    } catch {
      // Non-fatal
    }
  }

  // 7. Update ScanLog with final results
  await db.scanLog.update({
    where: { id: log.id },
    data: {
      completedAt: new Date(),
      sourcesScanned: summary.sourcesScanned,
      sourcesChanged: summary.sourcesChanged,
      changesCreated: summary.changesCreated,
      errorCount: summary.errors.length,
      errors: summary.errors.length > 0
        ? (summary.errors as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull,
    },
  });

  return summary;
}
