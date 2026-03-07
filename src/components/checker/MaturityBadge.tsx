"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface MaturityBadgeProps {
  maturity?: "ALPHA" | "BETA" | "LIVE";
  className?: string;
}

export function MaturityBadge({ maturity, className }: MaturityBadgeProps) {
  if (!maturity || maturity === "LIVE") return null;

  return (
    <Badge
      className={cn(
        "text-[10px] px-1.5 py-0 font-medium",
        maturity === "ALPHA" &&
          "bg-amber-100 text-amber-700 border border-amber-200 hover:bg-amber-100",
        maturity === "BETA" &&
          "bg-blue-100 text-blue-700 border border-blue-200 hover:bg-blue-100",
        className,
      )}
    >
      {maturity === "ALPHA" ? "Alpha" : "Beta"}
    </Badge>
  );
}
