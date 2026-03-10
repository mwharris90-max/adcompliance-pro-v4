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

    // Fetch all active categories with parent info
    const categories = await db.category.findMany({
      where: { active: true },
      select: { id: true, name: true, parentId: true },
      orderBy: { name: "asc" },
    });

    if (!categories.length) {
      return NextResponse.json({ suggestions: [] });
    }

    // Build a map of parent IDs so we can identify leaf vs parent categories
    const parentIds = new Set(
      categories.filter((c) => c.parentId).map((c) => c.parentId!)
    );

    // Format categories with hierarchy info for the prompt
    const categoryList = categories.map((c) => {
      const isParent = parentIds.has(c.id);
      const parent = c.parentId
        ? categories.find((p) => p.id === c.parentId)
        : null;
      const label = parent ? `${parent.name} > ${c.name}` : c.name;
      const tag = isParent ? " [PARENT - avoid]" : "";
      return `- ID: ${c.id} | ${label}${tag}`;
    }).join("\n");

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

CRITICAL RULES:
- ALWAYS prefer specific sub-categories over broad parent categories. For example:
  - Use "Pet Insurance" NOT "Insurance Products"
  - Use "Skincare (Non-Medical)" NOT "Beauty & Personal Care — General"
  - Use "Online Gambling / Casino" NOT "Financial Services — General"
  - Use "Beer" or "Wine" NOT "Alcohol — General"
- Categories marked [PARENT - avoid] should ONLY be used if no specific sub-category fits. They are too broad for compliance analysis.
- Only suggest restricted/prohibited categories if the page is directly offering or promoting that product/service.
- If the page spans multiple specific categories, suggest all relevant ones.
- Suggest up to 5 categories maximum, ordered by relevance.

Available categories:
${categoryList}

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
