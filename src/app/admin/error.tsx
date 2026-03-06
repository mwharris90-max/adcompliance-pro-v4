"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error("[Admin Error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
        <AlertTriangle className="h-7 w-7 text-red-500" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-slate-900">
          Something went wrong
        </h2>
        <p className="text-sm text-slate-500 max-w-sm">
          An unexpected error occurred in the admin panel.
        </p>
        {error.digest && (
          <p className="text-xs text-slate-400">Error ID: {error.digest}</p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={reset} variant="outline" size="sm">
          <RefreshCw className="mr-2 h-3.5 w-3.5" />
          Try again
        </Button>
        <Button
          onClick={() => router.push("/admin")}
          variant="ghost"
          size="sm"
        >
          <ArrowLeft className="mr-2 h-3.5 w-3.5" />
          Admin Home
        </Button>
      </div>
    </div>
  );
}
