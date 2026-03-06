import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { ComplianceIssue, ComplianceResult } from "@/lib/ai/runComplianceCheck";

// ─── Palette ──────────────────────────────────────────────────────────────────

const C = {
  brand:    "#0f172a",
  slate600: "#475569",
  slate400: "#94a3b8",
  slate200: "#e2e8f0",
  slate100: "#f1f5f9",
  white:    "#ffffff",
  red700:   "#b91c1c",
  red600:   "#dc2626",
  red100:   "#fee2e2",
  red200:   "#fecaca",
  amber700: "#b45309",
  amber600: "#d97706",
  amber100: "#fef3c7",
  amber200: "#fde68a",
  green700: "#15803d",
  green100: "#dcfce7",
  green200: "#bbf7d0",
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: C.brand,
    paddingTop: 36,
    paddingBottom: 60,
    paddingLeft: 48,
    paddingRight: 48,
    lineHeight: 1.4,
  },
  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 18,
  },
  divider: {
    height: 1,
    backgroundColor: C.slate200,
    marginBottom: 18,
  },
  brandName: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: C.brand,
    marginBottom: 2,
  },
  reportTitle: { fontSize: 9, color: C.slate600 },
  headerMeta: { fontSize: 8, color: C.slate400, textAlign: "right" },
  // Status banner
  banner: {
    borderRadius: 6,
    padding: 12,
    marginBottom: 16,
  },
  bannerClean:      { backgroundColor: C.green100, borderWidth: 1, borderColor: C.green200 },
  bannerWarnings:   { backgroundColor: C.amber100, borderWidth: 1, borderColor: C.amber200 },
  bannerViolations: { backgroundColor: C.red100,   borderWidth: 1, borderColor: C.red200 },
  bannerTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 3 },
  bannerTitleClean:      { color: C.green700 },
  bannerTitleWarnings:   { color: C.amber700 },
  bannerTitleViolations: { color: C.red700 },
  bannerBody: { fontSize: 8.5, color: C.slate600, lineHeight: 1.5 },
  // Summary row
  summaryRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
  summaryCard: {
    flex: 1,
    backgroundColor: C.slate100,
    borderRadius: 4,
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 10,
    paddingRight: 10,
  },
  summaryLabel: {
    fontSize: 7,
    color: C.slate400,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  summaryValue: { fontSize: 11, fontFamily: "Helvetica-Bold", color: C.brand },
  summaryValueRed:   { color: C.red600 },
  summaryValueAmber: { color: C.amber600 },
  // Section headings
  sectionHeading: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginBottom: 8,
    marginTop: 4,
  },
  headingRed:   { color: C.red700 },
  headingAmber: { color: C.amber700 },
  sectionDivider: { height: 1, backgroundColor: C.slate200, marginTop: 16, marginBottom: 16 },
  // Issue cards
  issueCard: { borderRadius: 4, marginBottom: 8, overflow: "hidden" },
  issueCardViolation: { backgroundColor: C.red100,   borderWidth: 1, borderColor: C.red200 },
  issueCardWarning:   { backgroundColor: C.amber100, borderWidth: 1, borderColor: C.amber200 },
  issueAccent: { width: 3, position: "absolute", top: 0, bottom: 0, left: 0 },
  issueAccentRed:   { backgroundColor: C.red600 },
  issueAccentAmber: { backgroundColor: C.amber600 },
  issueInner: { paddingTop: 8, paddingBottom: 8, paddingLeft: 12, paddingRight: 9 },
  issueHeaderRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  badge: {
    borderRadius: 3,
    paddingTop: 1,
    paddingBottom: 2,
    paddingLeft: 5,
    paddingRight: 5,
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.3,
  },
  badgeViolation: { backgroundColor: C.red600,   color: C.white },
  badgeWarning:   { backgroundColor: C.amber600, color: C.white },
  issueTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", flex: 1 },
  issueTitleRed:   { color: C.red700 },
  issueTitleAmber: { color: C.amber700 },
  fieldCode: {
    fontFamily: "Courier",
    fontSize: 7,
    color: C.slate600,
    backgroundColor: C.white,
    borderRadius: 2,
    paddingTop: 1,
    paddingBottom: 1,
    paddingLeft: 4,
    paddingRight: 4,
    marginBottom: 5,
    alignSelf: "flex-start",
  },
  bodyText: { fontSize: 8, color: "#374151", lineHeight: 1.5, marginBottom: 3 },
  suggestionBox: {
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.slate200,
    borderRadius: 3,
    paddingTop: 5,
    paddingBottom: 5,
    paddingLeft: 7,
    paddingRight: 7,
    marginTop: 5,
  },
  suggestionLabel: { fontSize: 7, fontFamily: "Helvetica-Bold", color: C.brand, marginBottom: 2 },
  suggestionText:  { fontSize: 7.5, color: "#374151", lineHeight: 1.4 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 3, marginTop: 5 },
  tag: {
    backgroundColor: C.white,
    borderRadius: 2,
    paddingTop: 1,
    paddingBottom: 1,
    paddingLeft: 4,
    paddingRight: 4,
    fontSize: 7,
    color: C.slate600,
  },
  sourceText: { fontSize: 7, color: C.slate400, marginTop: 4 },
  // Clean state
  cleanBox: {
    backgroundColor: C.green100,
    borderRadius: 6,
    padding: 14,
    borderWidth: 1,
    borderColor: C.green200,
  },
  cleanTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", color: C.green700, marginBottom: 10 },
  cleanItem:  { fontSize: 8.5, color: C.green700, marginBottom: 4, lineHeight: 1.4 },
  // Footer
  footer: {
    position: "absolute",
    bottom: 24,
    left: 48,
    right: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 6,
  },
  footerDivider: {
    position: "absolute",
    bottom: 36,
    left: 48,
    right: 48,
    height: 1,
    backgroundColor: C.slate200,
  },
  footerText: { fontSize: 7, color: C.slate400 },
});

