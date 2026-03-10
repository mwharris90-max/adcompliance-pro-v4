import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";
import { extractPage } from "@/lib/scanner/extract";

/**
 * POST /api/detect-category/url
 * Takes a URL, extracts the page content, and suggests relevant
 * compliance categories using AI.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    const body = await req.json();
    const { url } = body as { url: string };

    if (!url?.trim()) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Extract page content
    const extraction = await extractPage(url);
    const text = [
      extraction.title,
      extraction.metaDescription,
      extraction.headings.slice(0, 10).join(". "),
      extraction.bodyText.slice(0, 2000),
    ]
      .filter(Boolean)
      .join("\n\n")
      .trim();

    if (text.length < 10) {
      return NextResponse.json({ suggestions: [] });
    }

    // Fetch all active categories
    const categories = await db.category.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    if (!categories.length) {
      return NextResponse.json({ suggestions: [] });
    }

    const client = new Anthropic({ apiKey });

    const result = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      tools: [
        {
          name: "suggest_categories",
          description:
            "Suggest the most relevant advertising compliance categories for the website content",
          input_schema: {
            type: "object" as const,
            properties: {
              suggestions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    categoryId: { type: "string", description: "The category ID" },
                    confidence: {
                      type: "number",
                      description: "Confidence score 0-1",
                    },
                  },
                  required: ["categoryId", "confidence"],
                },
                description:
                  "Up to 5 category suggestions ordered by confidence, highest first",
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
          content: `Given this website content, suggest the most relevant advertising compliance categories. This is a landing page or website that may be used for advertising — identify which regulated or standard industry categories apply.

IMPORTANT RULES:
- Suggest the most SPECIFIC category available. E.g. "Pet Insurance" not just "Insurance Products".
- Only suggest restricted/prohibited categories if the page is directly offering or promoting that product/service.
- If the page spans multiple categories (e.g. a financial services company offering loans and insurance), suggest all relevant ones.
- Suggest up to 5 categories maximum, ordered by relevance.

Available categories:
${categories.map((c) => `- ID: ${c.id} | Name: ${c.name}`).join("\n")}

Website content:
${text}`,
        },
      ],
    });

    const toolUse = result.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      return NextResponse.json({ suggestions: [] });
    }

    const input = toolUse.input as {
      suggestions: { categoryId: string; confidence: number }[];
    };

    const validSuggestions = (input.suggestions ?? [])
      .filter(
        (s) => categories.some((c) => c.id === s.categoryId) && s.confidence > 0.3
      )
      .slice(0, 5)
      .map((s) => ({
        ...s,
        categoryName:
          categories.find((c) => c.id === s.categoryId)?.name ?? "",
      }));

    return NextResponse.json({ suggestions: validSuggestions });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}
