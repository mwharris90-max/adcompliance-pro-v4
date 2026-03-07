import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import Anthropic from "@anthropic-ai/sdk";

const chatSchema = z.object({
  action: z.enum(["chat", "find_sources", "check_updates", "generate_from_source"]),
  message: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const parsed = chatSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { message: "Validation failed" } },
      { status: 400 }
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.includes("REPLACE")) {
    return NextResponse.json(
      { success: false, error: { message: "AI not configured" } },
      { status: 503 }
    );
  }

  const rule = await db.complianceRule.findUnique({
    where: { id },
    include: {
      category: { select: { name: true, slug: true } },
      platform: { select: { name: true } },
      country: { select: { name: true, code: true } },
      legislation: { select: { title: true, sourceUrl: true, summary: true } },
      platformPolicy: { select: { title: true, sourceUrl: true, summary: true, platform: { select: { name: true } } } },
    },
  });

  if (!rule) {
    return NextResponse.json(
      { success: false, error: { message: "Rule not found" } },
      { status: 404 }
    );
  }

  const anthropic = new Anthropic({ apiKey });

  if (parsed.data.action === "chat") {
    return handleChat(anthropic, rule, parsed.data.message ?? "");
  } else if (parsed.data.action === "find_sources") {
    return handleFindSources(anthropic, rule);
  } else if (parsed.data.action === "generate_from_source") {
    return handleGenerateFromSource(anthropic, rule);
  } else {
    return handleCheckUpdates(anthropic, rule);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleChat(anthropic: Anthropic, rule: any, message: string) {
  const systemPrompt = `You are an advertising compliance specialist helping an admin configure a compliance rule.

CURRENT RULE:
- Title: ${rule.title}
- Category: ${rule.category.name}
- Platform: ${rule.platform?.name ?? "All platforms"}
- Country: ${rule.country?.name ?? "All countries"}
- Status: ${rule.status}
- Current conditions: ${rule.conditions ? JSON.stringify(rule.conditions) : "None set"}
- Current AI check instructions: ${rule.aiCheckInstructions ?? "None set"}
- Description: ${rule.description ?? "None"}

YOUR ROLE:
When the admin describes what they want this rule to do in plain language, respond with:
1. A clear explanation of what changes you recommend
2. Use the update_rule tool to suggest the structured changes

For conditions, use this structure:
- ageGate: { required: boolean, minimumAge: number }
- disclaimer: { required: boolean, text: string }
- priorApproval: boolean
- timeRestrictions: { restricted: boolean, startTime: string, endTime: string }
- contentRestrictions: string[] (list of content that must not appear)
- targetingRestrictions: string[] (audience targeting limitations)

For aiCheckInstructions, write clear instructions telling the AI compliance checker what to look for in ad content.

Keep responses concise and practical.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: "user", content: message }],
    tools: [
      {
        name: "update_rule",
        description: "Suggest updates to the compliance rule based on the admin's request.",
        input_schema: {
          type: "object" as const,
          properties: {
            status: { type: "string", enum: ["ALLOWED", "RESTRICTED", "PROHIBITED", "UNKNOWN"], description: "Updated status if it should change" },
            description: { type: "string", description: "Updated plain-English description of the rule" },
            conditions: { type: "object", description: "Updated structured conditions" },
            aiCheckInstructions: { type: "string", description: "Updated instructions for the AI compliance checker" },
          },
        },
      },
    ],
  });

  let assistantText = "";
  let suggestedUpdate: Record<string, unknown> | null = null;

  for (const block of response.content) {
    if (block.type === "text") {
      assistantText += block.text;
    } else if (block.type === "tool_use" && block.name === "update_rule") {
      suggestedUpdate = block.input as Record<string, unknown>;
    }
  }

  return NextResponse.json({
    success: true,
    response: assistantText,
    suggestedUpdate,
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleFindSources(anthropic: Anthropic, rule: any) {
  const categoryName = rule.category.name;
  const platformName = rule.platform?.name ?? "All platforms";
  const countryName = rule.country?.name ?? "All countries";

  const systemPrompt = `You are an advertising compliance research specialist. You have access to web search to find real, current legislation and platform policies.

RULE CONTEXT:
- Category: ${categoryName}
- Platform: ${platformName}
- Country: ${countryName}
- Status: ${rule.status}
- Description: ${rule.description ?? rule.title}

YOUR TASK:
1. Use web search to find the actual legislation, regulations, and platform advertising policies that govern "${categoryName}" advertising${countryName !== "All countries" ? ` in ${countryName}` : ""}${platformName !== "All platforms" ? ` on ${platformName}` : ""}.
2. Search for official government legislation pages, regulatory body guidelines, and platform policy documentation.
3. After searching, use the suggest_sources tool to provide your findings with real URLs from the search results.

SEARCH STRATEGY:
- Search for "${categoryName} advertising regulations${countryName !== "All countries" ? ` ${countryName}` : ""}"
- Search for "${categoryName} advertising law${countryName !== "All countries" ? ` ${countryName}` : ""}"
${platformName !== "All platforms" ? `- Search for "${platformName} ${categoryName} advertising policy"` : ""}
- Look for official .gov, .org, or platform policy URLs
- Focus on current, enforceable regulations

For each source found:
- Use the EXACT title from the official document
- Include the REAL URL from search results (not made up)
- Specify whether it is LEGISLATION or PLATFORM_POLICY
- Summarise how it specifically relates to ${categoryName} advertising
- Rate relevance as HIGH, MEDIUM, or LOW
- List specific sections or clauses where possible`;

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `Find the specific legislation and platform policies that govern ${categoryName} advertising${countryName !== "All countries" ? ` in ${countryName}` : ""}${platformName !== "All platforms" ? ` on ${platformName}` : ""}. Search the web for official sources.`,
      },
    ],
    tools: [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: 3,
      } as unknown as Anthropic.Messages.Tool,
      {
        name: "suggest_sources",
        description: "Provide the sources found from web search results.",
        input_schema: {
          type: "object" as const,
          properties: {
            sources: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Official title of the legislation or policy" },
                  type: { type: "string", enum: ["LEGISLATION", "PLATFORM_POLICY"] },
                  jurisdiction: { type: "string", description: "Country/region or platform name" },
                  sourceUrl: { type: "string", description: "URL to the official source — must be a real URL from search results" },
                  summary: { type: "string", description: "How this source relates to the rule" },
                  relevance: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
                  keyProvisions: { type: "array", items: { type: "string" }, description: "Specific sections or clauses" },
                },
                required: ["title", "type", "jurisdiction", "summary", "relevance"],
              },
            },
          },
          required: ["sources"],
        },
      },
    ],
  });

  let assistantText = "";
  let sources: unknown[] = [];

  for (const block of response.content) {
    if (block.type === "text") {
      assistantText += block.text;
    } else if (block.type === "tool_use" && block.name === "suggest_sources") {
      const input = block.input as { sources: unknown[] };
      sources = input.sources;
    }
  }

  if (!assistantText && sources.length > 0) {
    assistantText = `Found ${sources.length} relevant source${sources.length === 1 ? "" : "s"} for this rule by searching trusted regulatory and platform policy resources.`;
  }

  return NextResponse.json({
    success: true,
    response: assistantText,
    sources,
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleCheckUpdates(anthropic: Anthropic, rule: any) {
  const lastVerified = rule.lastVerifiedAt
    ? new Date(rule.lastVerifiedAt).toLocaleDateString()
    : "Never";

  const systemPrompt = `You are an advertising compliance specialist checking whether a compliance rule needs updating.

CURRENT RULE:
- Title: ${rule.title}
- Category: ${rule.category.name}
- Platform: ${rule.platform?.name ?? "All platforms"}
- Country: ${rule.country?.name ?? "All countries"}
- Status: ${rule.status}
- Conditions: ${rule.conditions ? JSON.stringify(rule.conditions) : "None"}
- AI check instructions: ${rule.aiCheckInstructions ?? "None"}
- Description: ${rule.description ?? "None"}
- Last verified: ${lastVerified}
${rule.legislation ? `- Linked legislation: ${rule.legislation.title}` : ""}
${rule.platformPolicy ? `- Linked policy: ${rule.platformPolicy.title} (${rule.platformPolicy.platform?.name})` : ""}

YOUR TASK:
Based on your knowledge of current advertising regulations and platform policies (up to your training cutoff), assess:
1. Is this rule still accurate and up to date?
2. Have there been any relevant regulatory changes?
3. Are the conditions comprehensive enough?
4. Are the AI check instructions adequate?

Use the assessment tool to provide a structured response. Be specific about what needs changing and why.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: "user", content: "Check if this rule needs updating based on current regulations and platform policies." }],
    tools: [
      {
        name: "assessment",
        description: "Provide a structured assessment of whether this rule needs updating.",
        input_schema: {
          type: "object" as const,
          properties: {
            needsUpdate: { type: "boolean", description: "Whether the rule needs updating" },
            urgency: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"], description: "How urgently it needs attention" },
            findings: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  area: { type: "string", description: "What aspect needs attention (status, conditions, instructions, etc.)" },
                  issue: { type: "string", description: "What the issue is" },
                  recommendation: { type: "string", description: "What should be changed" },
                },
                required: ["area", "issue", "recommendation"],
              },
            },
            suggestedUpdate: {
              type: "object",
              description: "Suggested updates if needed",
              properties: {
                status: { type: "string", enum: ["ALLOWED", "RESTRICTED", "PROHIBITED", "UNKNOWN"] },
                description: { type: "string" },
                conditions: { type: "object" },
                aiCheckInstructions: { type: "string" },
              },
            },
          },
          required: ["needsUpdate", "urgency", "findings"],
        },
      },
    ],
  });

  let assistantText = "";
  let assessment: Record<string, unknown> | null = null;

  for (const block of response.content) {
    if (block.type === "text") {
      assistantText += block.text;
    } else if (block.type === "tool_use" && block.name === "assessment") {
      assessment = block.input as Record<string, unknown>;
    }
  }

  return NextResponse.json({
    success: true,
    response: assistantText,
    assessment,
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleGenerateFromSource(anthropic: Anthropic, rule: any) {
  const sourceTitle = rule.legislation?.title ?? rule.platformPolicy?.title ?? "Unknown";
  const sourceSummary = rule.legislation?.summary ?? rule.platformPolicy?.summary ?? "";
  const sourceUrl = rule.legislation?.sourceUrl ?? rule.platformPolicy?.sourceUrl ?? "";
  const platformName = rule.platformPolicy?.platform?.name ?? rule.platform?.name ?? "All platforms";

  if (!rule.legislation && !rule.platformPolicy) {
    return NextResponse.json({
      success: false,
      error: { message: "No source document linked. Link a legislation or platform policy first." },
    }, { status: 400 });
  }

  const systemPrompt = `You are an advertising compliance specialist. A compliance rule has been linked to a source document. Your job is to review the source and generate appropriate conditions, description, and AI check instructions.

RULE:
- Title: ${rule.title}
- Category: ${rule.category.name}
- Platform: ${platformName}
- Country: ${rule.country?.name ?? "All countries"}
- Current status: ${rule.status}
- Current description: ${rule.description ?? "None"}
- Current conditions: ${rule.conditions ? JSON.stringify(rule.conditions) : "None"}
- Current AI check instructions: ${rule.aiCheckInstructions ?? "None"}

SOURCE DOCUMENT:
- Title: ${sourceTitle}
- URL: ${sourceUrl}
- Summary: ${sourceSummary}

YOUR TASK:
1. Use web search to find the full text of the source document: "${sourceTitle}"${sourceUrl ? ` at ${sourceUrl}` : ""}
2. Based on the source document, determine what conditions and requirements apply to "${rule.category.name}" advertising
3. Use the generate_rule_content tool to suggest:
   - The appropriate status (ALLOWED, RESTRICTED, PROHIBITED)
   - A clear plain-English description of what the rule means for advertisers
   - Structured conditions (ageGate, disclaimer, timeRestrictions, contentRestrictions, targetingRestrictions, priorApproval)
   - AI check instructions telling the compliance checker exactly what to look for

Only include conditions that are actually required by the source document. Do not invent requirements.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `Read the source document "${sourceTitle}" and generate the compliance rule conditions, description, and AI check instructions for ${rule.category.name} advertising.`,
      },
    ],
    tools: [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: 3,
      } as unknown as Anthropic.Messages.Tool,
      {
        name: "generate_rule_content",
        description: "Generate rule content based on the source document.",
        input_schema: {
          type: "object" as const,
          properties: {
            status: {
              type: "string",
              enum: ["ALLOWED", "RESTRICTED", "PROHIBITED", "UNKNOWN"],
              description: "The appropriate status based on the source",
            },
            description: {
              type: "string",
              description: "Plain-English description of what this rule means for advertisers",
            },
            conditions: {
              type: "object",
              description: "Structured conditions from the source document",
              properties: {
                ageGate: {
                  type: "object",
                  properties: {
                    required: { type: "boolean" },
                    minimumAge: { type: "number" },
                  },
                },
                disclaimer: {
                  type: "object",
                  properties: {
                    required: { type: "boolean" },
                    text: { type: "string" },
                  },
                },
                priorApproval: { type: "boolean" },
                timeRestrictions: {
                  type: "object",
                  properties: {
                    restricted: { type: "boolean" },
                    startTime: { type: "string" },
                    endTime: { type: "string" },
                  },
                },
                contentRestrictions: {
                  type: "array",
                  items: { type: "string" },
                },
                targetingRestrictions: {
                  type: "array",
                  items: { type: "string" },
                },
              },
            },
            aiCheckInstructions: {
              type: "string",
              description: "Instructions for the AI compliance checker",
            },
          },
          required: ["status", "description", "conditions", "aiCheckInstructions"],
        },
      },
    ],
  });

  let assistantText = "";
  let suggestedContent: Record<string, unknown> | null = null;

  for (const block of response.content) {
    if (block.type === "text") {
      assistantText += block.text;
    } else if (block.type === "tool_use" && block.name === "generate_rule_content") {
      suggestedContent = block.input as Record<string, unknown>;
    }
  }

  return NextResponse.json({
    success: true,
    response: assistantText,
    suggestedContent,
  });
}
