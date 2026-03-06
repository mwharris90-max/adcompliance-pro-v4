import type {
  ComplianceChecklistItem,
  AdContentPayload,
  RewriteableField,
} from "@/lib/ai/runComplianceCheck";

// Re-export the type so consumers can import from here directly
export type { RewriteableField };

// ─── detectRewriteableField ───────────────────────────────────────────────────

/**
 * Given a checklist item and the current ad content, returns the field name
 * that the item relates to (and can be rewritten), or null if not detectable.
 */
export function detectRewriteableField(
  item: ComplianceChecklistItem,
  adContent: AdContentPayload
): RewriteableField | null {
  // Technical layer: parse specKey from the item ID
  if (item.layer === "technical") {
    return detectFromSpecKey(item.id);
  }

  // AI / rule layers: match quotedContent against field values
  if (
    item.layer === "ai_text" ||
    item.layer === "platform_rule" ||
    item.layer === "geo_rule"
  ) {
    return detectFromQuotedContent(item, adContent);
  }

  return null;
}

function detectFromSpecKey(itemId: string): RewriteableField | null {
  // IDs look like "technical:headline_char_limit:platformId[:index]"
  const specKey = itemId.split(":")[1] ?? "";

  if (specKey.includes("headline")) {
    // Check if indexed (Google headlines)
    const match = itemId.match(/:(\d+)$/);
    if (match) {
      return `googleHeadlines[${parseInt(match[1])}]`;
    }
    return "headline";
  }
  if (specKey.includes("description")) {
    const match = itemId.match(/:(\d+)$/);
    if (match) {
      return `googleDescriptions[${parseInt(match[1])}]`;
    }
    return null;
  }
  if (specKey.includes("body") || specKey.includes("text")) {
    return "body";
  }
  if (specKey.includes("cta") || specKey.includes("call_to_action")) {
    return "callToAction";
  }
  if (specKey.includes("display_url") || specKey.includes("url")) {
    return "displayUrl";
  }
  return null;
}

function detectFromQuotedContent(
  item: ComplianceChecklistItem,
  adContent: AdContentPayload
): RewriteableField | null {
  const quoted = item.quotedContent?.trim();

  if (quoted) {
    // Try to match quoted content against each field value
    if (adContent.headline && adContent.headline.includes(quoted)) return "headline";
    if (adContent.body && adContent.body.includes(quoted)) return "body";
    if (adContent.callToAction && adContent.callToAction.includes(quoted)) return "callToAction";
    if (adContent.displayUrl && adContent.displayUrl.includes(quoted)) return "displayUrl";

    if (adContent.googleHeadlines) {
      for (let i = 0; i < adContent.googleHeadlines.length; i++) {
        if (adContent.googleHeadlines[i]?.includes(quoted)) {
          return `googleHeadlines[${i}]`;
        }
      }
    }
    if (adContent.googleDescriptions) {
      for (let i = 0; i < adContent.googleDescriptions.length; i++) {
        if (adContent.googleDescriptions[i]?.includes(quoted)) {
          return `googleDescriptions[${i}]`;
        }
      }
    }
  }

  // Fallback: if no quoted content, pick the most prominent non-empty field
  // but only for text-rewriteable layers (not image)
  if (adContent.headline?.trim()) return "headline";
  if (adContent.body?.trim()) return "body";
  if (adContent.googleHeadlines?.some((h) => h?.trim())) {
    const idx = adContent.googleHeadlines!.findIndex((h) => h?.trim());
    return `googleHeadlines[${idx}]`;
  }

  return null;
}

// ─── getOriginalText ──────────────────────────────────────────────────────────

export function getOriginalText(
  field: RewriteableField,
  adContent: AdContentPayload
): string {
  // Handle indexed fields like googleHeadlines[2]
  const indexedMatch = (field as string).match(/^(googleHeadlines|googleDescriptions)\[(\d+)\]$/);
  if (indexedMatch) {
    const [, key, idxStr] = indexedMatch;
    const arr = adContent[key as "googleHeadlines" | "googleDescriptions"] ?? [];
    return arr[parseInt(idxStr)] ?? "";
  }

  const simple = field as "headline" | "body" | "callToAction" | "displayUrl";
  return adContent[simple] ?? "";
}

// ─── computeWordDiff ──────────────────────────────────────────────────────────

export type DiffToken = { type: "keep" | "add" | "remove"; text: string };

/**
 * LCS-based word-level diff. Tokens are whitespace-delimited words, but we
 * preserve the surrounding whitespace in the output so the result is renderable
 * inline without extra spaces.
 */
export function computeWordDiff(original: string, revised: string): DiffToken[] {
  const origWords = tokenise(original);
  const revWords = tokenise(revised);

  const lcs = longestCommonSubsequence(origWords, revWords);

  const result: DiffToken[] = [];
  let oi = 0;
  let ri = 0;
  let li = 0;

  while (oi < origWords.length || ri < revWords.length) {
    if (
      li < lcs.length &&
      oi < origWords.length &&
      ri < revWords.length &&
      origWords[oi] === lcs[li] &&
      revWords[ri] === lcs[li]
    ) {
      result.push({ type: "keep", text: origWords[oi] });
      oi++;
      ri++;
      li++;
    } else {
      // Emit removes before adds for visual consistency
      while (oi < origWords.length && (li >= lcs.length || origWords[oi] !== lcs[li])) {
        result.push({ type: "remove", text: origWords[oi] });
        oi++;
      }
      while (ri < revWords.length && (li >= lcs.length || revWords[ri] !== lcs[li])) {
        result.push({ type: "add", text: revWords[ri] });
        ri++;
      }
    }
  }

  return result;
}

/** Split on whitespace boundaries, keeping each word with its trailing space. */
function tokenise(text: string): string[] {
  return text.match(/\S+\s*/g) ?? [];
}

function longestCommonSubsequence(a: string[], b: string[]): string[] {
  const m = a.length;
  const n = b.length;
  // dp[i][j] = LCS length of a[0..i-1], b[0..j-1]
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack
  const lcs: string[] = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      lcs.unshift(a[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  return lcs;
}

// ─── fieldLabel helper ────────────────────────────────────────────────────────

export function fieldLabelFor(field: RewriteableField): string {
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
