import Papa from "papaparse";
import crypto from "crypto";

// ─── Google Ads column mapping ──────────────────────────────────────────────

/** Known Google Ads Editor CSV column headers mapped to our AdContent fields. */
const COLUMN_MAP: Record<string, string> = {
  // Headlines
  "headline 1":  "headline1",
  "headline 2":  "headline2",
  "headline 3":  "headline3",
  "headline 4":  "headline4",
  "headline 5":  "headline5",
  "headline 6":  "headline6",
  "headline 7":  "headline7",
  "headline 8":  "headline8",
  "headline 9":  "headline9",
  "headline 10": "headline10",
  "headline 11": "headline11",
  "headline 12": "headline12",
  "headline 13": "headline13",
  "headline 14": "headline14",
  "headline 15": "headline15",
  // Descriptions
  "description 1":  "description1",
  "description 2":  "description2",
  "description 3":  "description3",
  "description 4":  "description4",
  // Paths
  "path 1": "path1",
  "path 2": "path2",
  // URLs
  "final url":      "finalUrl",
  "final mobile url": "finalMobileUrl",
  // Other identifiable columns
  "campaign":     "campaign",
  "ad group":     "adGroup",
  "ad type":      "adType",
  "ad status":    "adStatus",
  "labels":       "labels",
};

/** The ad content fields we actually check for compliance. */
const CHECKABLE_FIELDS = new Set([
  "headline1", "headline2", "headline3", "headline4", "headline5",
  "headline6", "headline7", "headline8", "headline9", "headline10",
  "headline11", "headline12", "headline13", "headline14", "headline15",
  "description1", "description2", "description3", "description4",
  "path1", "path2", "finalUrl",
]);

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ColumnMapping {
  /** CSV header → our internal field name */
  mapped: Record<string, string>;
  /** CSV headers we couldn't map (preserved in output but not checked) */
  unmapped: string[];
  /** All original CSV headers in order */
  originalHeaders: string[];
}

export interface ParsedRow {
  rowIndex: number;
  /** Mapped ad content fields (only checkable ones) */
  adContent: Record<string, string>;
  /** The full original CSV row data (all columns) */
  rawCsvRow: Record<string, string>;
  /** SHA-256 hash of the checkable content for dedup */
  contentHash: string;
}

export interface BulkParseResult {
  success: true;
  columnMapping: ColumnMapping;
  rows: ParsedRow[];
  totalRows: number;
  uniqueRows: number;
  duplicateRows: number;
  /** Maps contentHash → array of rowIndexes that share it */
  duplicateGroups: Record<string, number[]>;
}

export interface BulkParseError {
  success: false;
  error: string;
}

// ─── Parsing ────────────────────────────────────────────────────────────────

export function detectColumnMapping(headers: string[]): ColumnMapping {
  const mapped: Record<string, string> = {};
  const unmapped: string[] = [];

  for (const header of headers) {
    const normalised = header.trim().toLowerCase();
    const field = COLUMN_MAP[normalised];
    if (field) {
      mapped[header] = field;
    } else {
      unmapped.push(header);
    }
  }

  return { mapped, unmapped, originalHeaders: headers };
}

