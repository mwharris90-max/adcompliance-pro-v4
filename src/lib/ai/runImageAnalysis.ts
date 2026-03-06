import { anthropic } from "./client";
import type {
  ComplianceChecklistItem,
  PlatformRuleRow,
  GeoRuleRow,
} from "./runComplianceCheck";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ZonePosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "middle-left"
  | "center"
  | "middle-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export interface ImageZone {
  position: ZonePosition;
  issueTitle: string;
  issueDescription: string;
  severity: "WARNING" | "FAIL";
  ruleReference?: string;
}

export interface ImageAnalysisOutput {
  imageUrl: string;
  imageDescription: string;
  confidence: number;
  detectedText: string;
  zones: ImageZone[];
  checklistItems: ComplianceChecklistItem[];
}

// ─── Main function ────────────────────────────────────────────────────────────

export async function runAiImageAnalysis(
  imageUrl: string,
  imageIndex: number,
  platformNames: string[],
  categoryNames: string[],
  countryNames: string[],
  platformRules: PlatformRuleRow[],
  geoRules: GeoRuleRow[]
): Promise<ImageAnalysisOutput> {
  const rulesContext = buildRulesContext(platformRules, geoRules);

  const prompt = `You are a senior digital advertising compliance analyst specialising in visual content. Analyse this advertisement image for compliance with the platform policies and geographic regulations listed below.

PLATFORMS: ${platformNames.join(", ")}
PRODUCT CATEGORIES: ${categoryNames.join(", ")}
TARGET COUNTRIES: ${countryNames.join(", ")}

APPLICABLE RULES:
${rulesContext}

Your analysis must cover four parts:

PART 1 — IMAGE DESCRIPTION
Describe the visual content of the image in detail: people, objects, text overlays, colours, tone, and overall messaging.

PART 2 — COMPLIANCE EVALUATION
Evaluate the image against each applicable platform/geo rule. For each issue found, identify:
- Whether it is a FAIL (clear violation) or WARNING (potential issue requiring review)
- The specific visual element that triggers the issue
- Which platform/geo rule is violated

PART 3 — ZONE IDENTIFICATION
If there are compliance issues, identify which grid zone of the image they appear in. Use a 3×3 grid: top-left, top-center, top-right, middle-left, center, middle-right, bottom-left, bottom-center, bottom-right. Report only zones that have an actual issue.

PART 4 — TEXT EXTRACTION
Extract any text that appears overlaid on or embedded in the image (logos, taglines, disclaimers, URLs, body copy, etc.). Return the raw text as a single string. If no text is visible, return an empty string.

Also rate your overall confidence in the analysis from 0 to 1, where 1 = you can clearly see and assess all content, and 0 = image is too small, blurry, or abstract to assess reliably.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 3000,
    tools: [
      {
        name: "submit_image_analysis",
        description: "Submit the structured image compliance analysis",
        input_schema: {
          type: "object" as const,
          properties: {
            imageDescription: {
              type: "string",
              description: "Detailed description of the visual content",
            },
            confidence: {
              type: "number",
              description: "Overall analysis confidence 0–1",
            },
            detectedText: {
              type: "string",
              description: "All text visible in the image, concatenated. Empty string if none.",
            },
            zones: {
              type: "array",
              description: "Grid zones with compliance issues. Empty array if no issues.",
              items: {
                type: "object",
                properties: {
                  position: {
                    type: "string",
                    enum: [
                      "top-left", "top-center", "top-right",
                      "middle-left", "center", "middle-right",
                      "bottom-left", "bottom-center", "bottom-right",
                    ],
                  },
                  issueTitle: {
                    type: "string",
                    description: "Short title for the issue (max 60 chars)",
                  },
                  issueDescription: {
                    type: "string",
                    description: "Explanation of the compliance issue in this zone",
                  },
                  severity: {
                    type: "string",
                    enum: ["WARNING", "FAIL"],
                  },
                  ruleReference: {
                    type: "string",
                    description: "Optional: the specific rule or policy this violates",
                  },
                },
                required: ["position", "issueTitle", "issueDescription", "severity"],
              },
            },
            checklistItems: {
              type: "array",
              description: "Compliance checklist items derived from the image analysis",
              items: {
                type: "object",
                properties: {
                  ruleTitle: {
                    type: "string",
                    description: "Short, specific rule title (max 80 chars)",
                  },
                  status: {
                    type: "string",
                    enum: ["PASS", "WARNING", "FAIL"],
                  },
                  reason: {
                    type: "string",
                    description: "1–2 sentence verdict",
                  },
                  explanation: {
                    type: "string",
                    description: "Detailed explanation",
                  },
                  suggestion: {
                    type: "string",
                    description: "Specific, actionable fix. Required for WARNING and FAIL.",
                  },
                  applicablePlatforms: {
                    type: "array",
                    items: { type: "string" },
                  },
                  applicableCountries: {
                    type: "array",
                    items: { type: "string" },
                  },
                },
                required: [
                  "ruleTitle",
                  "status",
                  "reason",
                  "explanation",
                  "applicablePlatforms",
                  "applicableCountries",
                ],
              },
            },
          },
          required: [
            "imageDescription",
            "confidence",
            "detectedText",
            "zones",
            "checklistItems",
          ],
        },
      },
    ],
    tool_choice: { type: "tool", name: "submit_image_analysis" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "url", url: imageUrl },
          },
          {
            type: "text",
            text: prompt,
          },
        ],
      },
    ],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    return emptyOutput(imageUrl);
  }

  const raw = toolUse.input as {
    imageDescription?: string;
    confidence?: number;
    detectedText?: string;
    zones?: ImageZone[];
    checklistItems?: Array<{
      ruleTitle: string;
      status: "PASS" | "WARNING" | "FAIL";
      reason: string;
      explanation: string;
      suggestion?: string;
      applicablePlatforms: string[];
      applicableCountries: string[];
    }>;
  };

  const confidence = raw.confidence ?? 1;
  const zones: ImageZone[] = raw.zones ?? [];

  // Build checklist items
  const checklistItems: ComplianceChecklistItem[] = (raw.checklistItems ?? []).map(
    (item, i) => ({
      id: `image:${imageIndex}:${i}:${item.ruleTitle.replace(/\s+/g, "_").toLowerCase().slice(0, 30)}`,
      layer: "image" as const,
      ruleTitle: item.ruleTitle,
      status: item.status,
      reason: item.reason,
      explanation: item.explanation,
      suggestion: item.suggestion,
      applicablePlatforms:
        item.applicablePlatforms.length > 0 ? item.applicablePlatforms : platformNames,
      applicableCountries: item.applicableCountries,
      isOverrideable: item.status !== "PASS",
      aiGenerated: true,
    })
  );

  // B2: Low-confidence warning
  if (confidence < 0.7) {
    checklistItems.push({
      id: `image:${imageIndex}:low_confidence`,
      layer: "image",
      ruleTitle: "Image analysis performed with limited confidence",
      status: "WARNING",
      reason: `The AI could only partially assess this image (confidence: ${Math.round(confidence * 100)}%). Manual review is recommended.`,
      explanation:
        "The image may be too small, low-resolution, or abstract for a full automated compliance assessment. A human reviewer should inspect the creative directly.",
      suggestion: "Review this image manually against the applicable platform and geo rules.",
      applicablePlatforms: platformNames,
      applicableCountries: [],
      isOverrideable: true,
      aiGenerated: true,
    });
  }

  // Detected-text checklist item (informational PASS)
  const detectedText = raw.detectedText ?? "";
  if (detectedText.trim()) {
    checklistItems.push({
      id: `image:${imageIndex}:detected_text`,
      layer: "image",
      ruleTitle: "Text detected in image",
      status: "PASS",
      reason: "Text overlays were detected in the image and surfaced for review.",
      explanation: `The following text was identified within the image: "${detectedText.slice(0, 200)}${detectedText.length > 200 ? "…" : ""}"`,
      applicablePlatforms: platformNames,
      applicableCountries: [],
      isOverrideable: false,
      aiGenerated: true,
    });
  }

  return {
    imageUrl,
    imageDescription: raw.imageDescription ?? "",
    confidence,
    detectedText,
    zones,
    checklistItems,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildRulesContext(
  platformRules: PlatformRuleRow[],
  geoRules: GeoRuleRow[]
): string {
  const lines: string[] = [];

  for (const rule of platformRules) {
    if (rule.status === "PROHIBITED") {
      lines.push(
        `[PLATFORM - PROHIBITED] ${rule.category.name} on ${rule.platform.name}: ${rule.notes ?? "Strictly prohibited."}`
      );
    } else if (rule.status === "RESTRICTED") {
      lines.push(
        `[PLATFORM - RESTRICTED] ${rule.category.name} on ${rule.platform.name}: ${rule.notes ?? "Permitted with conditions."}`
      );
    }
  }

  for (const rule of geoRules) {
    const platformSuffix = rule.platform ? ` on ${rule.platform.name}` : "";
    if (rule.status === "PROHIBITED") {
      lines.push(
        `[GEO - PROHIBITED] ${rule.category.name} in ${rule.country.name}${platformSuffix}: ${rule.notes ?? "Strictly prohibited."}`
      );
    } else if (rule.status === "RESTRICTED") {
      lines.push(
        `[GEO - RESTRICTED] ${rule.category.name} in ${rule.country.name}${platformSuffix}: ${rule.notes ?? "Permitted with conditions."}`
      );
    }
  }

  return lines.length > 0
    ? lines.join("\n")
    : "(No specific prohibited/restricted rules for this combination — evaluate for general advertising standards violations only.)";
}

function emptyOutput(imageUrl: string): ImageAnalysisOutput {
  return {
    imageUrl,
    imageDescription: "",
    confidence: 0,
    detectedText: "",
    zones: [],
    checklistItems: [],
  };
}
