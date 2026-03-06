import Anthropic from "@anthropic-ai/sdk";

export interface DetectedChange {
  changeType: "NEW_RULE" | "AMENDED_RULE" | "REMOVED_RULE";
  ruleType: "PLATFORM_RULE" | "GEO_RULE" | "CHANNEL_REQUIREMENT";
  aiSummary: string;
  proposedData: Record<string, unknown>;
  /** Optional: if this maps to an existing rule, include contextual hints */
  affectedCategory?: string;
  affectedCountry?: string;
  affectedPlatform?: string;
}

export interface DetectChangesResult {
  hasChanged: boolean;
  changes: DetectedChange[];
}

const DETECT_TOOL = {
  name: "report_changes",
  description: "Report detected advertising policy changes from the diff",
  input_schema: {
    type: "object" as const,
    properties: {
      hasChanged: {
        type: "boolean",
        description: "Whether any meaningful compliance-relevant change was detected",
      },
      changes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            changeType: { type: "string", enum: ["NEW_RULE", "AMENDED_RULE", "REMOVED_RULE"] },
            ruleType: { type: "string", enum: ["PLATFORM_RULE", "GEO_RULE", "CHANNEL_REQUIREMENT"] },
            aiSummary: { type: "string", description: "1-3 sentence human-readable summary of the change" },
            affectedCategory: { type: "string" },
            affectedCountry: { type: "string" },
            affectedPlatform: { type: "string" },
            proposedData: {
              type: "object",
              description: "The updated rule fields — status, notes, conditions/restrictions, referenceUrl/legislationUrl",
            },
          },
          required: ["changeType", "ruleType", "aiSummary", "proposedData"],
        },
      },
    },
    required: ["hasChanged", "changes"],
  },
};

export async function detectChanges(opts: {
  sourceUrl: string;
  previousContent: string;
  currentContent: string;
  categoryName?: string;
  countryName?: string;
  platformName?: string;
}): Promise<DetectChangesResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.includes("REPLACE")) {
    // AI not configured — return a generic "content changed" signal
    return {
      hasChanged: true,
      changes: [
        {
          changeType: "AMENDED_RULE",
          ruleType: "PLATFORM_RULE",
          aiSummary: `Content changed at ${opts.sourceUrl}. Manual review required — AI analysis not configured.`,
          proposedData: { status: "UNKNOWN", notes: "Content changed — review source for details." },
          affectedCategory: opts.categoryName,
          affectedCountry: opts.countryName,
          affectedPlatform: opts.platformName,
        },
      ],
    };
  }

  const client = new Anthropic({ apiKey });

  const prompt = `You are an advertising compliance analyst. A monitored policy page has changed.

Source URL: ${opts.sourceUrl}
${opts.categoryName ? `Category context: ${opts.categoryName}` : ""}
${opts.countryName ? `Country context: ${opts.countryName}` : ""}
${opts.platformName ? `Platform context: ${opts.platformName}` : ""}

PREVIOUS CONTENT (truncated to 4000 chars):
${opts.previousContent.slice(0, 4000)}

CURRENT CONTENT (truncated to 4000 chars):
${opts.currentContent.slice(0, 4000)}

Analyse the difference between the previous and current content. Identify any changes that would affect advertising compliance rules — such as new restrictions, lifted restrictions, amended conditions, age gate changes, disclaimer requirements, or time restrictions.

If no compliance-relevant change is found (e.g. only navigation or styling changed), set hasChanged to false.

For each compliance change found, produce a report_changes entry with the rule data structured for our system:
- For PLATFORM_RULE proposedData: { status, notes, conditions: { ageGate, disclaimer, priorApproval }, referenceUrl }
- For GEO_RULE proposedData: { status, restrictions: { ageTargeting, timeRestrictions, mandatoryDisclaimer, audienceRestrictions }, notes, legislationUrl }
- For CHANNEL_REQUIREMENT proposedData: { specKey, value, notes }

Allowed status values: ALLOWED, RESTRICTED, PROHIBITED, UNKNOWN`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    tools: [DETECT_TOOL],
    tool_choice: { type: "any" },
    messages: [{ role: "user", content: prompt }],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    return { hasChanged: false, changes: [] };
  }

  return toolUse.input as DetectChangesResult;
}
