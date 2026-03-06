import { NextResponse } from "next/server";

/** Return a standardised 500 JSON response and log the error. */
export function internalError(err?: unknown, context?: string): NextResponse {
  console.error(`[API Error${context ? ` — ${context}` : ""}]`, err ?? "");
  return NextResponse.json(
    {
      success: false,
      error: { message: "An unexpected error occurred. Please try again." },
    },
    { status: 500 }
  );
}
