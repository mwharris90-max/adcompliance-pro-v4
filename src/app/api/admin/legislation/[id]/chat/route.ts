import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import Anthropic from "@anthropic-ai/sdk";

const chatSchema = z.object({
  message: z.string().min(1).max(5000),
});

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  suggestedRules?: SuggestedRule[];
  timestamp: string;
}

interface SuggestedRule {
  title: string;
  description: string;
  categorySlug: string;
  categoryName: string;
  platformName?: string;
  countryName?: string;
  status: "ALLOWED" | "RESTRICTED" | "PROHIBITED";
  conditions?: Record<string, unknown>;
  aiCheckInstructions?: string;
}

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

  const legislation = await db.legislation.findUnique({
    where: { id },
    include: {
      jurisdiction: { select: { name: true, code: true } },
      complianceRules: {
        where: { active: true },
        select: { title: true, status: true, category: { select: { name: true } } },
      },
    },
  });

  if (!legislation) {
    return NextResponse.json(
      { success: false, error: { message: "Not found" } },
      { status: 404 }
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.includes("REPLACE")) {
    return NextResponse.json(
      { success: false, error: { message: "AI not configured" } },
      { status: 503 }
    );
  }

  // Fetch available categories for rule suggestions
  const categories = await db.category.findMany({
    where: { active: true, parentId: { not: null } },
    select: { name: true, slug: true },
    orderBy: { name: "asc" },
  });

  const countries = await db.country.findMany({
    where: { approved: true },
    select: { name: true, code: true },
    orderBy: { name: "asc" },
  });

  const platforms = await db.platform.findMany({
    where: { active: true },
    select: { name: true, slug: true },
    orderBy: { name: "asc" },
  });

  // Build conversation history
  const history: ChatMessage[] = (legislation.chatHistory as unknown as ChatMessage[]) ?? [];
  const userMessage: ChatMessage = {
    role: "user",
    content: parsed.data.message,
    timestamp: new Date().toISOString(),
  };
  history.push(userMessage);

  // Existing rules for context
  const existingRulesText = legislation.complianceRules.length > 0
    ? `\nExisting rules derived from this legislation:\n${legislation.complianceRules.map((r) => `- ${r.title} (${r.status}) — ${r.category.name}`).join("\n")}`
    : "\nNo rules have been derived from this legislation yet.";

  const systemPrompt = `You are an advertising compliance specialist helping an admin manage legislation that affects advertising rules.

LEGISLATION CONTEXT:
Title: ${legislation.title}
Type: ${legislation.type}
Jurisdiction: ${legislation.jurisdiction?.name ?? "Not specified"} (${legislation.jurisdiction?.code ?? "N/A"})
${legislation.summary ? `Summary: ${legislation.summary}` : ""}
${legislation.fullText ? `Full text:\n${legislation.fullText.slice(0, 8000)}` : "No full text provided."}
${existingRulesText}

AVAILABLE CATEGORIES (use these exact slugs when suggesting rules):
${categories.map((c) => `${c.slug}: ${c.name}`).join("\n")}

AVAILABLE COUNTRIES:
${countries.map((c) => `${c.code}: ${c.name}`).join(", ")}

AVAILABLE PLATFORMS:
${platforms.map((p) => `${p.slug}: ${p.name}`).join(", ")}

YOUR ROLE:
1. Help the admin understand what advertising rules this legislation creates
2. When asked to analyze or derive rules, suggest specific compliance rules using the tool
3. Each rule should target a specific category and optionally a platform/country
4. Be precise about what the rule requires advertisers to do
5. For RESTRICTED rules, describe what conditions apply (age gates, disclaimers, time restrictions)
6. For aiCheckInstructions, describe what the AI compliance checker should look for in ad content
7. Reference specific sections/clauses of the legislation where possible

Keep responses focused and practical. When suggesting rules, use the suggest_rules tool.`;

  const anthropic = new Anthropic({ apiKey });

  const messages = history.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: systemPrompt,
    messages,
    tools: [
      {
        name: "suggest_rules",
        description: "Suggest compliance rules derived from this legislation. Call this when analyzing the legislation or when the admin asks what rules should be created.",
        input_schema: {
          type: "object" as const,
          properties: {
            rules: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Short rule title, e.g. 'Age gate required for alcohol ads'" },
                  description: { type: "string", description: "What the rule requires in plain English" },
                  categorySlug: { type: "string", description: "Category slug from the available list" },
                  categoryName: { type: "string", description: "Category display name" },
                  platformName: { type: "string", description: "Platform name if platform-specific, omit for all platforms" },
                  countryName: { type: "string", description: "Country name if country-specific" },
                  status: { type: "string", enum: ["ALLOWED", "RESTRICTED", "PROHIBITED"] },
                  conditions: {
                    type: "object",
                    description: "Structured conditions for RESTRICTED rules",
                    properties: {
                      ageGate: { type: "object", properties: { required: { type: "boolean" }, minimumAge: { type: "number" } } },
                      disclaimer: { type: "object", properties: { required: { type: "boolean" }, text: { type: "string" } } },
                      priorApproval: { type: "boolean" },
                      timeRestrictions: { type: "object", properties: { restricted: { type: "boolean" }, startTime: { type: "string" }, endTime: { type: "string" } } },
                    },
                  },
                  aiCheckInstructions: { type: "string", description: "Instructions for the AI compliance checker on what to look for in ad content" },
                },
                required: ["title", "description", "categorySlug", "categoryName", "status"],
              },
            },
          },
          required: ["rules"],
        },
      },
    ],
  });

  // Extract text and tool use from response
  let assistantText = "";
  let suggestedRules: SuggestedRule[] = [];

  for (const block of response.content) {
    if (block.type === "text") {
      assistantText += block.text;
    } else if (block.type === "tool_use" && block.name === "suggest_rules") {
      const input = block.input as { rules: SuggestedRule[] };
      suggestedRules = input.rules;
    }
  }

  // If tool was used but no text, add a summary
  if (!assistantText && suggestedRules.length > 0) {
    assistantText = `I've identified ${suggestedRules.length} rule${suggestedRules.length === 1 ? "" : "s"} from this legislation. Review them below and confirm the ones you'd like to add.`;
  }

  const assistantMessage: ChatMessage = {
    role: "assistant",
    content: assistantText,
    suggestedRules: suggestedRules.length > 0 ? suggestedRules : undefined,
    timestamp: new Date().toISOString(),
  };
  history.push(assistantMessage);

  // Save chat history
  await db.legislation.update({
    where: { id },
    data: { chatHistory: JSON.parse(JSON.stringify(history)) },
  });

  return NextResponse.json({
    success: true,
    history,
    suggestedRules,
  });
}
