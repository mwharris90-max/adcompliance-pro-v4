import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// PATCH — update a specific prohibition config
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  const config = await db.prohibitionConfig.update({
    where: { id },
    data: {
      ...(body.warningTitle !== undefined && { warningTitle: body.warningTitle }),
      ...(body.warningMessage !== undefined && { warningMessage: body.warningMessage }),
      ...(body.confirmationMessage !== undefined && { confirmationMessage: body.confirmationMessage }),
      ...(body.detectionGuidance !== undefined && { detectionGuidance: body.detectionGuidance }),
      ...(body.detectionExamples !== undefined && { detectionExamples: body.detectionExamples }),
      ...(body.strictness !== undefined && { strictness: body.strictness }),
      ...(body.active !== undefined && { active: body.active }),
    },
    include: {
      category: { select: { id: true, name: true } },
      country: { select: { id: true, name: true, code: true } },
      platform: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ success: true, config });
}

// DELETE — remove a prohibition config (rule stays, just custom text removed)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await db.prohibitionConfig.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