// ─── Sub-components ───────────────────────────────────────────────────────────

function IssueCardPdf({ issue }: { issue: ComplianceIssue }) {
  const isViolation = issue.severity === "violation";
  return (
    <View
      style={[s.issueCard, isViolation ? s.issueCardViolation : s.issueCardWarning]}
      wrap={false}
    >
      {/* Left accent bar */}
      <View style={[s.issueAccent, isViolation ? s.issueAccentRed : s.issueAccentAmber]} />

      <View style={s.issueInner}>
        {/* Header row: badge + title */}
        <View style={s.issueHeaderRow}>
          <Text style={[s.badge, isViolation ? s.badgeViolation : s.badgeWarning]}>
            {isViolation ? "VIOLATION" : "WARNING"}
          </Text>
          <Text style={[s.issueTitle, isViolation ? s.issueTitleRed : s.issueTitleAmber]}>
            {issue.title}
          </Text>
        </View>

        {/* Field */}
        {issue.field && (
          <Text style={s.fieldCode}>{issue.field}</Text>
        )}

        {/* Explanation */}
        <Text style={s.bodyText}>{issue.explanation}</Text>

        {/* Platforms / Countries */}
        {(issue.applicablePlatforms.length > 0 || issue.applicableCountries.length > 0) && (
          <View style={s.tagRow}>
            {issue.applicablePlatforms.map((p, i) => (
              <Text key={i} style={s.tag}>{p}</Text>
            ))}
            {issue.applicableCountries.map((c, i) => (
              <Text key={i} style={s.tag}>{c}</Text>
            ))}
          </View>
        )}

        {/* Suggestion */}
        <View style={s.suggestionBox}>
          <Text style={s.suggestionLabel}>Suggestion</Text>
          <Text style={s.suggestionText}>{issue.suggestion}</Text>
        </View>

        {/* Source */}
        {issue.ruleReference && (
          <Text style={s.sourceText}>
            Source: {issue.ruleReference.source}
            {issue.ruleReference.ruleText ? ` — "${issue.ruleReference.ruleText}"` : ""}
          </Text>
        )}
      </View>
    </View>
  );
}

// ─── Document ─────────────────────────────────────────────────────────────────

export interface ReportInput {
  checkId: string;
  overallStatus: string;
  results: ComplianceResult | null;
  platformNames: string[];
  categoryCount: number;
  countryCount: number;
  completedAt: Date | null;
}

