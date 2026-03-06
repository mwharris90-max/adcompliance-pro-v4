import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";

interface RowForDetection {
  key: string; // unique identifier (e.g. row record ID)
  text: string; // combined ad text for detection
}

export interface DetectedCategory {
  key: string;
  categoryId: string;
  categoryName: string;
  confidence: number;
}

const BATCH_SIZE = 10; // rows per AI call
const MAX_PARALLEL = 3; // concurrent API calls

/**
 * Detect the most appropriate compliance category for each row in a bulk upload.
 * Batches multiple rows into parallel AI calls for speed.
 * Returns a Map from row key to detected category.
 */
export async function detectCategoriesForRows(
  rows: RowForDetection[]
): Promise<Map<string, DetectedCategory>> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.includes("REPLACE")) {
    console.log("[bulk-detect] No valid API key, skipping detection");
    return new Map();
  }

  // Fetch all active categories (excluding parent groups)
  const categories = await db.category.findMany({
    where: { active: true, parentId: { not: null } },
    select: { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
  });

  console.log(`[bulk-detect] Found ${categories.length} categories, processing ${rows.length} rows`);
  if (categories.length === 0) return new Map();

  const client = new Anthropic();
  const results = new Map<string, DetectedCategory>();

  // Build all batches
  const batches: RowForDetection[][] = [];
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    batches.push(rows.slice(i, i + BATCH_SIZE));
  }

  // Process batches in parallel (up to MAX_PARALLEL concurrent)
  async function processBatch(batch: RowForDetection[]) {
    try {
      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        tools: [
          {
            name: "categorise_ads",
            description:
              "Assign the single most relevant advertising compliance category to each ad",
            input_schema: {
              type: "object" as const,
              properties: {
                assignments: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      rowKey: {
                        type: "string",
                        description: "The row key from the input",
                      },
                      categoryId: {
                        type: "string",
                        description: "The most relevant category ID",
                      },
                      confidence: {
                        type: "number",
                        description: "Confidence 0-1",
                      },
                    },
                    required: ["rowKey", "categoryId", "confidence"],
                  },
                },
              },
              required: ["assignments"],
            },
          },
        ],
        tool_choice: { type: "tool", name: "categorise_ads" },
        messages: [
          {
            role: "user",
            content: `Assign the single most relevant advertising compliance category to each ad below.

IMPORTANT RULES:
- Always prefer the most SPECIFIC category available.
- Only assign restricted/prohibited categories if the ad DIRECTLY promotes that product type to consumers.
- Corporate communications, white papers, or investor materials should use corporate/general categories, NOT the regulated product category.

CATEGORIES:
${categories.map((c) => `- ID: ${c.id} | ${c.name}`).join("\n")}

ADS TO CATEGORISE:
${batch.map((r) => `[ROW: ${r.key}]\n${r.text}\n`).join("\n")}`,
          },
        ],
      });

      const toolUse = response.content.find((b) => b.type === "tool_use");
      if (toolUse && toolUse.type === "tool_use") {
        const input = toolUse.input as {
          assignments: Array<{
            rowKey: string;
            categoryId: string;
            confidence: number;
          }>;
        };

        console.log(`[bulk-detect] Batch: stop=${response.stop_reason}, assignments=${input.assignments?.length ?? 0}, usage=${JSON.stringify(response.usage)}`);

        for (const assignment of input.assignments ?? []) {
          const cat = categories.find((c) => c.id === assignment.categoryId);
          if (cat && assignment.confidence > 0.2) {
            results.set(assignment.rowKey, {
              key: assignment.rowKey,
              categoryId: cat.id,
              categoryName: cat.name,
              confidence: assignment.confidence,
            });
          }
        }
      } else {
        console.log("[bulk-detect] No tool_use in response, stop_reason:", response.stop_reason);
      }
    } catch (err) {
      console.error("[bulk-detect] Category detection failed for batch:", err);
    }
  }

  // Run batches with controlled parallelism
  for (let i = 0; i < batches.length; i += MAX_PARALLEL) {
    await Promise.all(
      batches.slice(i, i + MAX_PARALLEL).map(processBatch)
    );
  }

  return results;
}

/**
 * Build detection text from ad content fields.
 */
export function buildDetectionText(
  adContent: Record<string, string>
): string {
  const parts: string[] = [];
  // Headlines
  for (let i = 1; i <= 15; i++) {
    const h = adContent[`headline${i}`];
    if (h) parts.push(h);
  }
  // Descriptions
  for (let i = 1; i <= 4; i++) {
    const d = adContent[`description${i}`];
    if (d) parts.push(d);
  }
  // URL can hint at category
  if (adContent.finalUrl) parts.push(adContent.finalUrl);
  return parts.join(" | ");
}
