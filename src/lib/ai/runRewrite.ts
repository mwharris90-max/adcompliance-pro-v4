import { anthropic } from "./client";
import type { PlatformRuleRow, GeoRuleRow } from "./runComplianceCheck";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RewriteInput {
  originalText: string;       // empty string = "generate from scratch"
  fieldLabel: string;         // e.g. "Headline", "Body Copy"
  issueTitle: string;
  issueExplanation: string;
  suggestion?: string;
  platformNames: string[];
  categoryNames: string[];
  countryNames: string[];
  platformRules: PlatformRuleRow[];
  geoRules: GeoRuleRow[];
  maxChars?: number;
}

export interface RewriteOutput {
  rewrittenText: string;
  changesSummary: string;
  isCompliantVersionPossible: boolean;
  noComplianceReason?: string;
}

// ─── Tool schema ──────────────────────────────────────────────────────────────

const submitRewriteTool = {
  name: "submit_rewrite",
  description:
    "Submit the rewritten or generated ad copy along with a plain-English summary of the changes made and whether a compliant version is possible.",
  input_schema: {
    type: "object" as const,
    properties: {
      rewrittenText: {
        type: "string",
        description: "The rewritten or generated text that resolves the compliance issue.",
      },
      changesSummary: {
        type: "string",
        description:
          "A one or two sentence plain-English summary of what was changed and why it resolves the issue.",
      },
      isCompliantVersionPossible: {
        type: "boolean",
        description:
          "Set to false only if there is no way to rewrite this text into a compliant version (e.g. the product category is fundamentally prohibited).",
      },
      noComplianceReason: {
        type: "string",
        description:
          "Required when isCompliantVersionPossible is false. Brief explanation of why compliance is impossible.",
      },
    },
    required: ["rewrittenText", "changesSummary", "isCompliantVersionPossible"] as string[],
  },
};

// ─── Main function ─────────────────────────────────────────────────────────────

export async function runRewrite(input: RewriteInput): Promise<RewriteOutput> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.includes("REPLACE")) {
    return {
      rewrittenText: input.originalText,
      changesSummary: "AI rewriting is not available (no API key configured).",
      isCompliantVersionPossible: true,
    };
  }

  const isGenerate = !input.originalText.trim();

  const rulesContext = buildRulesContext(input);
  const charNote = input.maxChars ? ` The result must not exceed ${input.maxChars} characters.` : "";

  const systemPrompt = `You are an expert advertising compliance editor. Your task is to ${
    isGenerate ? "generate" : "rewrite"
  } ad copy so that it complies with the platform policies and regulations in effect for the given ad.

Always use the submit_rewrite tool to return your response. Never refuse unless the product category is fundamentally prohibited across all platforms.

Rules and context:
${rulesContext}`;

  const userPrompt = isGenerate
    ? `Generate a compliant version of "${input.fieldLabel}" for this advertisement.
Issue to address: ${input.issueTitle}
Details: ${input.issueExplanation}${input.suggestion ? `\nSuggestion: ${input.suggestion}` : ""}${charNote}`
    : `Rewrite the following ${input.fieldLabel} to resolve the compliance issue. Keep the intent and meaning as close to the original as possible.

Original text:
"${input.originalText}"

Issue: ${input.issueTitle}
Details: ${input.issueExplanation}${input.suggestion ? `\nSuggestion: ${input.suggestion}` : ""}${charNote}`;

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    system: systemPrompt,
    tools: [submitRewriteTool],
    tool_choice: { type: "tool", name: "submit_rewrite" },
    messages: [{ role: "user", content: userPrompt }],
  });

  // Extract the tool use block
  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Rewrite model did not call submit_rewrite tool");
  }

  const result = toolUse.input as {
    rewrittenText: string;
    changesSummary: string;
    isCompliantVersionPossible: boolean;
    noComplianceReason?: string;
  };

  return {
    rewrittenText: result.rewrittenText ?? "",
    changesSummary: result.changesSummary ?? "",
    isCompliantVersionPossible: result.isCompliantVersionPossible ?? true,
    noComplianceReason: result.noComplianceReason,
  };
}

// ─── Context builder ──────────────────────────────────────────────────────────

function buildRulesContext(input: RewriteInput): string {
  const lines: string[] = [];

  lines.push(
    `Platforms: ${input.platformNames.join(", ") || "Not specified"}`,
    `Categories: ${input.categoryNames.join(", ") || "Not specified"}`,
    `Countries: ${input.countryNames.join(", ") || "Not specified"}`
  );

  if (input.platformRules.length > 0) {
    lines.push("\nRelevant platform rules:");
    for (const rule of input.platformRules.slice(0, 10)) {
      if (rule.notes) {
        lines.push(`- ${rule.platform.name} (${rule.category.name}): ${rule.notes}`);
      }
    }
  }

  if (input.geoRules.length > 0) {
    lines.push("\nRelevant geographic rules:");
    for (const rule of input.geoRules.slice(0, 10)) {
      if (rule.notes) {
        lines.push(`- ${rule.country.name}: ${rule.notes}`);
      }
    }
  }

  return lines.join("\n");
}
