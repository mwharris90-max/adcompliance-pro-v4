import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

function formatExampleForPrompt(example: {
  verdict: "COMPLIANT" | "NON_COMPLIANT";
  contentSample: string;
  explanation: string;
  rubric: { key: string; value: string }[] | null;
}): string {
  const label = example.verdict === "COMPLIANT" ? "COMPLIANT" : "NON_COMPLIANT";
  const whyLabel = example.verdict === "COMPLIANT" ? "compliant" : "non-compliant";
  const rubricStr =
    example.rubric && example.rubric.length > 0
      ? `\nCriteria: ${example.rubric.map((r) => `${r.key} → ${r.value}`).join("; ")}`
      : "";
  return `[Example — ${label}]
Content: "${example.contentSample}"
Why ${whyLabel}: "${example.explanation}"${rubricStr}`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;
  void req;

  const { id } = await params;

  const example = await db.complianceExample.findUnique({
    where: { id },
    select: { verdict: true, contentSample: true, explanation: true, rubric: true },
  });

  if (!example) {
    return NextResponse.json(
      { success: false, error: { message: "Example not found" } },
      { status: 404 }
    );
  }

  const promptBlock = formatExampleForPrompt({
    verdict: example.verdict,
    contentSample: example.contentSample,
    explanation: example.explanation,
    rubric: (example.rubric as { key: string; value: string }[] | null) ?? null,
  });

  return NextResponse.json({ success: true, data: { promptBlock } });
}
