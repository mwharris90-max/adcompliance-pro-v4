import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { anthropic } from "@/lib/ai/client";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const userMessage = body.message as string;

  if (!userMessage?.trim()) {
    return NextResponse.json({ error: "Message required" }, { status: 400 });
  }

  // Fetch current config with context
  const config = await db.prohibitionConfig.findUnique({
    where: { id },
    include: {
      category: true,
      country: true,
      platform: true,
    },
  });

  if (!config) {
    return NextResponse.json({ error: "Config not found" }, { status: 404 });
  }

  // Fetch related rules for context
  const relatedGeoRules = await db.geoRule.findMany({
    where: {
      categoryId: config.categoryId,
      status: "PROHIBITED",
      ...(config.countryId ? { countryId: config.countryId } : {}),
    },
    include: {
      country: { select: { name: true, code: true } },
      platform: { select: { name: true } },
    },
  });

  const relatedPlatformRules = config.platformId
    ? await db.platformRule.findMany({
        where: {
          categoryId: config.categoryId,
          platformId: config.platformId,
          status: "PROHIBITED",
        },
        include: { platform: { select: { name: true } } },
      })
    : [];

  // Build conversation history
  const history: ChatMessage[] = (config.chatHistory as unknown as ChatMessage[]) ?? [];
  history.push({ role: "user", content: userMessage });

  const systemPrompt = `You are an AI compliance detection specialist helping an admin configure prohibition detection rules for an ad compliance checking platform.

CONTEXT:
- Category: ${config.category.name}
- ${config.countryId ? `Country: ${config.country?.name} (${config.country?.code})` : "All countries"}
- ${config.platformId ? `Platform: ${config.platform?.name}` : "All platforms"}

CURRENT CONFIGURATION:
- Warning title: ${config.warningTitle}
- Warning message: ${config.warningMessage}
- Confirmation message: ${config.confirmationMessage}
- Detection guidance: ${config.detectionGuidance || "(none set)"}
- Detection examples: ${config.detectionExamples ? JSON.stringify(config.detectionExamples) : "(none set)"}
- Strictness: ${config.strictness}/100

RELATED PROHIBITED RULES:
${relatedGeoRules.map((r) => `- Geo: ${r.country.name} (${r.country.code}) — ${r.notes || "No notes"} ${r.legislationUrl ? `[${r.legislationUrl}]` : ""}`).join("\n")}
${relatedPlatformRules.map((r) => `- Platform: ${r.platform.name} — ${r.notes || "No notes"}`).join("\n")}

YOUR ROLE:
1. Help the admin write effective detection guidance that the AI compliance checker can use to distinguish between adverts that definitely violate the prohibition vs those that are merely related to the topic
2. Suggest detection examples (pairs of ad content + verdict) that illustrate the boundary
3. Help calibrate strictness — higher means more aggressive flagging
4. Suggest improvements to user-facing warning text for clarity
5. When the admin asks you to update configuration, respond with a JSON block in this format:

\`\`\`json:update
{
  "warningTitle": "...",
  "warningMessage": "...",
  "confirmationMessage": "...",
  "detectionGuidance": "...",
  "detectionExamples": [...],
  "strictness": 50
}
\`\`\`

Only include fields that should change. The admin can then apply the suggested updates.

Be specific, practical, and concise. Focus on the real-world distinction between prohibited and permitted ads in this category.`;

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: systemPrompt,
    messages: history.map((m) => ({ role: m.role, content: m.content })),
  });

  const assistantMessage =
    response.content[0].type === "text" ? response.content[0].text : "";

  history.push({ role: "assistant", content: assistantMessage });

  // Save chat history
  await db.prohibitionConfig.update({
    where: { id },
    data: { chatHistory: history as unknown as import("@prisma/client").Prisma.InputJsonValue },
  });

  // Extract any suggested updates from the response
  let suggestedUpdate: Record<string, unknown> | null = null;
  const updateMatch = assistantMessage.match(/```json:update\s*\n([\s\S]*?)\n```/);
  if (updateMatch) {
    try {
      suggestedUpdate = JSON.parse(updateMatch[1]);
    } catch {
      // Invalid JSON in suggestion — ignore
    }
  }

  return NextResponse.json({
    success: true,
    message: assistantMessage,
    suggestedUpdate,
    history,
  });
}
