import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { anthropic } from "@/lib/ai/client";

/**
 * POST — AI auto-update: scans platform policies and suggests new/updated categories.
 * Returns a list of suggestions the admin can review and apply.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parentGroupId = (body.parentGroupId as string) ?? null;

  // Fetch existing categories + platforms
  const [existingCategories, platforms] = await Promise.all([
    db.category.findMany({
      where: parentGroupId ? { parentId: parentGroupId } : { parentId: { not: null } },
      select: { id: true, name: true, slug: true, description: true, parentId: true },
      orderBy: { name: "asc" },
    }),
    db.platform.findMany({
      where: { active: true },
      select: { id: true, name: true, slug: true },
    }),
  ]);

  // Fetch the parent group name if specified
  let parentName = "all groups";
  if (parentGroupId) {
    const parent = await db.category.findUnique({ where: { id: parentGroupId }, select: { name: true } });
    parentName = parent?.name ?? "this group";
  }

  const platformNames = platforms.map((p) => p.name).join(", ");

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    system: `You are an advertising compliance specialist. You have deep expertise in the advertising policies of major platforms (${platformNames}) and advertising regulations across key markets (US, UK, EU, Canada, Australia).`,
    tools: [
      {
        name: "suggest_categories",
        description: "Suggest new or updated advertising compliance categories",
        input_schema: {
          type: "object" as const,
          properties: {
            suggestions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  action: { type: "string", enum: ["add", "update", "merge"], description: "add = new category, update = rename/redescribe existing, merge = combine duplicates" },
                  existingId: { type: "string", description: "ID of existing category (for update/merge actions)" },
                  name: { type: "string" },
                  slug: { type: "string" },
                  description: { type: "string" },
                  reasoning: { type: "string", description: "Why this change is needed — what platform policy or regulation drives it" },
                  platforms: { type: "array", items: { type: "string" }, description: "Which platforms have specific policies for this category" },
                  suggestedStatus: { type: "string", enum: ["ALLOWED", "RESTRICTED", "PROHIBITED"], description: "Typical status across platforms" },
                },
                required: ["action", "name", "slug", "description", "reasoning", "suggestedStatus"],
              },
            },
          },
          required: ["suggestions"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "suggest_categories" },
    messages: [
      {
        role: "user",
        content: `Review the current advertising compliance categories for "${parentName}" and suggest improvements.

EXISTING CATEGORIES:
${existingCategories.map((c) => `- ${c.name} (${c.slug}): ${c.description || "no description"}`).join("\n")}

PLATFORMS WE COVER: ${platformNames}

Please suggest:
1. NEW sub-categories that are missing but have distinct advertising policies on the above platforms (e.g. specific product types that platforms treat differently)
2. UPDATES to existing category names or descriptions that would improve clarity
3. Any categories that should be MERGED because they overlap

Focus on categories where platforms have specific, distinct advertising policies. Don't suggest categories that would be covered by existing ones. Keep slug format as lowercase-hyphenated.

Return up to 10 suggestions, prioritised by impact on compliance accuracy.`,
      },
    ],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    return NextResponse.json({ success: true, suggestions: [] });
  }

  const input = toolUse.input as { suggestions: Array<{
    action: string;
    existingId?: string;
    name: string;
    slug: string;
    description: string;
    reasoning: string;
    platforms?: string[];
    suggestedStatus: string;
  }> };

  return NextResponse.json({
    success: true,
    suggestions: input.suggestions ?? [],
    parentGroupId,
    parentName,
  });
}
