import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { internalError } from "@/lib/api-error";
import { runRewrite } from "@/lib/ai/runRewrite";

const schema = z.object({
  originalText: z.string().min(1),
  fieldLabel: z.string(),
  issueTitle: z.string(),
  issueExplanation: z.string(),
  suggestion: z.string().optional().default(""),
  platformIds: z.array(z.string()).min(1),
  categoryIds: z.array(z.string()).min(1),
  countryIds: z.array(z.string()).min(1),
  maxChars: z.number().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const [platforms, categories, countries, platformRules, geoRules] = await Promise.all([
      db.platform.findMany({ where: { id: { in: body.platformIds } }, select: { id: true, name: true } }),
      db.category.findMany({ where: { id: { in: body.categoryIds } }, select: { id: true, name: true } }),
      db.country.findMany({ where: { id: { in: body.countryIds } }, select: { id: true, name: true } }),
      db.platformRule.findMany({
        where: { platformId: { in: body.platformIds }, categoryId: { in: body.categoryIds } },
        include: { platform: { select: { name: true, slug: true } }, category: { select: { name: true } } },
      }),
      db.geoRule.findMany({
        where: {
          countryId: { in: body.countryIds },
          categoryId: { in: body.categoryIds },
          OR: [{ platformId: null }, { platformId: { in: body.platformIds } }],
        },
        include: { country: { select: { name: true } }, category: { select: { name: true } }, platform: { select: { name: true } } },
      }),
    ]);

    const output = await runRewrite({
      originalText: body.originalText,
      fieldLabel: body.fieldLabel,
      issueTitle: body.issueTitle,
      issueExplanation: body.issueExplanation,
      suggestion: body.suggestion,
      platformNames: platforms.map((p) => p.name),
      categoryNames: categories.map((c) => c.name),
      countryNames: countries.map((c) => c.name),
      platformRules,
      geoRules,
      maxChars: body.maxChars,
    });

    if (!output.isCompliantVersionPossible) {
      return NextResponse.json(
        { error: output.noComplianceReason ?? "A compliant version is not possible." },
        { status: 422 }
      );
    }

    return NextResponse.json({ success: true, data: output });
  } catch (err) {
    return internalError(err, "POST /api/compliance/rewrite-field");
  }
}
