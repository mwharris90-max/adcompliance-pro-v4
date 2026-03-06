import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

const detectSchema = z.object({
  headline: z.string().optional().default(""),
  body: z.string().optional().default(""),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { success: false, error: { message: "Unauthorized" } },
      { status: 401 }
    );
  }

  const body = await req.json();
  const parsed = detectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { message: "Validation failed" } },
      { status: 400 }
    );
  }

  const text = [parsed.data.headline, parsed.data.body].filter(Boolean).join("\n\n").trim();

  if (!text || text.length < 10) {
    return NextResponse.json({ success: true, data: { suggestions: [] } });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ success: true, data: { suggestions: [] } });
  }

  try {
    const categories = await db.category.findMany({
      where: { active: true },
      select: { id: true, name: true, slug: true },
      orderBy: { name: "asc" },
    });

    if (!categories.length) {
      return NextResponse.json({ success: true, data: { suggestions: [] } });
    }

    const client = new Anthropic();

    const result = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      tools: [
        {
          name: "suggest_categories",
          description: "Suggest the most relevant advertising compliance categories for the given ad copy",
          input_schema: {
            type: "object" as const,
            properties: {
              suggestions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    categoryId: { type: "string", description: "The category ID" },
                    confidence: { type: "number", description: "Confidence score 0-1" },
                  },
                  required: ["categoryId", "confidence"],
                },
                description: "Up to 3 category suggestions ordered by confidence, highest first",
              },
            },
            required: ["suggestions"],
          },
        },
      ],
      tool_choice: { type: "auto" },
      messages: [
        {
          role: "user",
          content: `Given this ad copy, suggest the most relevant compliance categories. Only suggest categories that clearly apply.

IMPORTANT RULES:
- Always prefer the most SPECIFIC category available. For example, if an ad is about a pharma company's annual report, use "Pharma — Investor Relations" NOT "Prescription Medications".
- Only suggest restricted/prohibited categories (e.g. "Prescription Medications") if the ad is DIRECTLY promoting or advertising that specific product type to consumers.
- Corporate communications, white papers, recruitment ads, or investor materials from a company in a regulated industry should use the appropriate corporate/general category, NOT the regulated product category.
- If multiple categories could apply, suggest both but rank the more specific one higher.

Available categories:
${categories.map((c) => `- ID: ${c.id} | Name: ${c.name}`).join("\n")}

Ad copy:
${text}`,
        },
      ],
    });

    const toolUse = result.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      return NextResponse.json({ success: true, data: { suggestions: [] } });
    }

    const input = toolUse.input as { suggestions: { categoryId: string; confidence: number }[] };
    const validSuggestions = (input.suggestions ?? [])
      .filter((s) => categories.some((c) => c.id === s.categoryId) && s.confidence > 0.3)
      .slice(0, 3)
      .map((s) => ({
        ...s,
        categoryName: categories.find((c) => c.id === s.categoryId)?.name ?? "",
      }));

    return NextResponse.json({ success: true, data: { suggestions: validSuggestions } });
  } catch {
    return NextResponse.json({ success: true, data: { suggestions: [] } });
  }
}
