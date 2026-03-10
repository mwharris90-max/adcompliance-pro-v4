import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";
import { deductCredits } from "@/lib/usage";
import { internalError } from "@/lib/api-error";

/**
 * POST /api/compliance/brief/guidance
 * Takes the raw brief data and uses AI to generate plain-language
 * Must / Should / Should Not guidance.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.includes("REPLACE")) {
    return NextResponse.json(
      { error: "AI not configured" },
      { status: 503 }
    );
  }

  try {
    const body = await req.json();
    const { platformIds, categoryIds, countryIds } = body as {
      platformIds: string[];
      categoryIds: string[];
      countryIds: string[];
    };

    if (!platformIds?.length || !countryIds?.length) {
      return NextResponse.json(
        { error: "At least one platform and one country required" },
        { status: 400 }
      );
    }

    // Deduct checkdits: 1 base + 0.5 per additional category (min 1)
    const categoryCount = categoryIds?.length ?? 0;
    const cost = categoryCount <= 1 ? 1 : 1 + Math.ceil((categoryCount - 1) * 0.5);
    const charged = await deductCredits(session.user.id!, cost);
    if (!charged) {
      return NextResponse.json(
        { error: "Insufficient checkdits. Purchase more to continue." },
        { status: 402 }
      );
    }

    // Fetch rules data
    const [platforms, categories, countries, platformRules, geoRules, prohibitions] =
      await Promise.all([
        db.platform.findMany({
          where: { id: { in: platformIds } },
          select: { name: true },
        }),
        categoryIds.length
          ? db.category.findMany({
              where: { id: { in: categoryIds } },
              select: { name: true, description: true },
            })
          : Promise.resolve([]),
        db.country.findMany({
          where: { id: { in: countryIds } },
          select: { name: true, code: true },
        }),
        categoryIds.length
          ? db.platformRule.findMany({
              where: {
                platformId: { in: platformIds },
                categoryId: { in: categoryIds },
              },
              include: {
                platform: { select: { name: true } },
                category: { select: { name: true } },
              },
            })
          : Promise.resolve([]),
        categoryIds.length
          ? db.geoRule.findMany({
              where: {
                countryId: { in: countryIds },
                categoryId: { in: categoryIds },
                OR: [
                  { platformId: null },
                  { platformId: { in: platformIds } },
                ],
              },
              include: {
                country: { select: { name: true } },
                category: { select: { name: true } },
                platform: { select: { name: true } },
              },
            })
          : Promise.resolve([]),
        categoryIds.length
          ? db.prohibitionConfig.findMany({
              where: {
                categoryId: { in: categoryIds },
                active: true,
                OR: [
                  { countryId: null, platformId: null },
                  { countryId: { in: countryIds } },
                  { platformId: { in: platformIds } },
                ],
              },
              include: {
                category: { select: { name: true } },
                country: { select: { name: true } },
                platform: { select: { name: true } },
              },
            })
          : Promise.resolve([]),
      ]);

    // Build context for AI
    const rulesContext = [];

    for (const rule of platformRules) {
      rulesContext.push({
        type: "platform_rule",
        platform: rule.platform.name,
        category: rule.category.name,
        status: rule.status,
        conditions: rule.conditions,
        notes: rule.notes,
        referenceUrl: rule.referenceUrl,
      });
    }

    for (const rule of geoRules) {
      rulesContext.push({
        type: "geo_rule",
        country: rule.country.name,
        category: rule.category.name,
        platform: rule.platform?.name ?? "All platforms",
        status: rule.status,
        restrictions: rule.restrictions,
        notes: rule.notes,
        legislationUrl: rule.legislationUrl,
      });
    }

    for (const p of prohibitions) {
      const proh = p as unknown as {
        category: { name: string };
        country?: { name: string };
        platform?: { name: string };
        warningTitle: string;
        warningMessage: string;
      };
      rulesContext.push({
        type: "prohibition",
        category: proh.category.name,
        country: proh.country?.name ?? "All countries",
        platform: proh.platform?.name ?? "All platforms",
        title: proh.warningTitle,
        message: proh.warningMessage,
      });
    }

    const platformNames = platforms.map((p) => p.name).join(", ");
    const countryNames = countries.map((c) => c.name).join(", ");
    const categoryNames = categories.length
      ? categories.map((c) => c.name).join(", ")
      : "All categories";

    const anthropic = new Anthropic({ apiKey });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system: `You are an advertising compliance advisor creating a plain-language compliance brief for a marketing team onboarding a new client.

Your job is to translate technical compliance rules, conditions, and regulations into clear, actionable guidance that a non-technical marketing professional can understand and follow.

SCOPE:
- Platforms: ${platformNames}
- Countries: ${countryNames}
- Categories: ${categoryNames}

RULES DATA:
${JSON.stringify(rulesContext, null, 2)}

INSTRUCTIONS:
Use the generate_guidance tool to produce structured guidance. Be concise — aim for content that fits 1-2 printed pages. If there is a lot of important information, it is acceptable to go longer, but prioritise the most critical items and avoid repetition.

IMPORTANT: When multiple categories are selected, you MUST separate guidance into:
- "universal" — requirements that apply across ALL selected categories (e.g. general GDPR rules, platform-wide policies, country-level advertising standards that are not category-specific)
- "categorySpecific" — requirements that only apply to a specific category. Create one entry per category that has category-specific rules.

If only one category is selected, put everything in "universal" and leave "categorySpecific" empty.

For each section, generate these tiers:
1. PROHIBITED — Things that are completely banned. The ad cannot run at all.
2. MUST — Mandatory legal or regulatory requirements. Failing these means non-compliance.
3. SHOULD — Best practices and strong recommendations.
4. SHOULD NOT — Things to avoid.
5. LEGISLATION SUMMARY — Name each relevant law/regulation/code with a 1-2 sentence plain-English summary and jurisdiction.
6. PRACTICAL REQUIREMENTS — Concrete operational requirements: badges, local offices, certifications, licences, age-gating, mandatory disclaimer text, record-keeping periods, etc. Only include genuinely required items.

For each guidance item:
- Write in plain, non-technical English
- Be specific about what the requirement means in practice
- Reference the platform, country, or regulation in the "source" field
- Turn structured conditions into human-readable sentences

Examples of good guidance text:
- "Include a clear 'Drink Responsibly' disclaimer in all ad copy"
- "Do not target users under 18 years of age"
- "Ads must not run between 6am and 9pm"

If there are no rules for a category, still include general best-practice guidance for the platforms and countries selected.`,
      messages: [
        {
          role: "user",
          content: "Generate the compliance brief guidance for this selection.",
        },
      ],
      tools: [
        {
          name: "generate_guidance",
          description:
            "Generate structured compliance guidance grouped into universal (all categories) and category-specific sections.",
          input_schema: {
            type: "object" as const,
            properties: {
              universal: {
                type: "object",
                description: "Guidance that applies across ALL selected categories",
                properties: {
                  prohibited: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        text: { type: "string", description: "Plain-language description of what is prohibited" },
                        source: { type: "string", description: "Which regulation, platform policy, or country law" },
                      },
                      required: ["text", "source"],
                    },
                    description: "Things that are completely banned",
                  },
                  must: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        text: { type: "string", description: "Plain-language description of mandatory requirement" },
                        source: { type: "string", description: "Which regulation, platform policy, or country law" },
                      },
                      required: ["text", "source"],
                    },
                    description: "Mandatory requirements — must comply",
                  },
                  should: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        text: { type: "string", description: "Plain-language description of recommended practice" },
                        source: { type: "string", description: "Source of the recommendation" },
                      },
                      required: ["text", "source"],
                    },
                    description: "Recommended best practices",
                  },
                  shouldNot: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        text: { type: "string", description: "Plain-language description of what to avoid" },
                        source: { type: "string", description: "Source of the guidance" },
                      },
                      required: ["text", "source"],
                    },
                    description: "Things to avoid",
                  },
                  legislationSummary: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string", description: "Name of the law, regulation, or code" },
                        summary: { type: "string", description: "One or two sentence plain-English summary" },
                        jurisdiction: { type: "string", description: "Which country or region" },
                      },
                      required: ["name", "summary", "jurisdiction"],
                    },
                    description: "Key legislation that applies universally",
                  },
                  practicalRequirements: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        requirement: { type: "string", description: "Specific operational requirement" },
                        source: { type: "string", description: "Which regulation, platform, or country requires this" },
                      },
                      required: ["requirement", "source"],
                    },
                    description: "Concrete operational requirements that apply universally",
                  },
                },
                required: ["prohibited", "must", "should", "shouldNot", "legislationSummary", "practicalRequirements"],
              },
              categorySpecific: {
                type: "array",
                description: "Guidance specific to individual categories. One entry per category that has specific rules.",
                items: {
                  type: "object",
                  properties: {
                    category: { type: "string", description: "The category name this guidance applies to" },
                    prohibited: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          text: { type: "string" },
                          source: { type: "string" },
                        },
                        required: ["text", "source"],
                      },
                    },
                    must: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          text: { type: "string" },
                          source: { type: "string" },
                        },
                        required: ["text", "source"],
                      },
                    },
                    should: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          text: { type: "string" },
                          source: { type: "string" },
                        },
                        required: ["text", "source"],
                      },
                    },
                    shouldNot: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          text: { type: "string" },
                          source: { type: "string" },
                        },
                        required: ["text", "source"],
                      },
                    },
                    legislationSummary: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          name: { type: "string" },
                          summary: { type: "string" },
                          jurisdiction: { type: "string" },
                        },
                        required: ["name", "summary", "jurisdiction"],
                      },
                    },
                    practicalRequirements: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          requirement: { type: "string" },
                          source: { type: "string" },
                        },
                        required: ["requirement", "source"],
                      },
                    },
                  },
                  required: ["category"],
                },
              },
            },
            required: ["universal", "categorySpecific"],
          },
        },
      ],
    });

    let assistantText = "";
    let guidance: {
      universal: {
        prohibited: { text: string; source: string }[];
        must: { text: string; source: string }[];
        should: { text: string; source: string }[];
        shouldNot: { text: string; source: string }[];
        legislationSummary: { name: string; summary: string; jurisdiction: string }[];
        practicalRequirements: { requirement: string; source: string }[];
      };
      categorySpecific: {
        category: string;
        prohibited?: { text: string; source: string }[];
        must?: { text: string; source: string }[];
        should?: { text: string; source: string }[];
        shouldNot?: { text: string; source: string }[];
        legislationSummary?: { name: string; summary: string; jurisdiction: string }[];
        practicalRequirements?: { requirement: string; source: string }[];
      }[];
    } | null = null;

    for (const block of response.content) {
      if (block.type === "text") {
        assistantText += block.text;
      } else if (block.type === "tool_use" && block.name === "generate_guidance") {
        guidance = block.input as typeof guidance;
      }
    }

    if (!guidance) {
      return NextResponse.json(
        { error: "AI did not generate structured guidance" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      guidance,
      summary: assistantText,
    });
  } catch (err) {
    return internalError(err, "POST /api/compliance/brief/guidance");
  }
}
