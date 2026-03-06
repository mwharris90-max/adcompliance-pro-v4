import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { internalError } from "@/lib/api-error";
import { runRewrite } from "@/lib/ai/runRewrite";
import { getOriginalText } from "@/lib/rewrite-utils";
import type { RewriteableField, ComplianceChecklistItem, AdContentPayload } from "@/lib/ai/runComplianceCheck";

const rewriteSchema = z.object({
  itemId: z.string(),
  field: z.string(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ checkId: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { success: false, error: { message: "Unauthorized" } },
      { status: 401 }
    );
  }

  const { checkId } = await params;

  // Parse + validate body
  let body: { itemId: string; field: string };
  try {
    body = rewriteSchema.parse(await req.json());
  } catch {
    return NextResponse.json(
      { success: false, error: { message: "Invalid request body" } },
      { status: 400 }
    );
  }

  const { itemId, field } = body;

  try {
    // Load check + verify ownership
    const check = await db.complianceCheck.findUnique({
      where: { id: checkId },
      select: {
        userId: true,
        adContent: true,
        platformIds: true,
        categoryIds: true,
        countryIds: true,
        results: true,
      },
    });

    if (!check) {
      return NextResponse.json(
        { success: false, error: { message: "Check not found" } },
        { status: 404 }
      );
    }

    if (check.userId !== session.user.id && session.user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: { message: "Forbidden" } },
        { status: 403 }
      );
    }

    // Extract original text from adContent
    const adContent = (check.adContent ?? {}) as AdContentPayload;
    const originalText = getOriginalText(field as RewriteableField, adContent);

    // Find the checklist item to get issue context
    const results = check.results as { checklist?: ComplianceChecklistItem[] } | null;
    const checklistItem = results?.checklist?.find((item) => item.id === itemId);

    if (!checklistItem) {
      return NextResponse.json(
        { success: false, error: { message: "Checklist item not found" } },
        { status: 404 }
      );
    }

    // Load platform and geo rules for context
    const { platformIds, categoryIds, countryIds } = check;

    const [platforms, categories, countries, platformRules, geoRules] =
      await Promise.all([
        db.platform.findMany({
          where: { id: { in: platformIds } },
          select: { id: true, name: true },
        }),
        db.category.findMany({
          where: { id: { in: categoryIds } },
          select: { id: true, name: true },
        }),
        db.country.findMany({
          where: { id: { in: countryIds } },
          select: { id: true, name: true },
        }),
        db.platformRule.findMany({
          where: {
            platformId: { in: platformIds },
            categoryId: { in: categoryIds },
          },
          include: {
            platform: { select: { name: true, slug: true } },
            category: { select: { name: true } },
          },
        }),
        db.geoRule.findMany({
          where: {
            countryId: { in: countryIds },
            categoryId: { in: categoryIds },
            OR: [{ platformId: null }, { platformId: { in: platformIds } }],
          },
          include: {
            country: { select: { name: true } },
            category: { select: { name: true } },
            platform: { select: { name: true } },
          },
        }),
      ]);

    // Derive maxChars from technical spec items if this is a char limit field
    const maxChars = deriveMaxChars(field, results?.checklist ?? []);

    // Call the rewrite engine
    const output = await runRewrite({
      originalText,
      fieldLabel: fieldLabelFor(field as RewriteableField),
      issueTitle: checklistItem.ruleTitle,
      issueExplanation: checklistItem.explanation,
      suggestion: checklistItem.suggestion,
      platformNames: platforms.map((p) => p.name),
      categoryNames: categories.map((c) => c.name),
      countryNames: countries.map((c) => c.name),
      platformRules,
      geoRules,
      maxChars,
    });

    if (!output.isCompliantVersionPossible) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: output.noComplianceReason ?? "A compliant version is not possible for this item.",
          },
        },
        { status: 422 }
      );
    }

    return NextResponse.json({ success: true, data: output });
  } catch (err) {
    return internalError(err, `POST /api/compliance/${checkId}/rewrite`);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deriveMaxChars(field: string, checklist: ComplianceChecklistItem[]): number | undefined {
  // Look for a technical PASS/FAIL item that tells us the char limit for this field
  const match = checklist.find(
    (item) =>
      item.layer === "technical" &&
      item.id.includes(fieldToSpecKey(field))
  );
  if (!match) return undefined;

  const m = match.ruleTitle.match(/\((\d+)\)/);
  if (m) return parseInt(m[1]);
  return undefined;
}

function fieldToSpecKey(field: string): string {
  if (field === "headline") return "headline_char_limit";
  if (field === "body") return "body_char_limit";
  if (field === "callToAction") return "cta";
  if (field === "displayUrl") return "display_url";
  if (field.startsWith("googleHeadlines")) return "headline_char_limit";
  if (field.startsWith("googleDescriptions")) return "description_char_limit";
  return field;
}

function fieldLabelFor(field: RewriteableField): string {
  const map: Partial<Record<string, string>> = {
    headline: "Headline",
    body: "Body Copy",
    callToAction: "Call to Action",
    displayUrl: "Display URL",
  };
  const indexedMatch = (field as string).match(/^(googleHeadlines|googleDescriptions)\[(\d+)\]$/);
  if (indexedMatch) {
    const [, key, idxStr] = indexedMatch;
    const num = parseInt(idxStr) + 1;
    return key === "googleHeadlines" ? `Google Headline ${num}` : `Google Description ${num}`;
  }
  return map[field] ?? field;
}
