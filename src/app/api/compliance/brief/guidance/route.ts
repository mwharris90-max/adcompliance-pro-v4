import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";
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
      max_tokens: 4096,
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

Generate the following sections:

1. PROHIBITED — Things that are completely banned. The ad cannot run at all for these categories/contexts.
2. MUST — Mandatory legal or regulatory requirements. Failing these means the ad is non-compliant.
3. SHOULD — Best practices and strong recommendations. Not strictly required but highly advisable.
4. SHOULD NOT — Things to avoid. Not outright banned but likely to cause compliance issues.
5. LEGISLATION SUMMARY — Name each relevant law, regulation, or industry code and provide a one or two sentence plain-English summary of what it means for advertisers. Include the jurisdiction.
6. PRACTICAL REQUIREMENTS — Call out specific, concrete operational requirements that the team needs to action. Examples: displaying a particular badge or logo, maintaining a local office or representative, obtaining a specific certification or licence, implementing age-gating, including mandatory disclaimer text, keeping records for a specified period, etc. Only include items that are genuinely required — do not speculate.

For each guidance item:
- Write in plain, non-technical English that a marketing team member can understand
- Be specific about what the requirement actually means in practice
- Reference which platform, country, or regulation the requirement comes from in the "source" field
- Do not use JSON, code, or technical jargon in the guidance text
- Turn structured conditions (like ageGate, disclaimers, time restrictions) into human-readable sentences

Examples of good guidance text:
- "Include a clear 'Drink Responsibly' disclaimer in all ad copy" (not "disclaimer.required: true, disclaimer.text: 'Drink Responsibly'")
- "Do not target users under 18 years of age" (not "ageGate.minimumAge: 18")
- "Ads must not run between 6am and 9pm" (not "timeRestrictions: {startTime: '06:00', endTime: '21:00'}")

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
            "Generate structured compliance guidance in Must/Should/Should Not format.",
          input_schema: {
            type: "object" as const,
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
                    name: { type: "string", description: "Name of the law, regulation, or code (e.g. 'UK CAP Code', 'GDPR', 'The Gambling Act 2005')" },
                    summary: { type: "string", description: "One or two sentence plain-English summary of what this law means for advertisers" },
                    jurisdiction: { type: "string", description: "Which country or region this applies to" },
                  },
                  required: ["name", "summary", "jurisdiction"],
                },
                description: "Key legislation and regulations that apply, with plain-English summaries",
              },
              practicalRequirements: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    requirement: { type: "string", description: "Specific operational requirement described in plain English" },
                    source: { type: "string", description: "Which regulation, platform, or country requires this" },
                  },
                  required: ["requirement", "source"],
                },
                description: "Concrete operational requirements like badges, local offices, age gates, certifications, etc.",
              },
            },
            required: ["prohibited", "must", "should", "shouldNot", "legislationSummary", "practicalRequirements"],
          },
        },
      ],
    });

    let assistantText = "";
    let guidance: {
      prohibited: { text: string; source: string }[];
      must: { text: string; source: string }[];
      should: { text: string; source: string }[];
      shouldNot: { text: string; source: string }[];
      legislationSummary: { name: string; summary: string; jurisdiction: string }[];
      practicalRequirements: { requirement: string; source: string }[];
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