function ComplianceReportDocument({ input }: { input: ReportInput }) {
  const { overallStatus, results, platformNames, categoryCount, countryCount, completedAt, checkId } = input;

  const issues = results?.issues ?? [];
  const violations = issues.filter((i) => i.severity === "violation");
  const warnings = issues.filter((i) => i.severity === "warning");
  const summary = results?.summary ?? "";

  const statusLabel =
    overallStatus === "CLEAN"
      ? "No Compliance Issues Found"
      : overallStatus === "WARNINGS"
      ? `${warnings.length} Warning${warnings.length !== 1 ? "s" : ""} Detected`
      : overallStatus === "VIOLATIONS"
      ? `${violations.length + warnings.length} Issue${violations.length + warnings.length !== 1 ? "s" : ""} Found`
      : "Check Failed";

  const checkedDate = completedAt
    ? new Date(completedAt).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  const bannerStyle =
    overallStatus === "CLEAN"
      ? s.bannerClean
      : overallStatus === "WARNINGS"
      ? s.bannerWarnings
      : s.bannerViolations;

  const bannerTitleStyle =
    overallStatus === "CLEAN"
      ? s.bannerTitleClean
      : overallStatus === "WARNINGS"
      ? s.bannerTitleWarnings
      : s.bannerTitleViolations;

  return (
    <Document
      title="AdCompliance Pro — Compliance Report"
      author="AdCompliance Pro"
      subject={`Compliance Report — ${checkedDate}`}
    >
      <Page size="LETTER" style={s.page}>
        {/* ── Header ── */}
        <View style={s.header}>
          <View>
            <Text style={s.brandName}>AdCompliance Pro</Text>
            <Text style={s.reportTitle}>Compliance Report</Text>
          </View>
          <View>
            <Text style={s.headerMeta}>{checkedDate}</Text>
            <Text style={s.headerMeta}>Report #{checkId.slice(-8).toUpperCase()}</Text>
          </View>
        </View>
        <View style={s.divider} />

        {/* ── Status banner ── */}
        <View style={[s.banner, bannerStyle]}>
          <Text style={[s.bannerTitle, bannerTitleStyle]}>{statusLabel}</Text>
          {summary ? <Text style={s.bannerBody}>{summary}</Text> : null}
        </View>

        {/* ── Summary stats ── */}
        <View style={s.summaryRow}>
          <View style={s.summaryCard}>
            <Text style={s.summaryLabel}>Platforms</Text>
            <Text style={s.summaryValue}>{platformNames.length}</Text>
            <Text style={[s.summaryLabel, { marginTop: 2, textTransform: "none", letterSpacing: 0 }]}>
              {platformNames.slice(0, 3).join(", ")}
              {platformNames.length > 3 ? ` +${platformNames.length - 3}` : ""}
            </Text>
          </View>
          <View style={s.summaryCard}>
            <Text style={s.summaryLabel}>Categories</Text>
            <Text style={s.summaryValue}>{categoryCount}</Text>
          </View>
          <View style={s.summaryCard}>
            <Text style={s.summaryLabel}>Countries</Text>
            <Text style={s.summaryValue}>{countryCount}</Text>
          </View>
          <View style={s.summaryCard}>
            <Text style={s.summaryLabel}>Violations</Text>
            <Text style={[s.summaryValue, violations.length > 0 ? s.summaryValueRed : {}]}>
              {violations.length}
            </Text>
          </View>
          <View style={s.summaryCard}>
            <Text style={s.summaryLabel}>Warnings</Text>
            <Text style={[s.summaryValue, warnings.length > 0 ? s.summaryValueAmber : {}]}>
              {warnings.length}
            </Text>
          </View>
        </View>

        {/* ── Violations ── */}
        {violations.length > 0 && (
          <View>
            <Text style={[s.sectionHeading, s.headingRed]}>
              Violations — must resolve before submitting ({violations.length})
            </Text>
            {violations.map((issue, i) => (
              <IssueCardPdf key={i} issue={issue} />
            ))}
          </View>
        )}

        {violations.length > 0 && warnings.length > 0 && (
          <View style={s.sectionDivider} />
        )}

        {/* ── Warnings ── */}
        {warnings.length > 0 && (
          <View>
            <Text style={[s.sectionHeading, s.headingAmber]}>
              Warnings — review before submitting ({warnings.length})
            </Text>
            {warnings.map((issue, i) => (
              <IssueCardPdf key={i} issue={issue} />
            ))}
          </View>
        )}

        {/* ── Clean state ── */}
        {overallStatus === "CLEAN" && (
          <View style={s.cleanBox}>
            <Text style={s.cleanTitle}>All checks passed</Text>
            <Text style={s.cleanItem}>✓  Character limits within platform specifications</Text>
            <Text style={s.cleanItem}>✓  Platform advertising policies reviewed</Text>
            <Text style={s.cleanItem}>✓  Geographic regulations checked for selected countries</Text>
            <Text style={s.cleanItem}>✓  AI content analysis complete — no issues detected</Text>
          </View>
        )}

        {/* ── Footer (fixed, repeats on each page) ── */}
        <View style={s.footerDivider} fixed />
        <View style={s.footer} fixed>
          <Text style={s.footerText}>AdCompliance Pro · Confidential</Text>
          <Text
            style={s.footerText}
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

export async function generateComplianceReport(input: ReportInput): Promise<Buffer> {
  return renderToBuffer(<ComplianceReportDocument input={input} />);
}