function hashContent(adContent: Record<string, string>): string {
  const keys = Object.keys(adContent).sort();
  const canonical = keys.map((k) => `${k}:${adContent[k]}`).join("|");
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

export function parseGoogleAdsCsv(csvText: string): BulkParseResult | BulkParseError {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim(),
  });

  if (result.errors.length > 0) {
    const firstError = result.errors[0];
    return {
      success: false,
      error: `CSV parse error at row ${firstError.row ?? "?"}: ${firstError.message}`,
    };
  }

  if (!result.meta.fields || result.meta.fields.length === 0) {
    return { success: false, error: "CSV file has no column headers." };
  }

  const columnMapping = detectColumnMapping(result.meta.fields);

  // Check we found at least one checkable column
  const hasCheckableColumn = Object.values(columnMapping.mapped).some((f) =>
    CHECKABLE_FIELDS.has(f)
  );
  if (!hasCheckableColumn) {
    return {
      success: false,
      error:
        "No recognisable Google Ads columns found. Expected columns like 'Headline 1', 'Description 1', 'Final URL', etc.",
    };
  }

  const rows: ParsedRow[] = [];
  const hashMap = new Map<string, number[]>();

  for (let i = 0; i < result.data.length; i++) {
    const rawRow = result.data[i];

    // Build ad content from mapped checkable fields
    const adContent: Record<string, string> = {};
    for (const [csvHeader, fieldName] of Object.entries(columnMapping.mapped)) {
      if (CHECKABLE_FIELDS.has(fieldName)) {
        const value = rawRow[csvHeader]?.trim() ?? "";
        if (value) {
          adContent[fieldName] = value;
        }
      }
    }

    // Skip rows with no checkable content at all
    if (Object.keys(adContent).length === 0) continue;

    const contentHash = hashContent(adContent);

    // Track duplicates
    if (!hashMap.has(contentHash)) {
      hashMap.set(contentHash, []);
    }
    hashMap.get(contentHash)!.push(i);

    rows.push({
      rowIndex: i,
      adContent,
      rawCsvRow: rawRow,
      contentHash,
    });
  }

  // Build duplicate groups (only groups with >1 row)
  const duplicateGroups: Record<string, number[]> = {};
  let duplicateRows = 0;
  for (const [hash, indexes] of hashMap) {
    if (indexes.length > 1) {
      duplicateGroups[hash] = indexes;
      duplicateRows += indexes.length - 1; // first occurrence is not a duplicate
    }
  }

  return {
    success: true,
    columnMapping,
    rows,
    totalRows: rows.length,
    uniqueRows: rows.length - duplicateRows,
    duplicateRows,
    duplicateGroups,
  };
}

// ─── Transform to AdContentPayload ──────────────────────────────────────────

/**
 * Convert bulk row fields (headline1, headline2, description1, etc.)
 * into the AdContentPayload format the compliance engine expects.
 */
export function toAdContentPayload(fields: Record<string, string>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  // Collect Google Headlines
  const headlines: string[] = [];
  for (let i = 1; i <= 15; i++) {
    const val = fields[`headline${i}`]?.trim();
    if (val) headlines.push(val);
  }
  if (headlines.length > 0) {
    payload.googleHeadlines = headlines;
    // Also set headline to the first one for engines that check it
    payload.headline = headlines[0];
  }

  // Collect Google Descriptions
  const descriptions: string[] = [];
  for (let i = 1; i <= 4; i++) {
    const val = fields[`description${i}`]?.trim();
    if (val) descriptions.push(val);
  }
  if (descriptions.length > 0) {
    payload.googleDescriptions = descriptions;
    // Also set body to all descriptions joined for AI analysis
    payload.body = descriptions.join(" ");
  }

  // URLs and paths
  // displayUrl = path segments only (Google Ads Path 1 / Path 2, max 15 chars each)
  // finalUrl is the landing page URL — not subject to the display URL char limit
  if (fields.path1 || fields.path2) {
    const paths = [fields.path1, fields.path2].filter(Boolean).join("/");
    if (paths) payload.displayUrl = paths;
  }

  return payload;
}

// ─── CSV Re-export ──────────────────────────────────────────────────────────

/** Rebuild a CSV string from rows, preserving original column order and unmapped columns. */
export function rebuildCsv(
  originalHeaders: string[],
  rows: Array<{
    rawCsvRow: Record<string, string>;
    editedContent?: Record<string, string> | null;
  }>,
  columnMapping: ColumnMapping
): string {
  // Build reverse map: field name → CSV header
  const fieldToHeader: Record<string, string> = {};
  for (const [csvHeader, fieldName] of Object.entries(columnMapping.mapped)) {
    fieldToHeader[fieldName] = csvHeader;
  }

  const outputRows = rows.map((row) => {
    const outputRow = { ...row.rawCsvRow };

    // Apply edits if present
    if (row.editedContent) {
      for (const [fieldName, value] of Object.entries(row.editedContent)) {
        const csvHeader = fieldToHeader[fieldName];
        if (csvHeader) {
          outputRow[csvHeader] = value;
        }
      }
    }

    return outputRow;
  });

  return Papa.unparse(outputRows, {
    columns: originalHeaders,
    newline: "\r\n",
  });
}
