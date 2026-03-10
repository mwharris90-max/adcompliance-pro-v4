import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import path from "path";
import fs from "fs";

// ── Logo ────────────────────────────────────────────────────────────────────

function getLogoDataUri(): string {
  const logoPath = path.join(process.cwd(), "public", "logo.png");
  const buf = fs.readFileSync(logoPath);
  return `data:image/png;base64,${buf.toString("base64")}`;
}

// ── Brand Palette ───────────────────────────────────────────────────────────

const C = {
  brandBlue:  "#1A56DB",
  brandPink:  "#E4168A",
  brandDark:  "#0E1726",
  slate900:   "#0f172a",
  slate700:   "#334155",
  slate600:   "#475569",
  slate500:   "#64748b",
  slate400:   "#94a3b8",
  slate300:   "#cbd5e1",
  slate200:   "#e2e8f0",
  slate100:   "#f1f5f9",
  slate50:    "#f8fafc",
  white:      "#ffffff",
  red700:     "#b91c1c",
  red600:     "#dc2626",
  red100:     "#fee2e2",
  red50:      "#fef2f2",
  amber700:   "#b45309",
  amber600:   "#d97706",
  amber100:   "#fef3c7",
  amber50:    "#fffbeb",
  green700:   "#15803d",
  green600:   "#16a34a",
  green100:   "#dcfce7",
  green50:    "#f0fdf4",
};

// ── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: C.slate900,
    paddingTop: 0,
    paddingBottom: 56,
    paddingLeft: 0,
    paddingRight: 0,
    lineHeight: 1.45,
    backgroundColor: C.white,
  },
  headerBar: {
    backgroundColor: C.brandDark,
    paddingTop: 24,
    paddingBottom: 24,
    paddingLeft: 40,
    paddingRight: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  logo: { width: 48, height: 28 },
  headerBrand: { flexDirection: "column" },
  brandName: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: C.white,
    letterSpacing: 0.3,
  },
  brandSub: { fontSize: 8, color: C.slate400, marginTop: 1 },
  headerRight: { alignItems: "flex-end" },
  headerDate: { fontSize: 8, color: C.slate300 },
  headerType: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: C.brandBlue,
    marginTop: 2,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  accentStripe: { height: 3, flexDirection: "row" },
  stripeBlue: { flex: 1, backgroundColor: C.brandBlue },
  stripePink: { flex: 1, backgroundColor: C.brandPink },
  body: { paddingLeft: 40, paddingRight: 40, paddingTop: 20 },
  // ── Verdict ──
  verdictBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 8,
    marginBottom: 18,
    borderWidth: 1,
  },
  verdictCompliant: { backgroundColor: C.green50, borderColor: C.green100 },
  verdictWarning: { backgroundColor: C.amber50, borderColor: C.amber100 },
  verdictFail: { backgroundColor: C.red50, borderColor: C.red100 },
  verdictIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  verdictIconCompliant: { backgroundColor: C.green100 },
  verdictIconWarning: { backgroundColor: C.amber100 },
  verdictIconFail: { backgroundColor: C.red100 },
  verdictIconText: { fontSize: 18, fontFamily: "Helvetica-Bold" },
  verdictTitle: { fontSize: 13, fontFamily: "Helvetica-Bold", color: C.slate900, marginBottom: 3 },
  verdictSummary: { fontSize: 8.5, color: C.slate600, lineHeight: 1.5, maxWidth: 420 },
  // ── Stats row ──
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
  },
  statBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingTop: 5,
    paddingBottom: 5,
    paddingLeft: 8,
    paddingRight: 8,
    borderRadius: 12,
    backgroundColor: C.slate100,
    borderWidth: 1,
    borderColor: C.slate200,
  },
  statText: { fontSize: 7.5, color: C.slate600 },
  // ── Score pills ──
  scoreRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 18,
  },
  scorePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingTop: 4,
    paddingBottom: 4,
    paddingLeft: 8,
    paddingRight: 8,
    borderRadius: 10,
  },
  scorePillPass: { backgroundColor: C.green100 },
  scorePillWarn: { backgroundColor: C.amber100 },
  scorePillFail: { backgroundColor: C.red100 },
  scorePillText: { fontSize: 8, fontFamily: "Helvetica-Bold" },
  scorePillPassText: { color: C.green700 },
  scorePillWarnText: { color: C.amber700 },
  scorePillFailText: { color: C.red700 },
  // ── URL info ──
  urlBox: {
    backgroundColor: C.slate50,
    borderWidth: 1,
    borderColor: C.slate200,
    borderRadius: 6,
    padding: 10,
    marginBottom: 18,
  },
  urlLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: C.slate500,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  urlValue: { fontSize: 9, color: C.brandBlue },
  urlTitle: { fontSize: 8.5, color: C.slate700, marginTop: 3 },
  // ── Category section ──
  categoryHeader: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: C.slate900,
    marginTop: 14,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: C.slate200,
  },
  // ── Finding item ──
  findingItem: {
    flexDirection: "row",
    marginBottom: 5,
    paddingTop: 7,
    paddingBottom: 7,
    paddingLeft: 10,
    paddingRight: 10,
    borderRadius: 5,
    borderLeftWidth: 3,
  },
  findingPass: { backgroundColor: C.green50, borderLeftColor: C.green600 },
  findingWarn: { backgroundColor: C.amber50, borderLeftColor: C.amber600 },
  findingFail: { backgroundColor: C.red50, borderLeftColor: C.red600 },
  findingBullet: {
    width: 14,
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginRight: 8,
    flexShrink: 0,
    textAlign: "center",
  },
  findingBulletPass: { color: C.green700 },
  findingBulletWarn: { color: C.amber700 },
  findingBulletFail: { color: C.red700 },
  findingContent: { flex: 1 },
  findingTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", color: C.slate900, marginBottom: 2 },
  findingDetail: { fontSize: 8.5, color: C.slate600, lineHeight: 1.5 },
  findingRec: { fontSize: 8, color: C.brandBlue, marginTop: 3, fontFamily: "Helvetica-Bold" },
  severityTag: {
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    paddingTop: 2,
    paddingBottom: 2,
    paddingLeft: 5,
    paddingRight: 5,
    borderRadius: 3,
    marginLeft: 6,
  },
  tagPass: { backgroundColor: C.green100, color: C.green700 },
  tagWarn: { backgroundColor: C.amber100, color: C.amber700 },
  tagFail: { backgroundColor: C.red100, color: C.red700 },
  // ── Footer ──
  footer: {
    position: "absolute",
    bottom: 16,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: C.slate200,
  },
  footerText: { fontSize: 7, color: C.slate400 },
  footerBrand: { fontSize: 7, color: C.brandBlue, fontFamily: "Helvetica-Bold" },
});

// ── Types ───────────────────────────────────────────────────────────────────

export interface ScanFinding {
  severity: "pass" | "warning" | "fail";
  category: string;
  title: string;
  detail: string;
  recommendation?: string;
}

export interface ScanReportPdfInput {
  generatedAt: Date;
  url: string;
  finalUrl: string;
  title: string;
  statusCode: number;
  ssl: boolean;
  redirectCount: number;
  loadTimeMs: number;
  cookieConsentDetected: boolean;
  imageCount: number;
  imagesWithoutAlt: number;
  platforms: string[];
  categories: string[];
  countries: string[];
  report: {
    summary: string;
    overallScore: "compliant" | "needs_attention" | "non_compliant";
    findings: ScanFinding[];
  };
}

// ── Category labels ─────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  platform_readiness: "Platform Readiness",
  legal_regulatory: "Legal & Regulatory",
  content_compliance: "Content Compliance",
  industry_specific: "Industry-Specific",
  accessibility: "Accessibility",
};

// ── Document ────────────────────────────────────────────────────────────────

function ScanReportDocument({ input }: { input: ScanReportPdfInput }) {
  const { generatedAt, report } = input;
  const logoUri = getLogoDataUri();

  const dateStr = generatedAt.toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  const passCount = report.findings.filter((f) => f.severity === "pass").length;
  const warnCount = report.findings.filter((f) => f.severity === "warning").length;
  const failCount = report.findings.filter((f) => f.severity === "fail").length;

  // Group findings by category
  const grouped: Record<string, ScanFinding[]> = {};
  for (const f of report.findings) {
    (grouped[f.category] ??= []).push(f);
  }
  // Sort each group: fail > warning > pass
  const severityOrder = { fail: 0, warning: 1, pass: 2 };
  for (const cat of Object.keys(grouped)) {
    grouped[cat].sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  }

  const verdictLabel = report.overallScore === "compliant" ? "Compliant"
    : report.overallScore === "needs_attention" ? "Needs Attention" : "Non-Compliant";
  const verdictSymbol = report.overallScore === "compliant" ? "\u2713"
    : report.overallScore === "needs_attention" ? "!" : "X";

  const verdictBoxStyle = report.overallScore === "compliant" ? s.verdictCompliant
    : report.overallScore === "needs_attention" ? s.verdictWarning : s.verdictFail;
  const verdictIconStyle = report.overallScore === "compliant" ? s.verdictIconCompliant
    : report.overallScore === "needs_attention" ? s.verdictIconWarning : s.verdictIconFail;
  const verdictIconColor = report.overallScore === "compliant" ? C.green700
    : report.overallScore === "needs_attention" ? C.amber700 : C.red700;

  return (
    <Document
      title={`Ad Compliance Pro — Site Scan: ${input.url}`}
      author="Ad Compliance Pro by AUX"
      subject={`Site Scan Report — ${dateStr}`}
    >
      <Page size="LETTER" style={s.page}>
        {/* Header */}
        <View style={s.headerBar} fixed>
          <View style={s.headerLeft}>
            <Image style={s.logo} src={logoUri} />
            <View style={s.headerBrand}>
              <Text style={s.brandName}>Ad Compliance Pro</Text>
              <Text style={s.brandSub}>by AUX</Text>
            </View>
          </View>
          <View style={s.headerRight}>
            <Text style={s.headerDate}>{dateStr}</Text>
            <Text style={s.headerType}>Site Scan Report</Text>
          </View>
        </View>
        <View style={s.accentStripe} fixed>
          <View style={s.stripeBlue} />
          <View style={s.stripePink} />
        </View>

        <View style={s.body}>
          {/* URL info */}
          <View style={s.urlBox}>
            <Text style={s.urlLabel}>Scanned URL</Text>
            <Text style={s.urlValue}>{input.url}</Text>
            {input.title && <Text style={s.urlTitle}>{input.title}</Text>}
            {input.finalUrl !== input.url && (
              <Text style={[s.urlTitle, { marginTop: 2 }]}>
                Redirected to: {input.finalUrl}
              </Text>
            )}
          </View>

          {/* Verdict */}
          <View style={[s.verdictBox, verdictBoxStyle]}>
            <View style={[s.verdictIcon, verdictIconStyle]}>
              <Text style={[s.verdictIconText, { color: verdictIconColor }]}>{verdictSymbol}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.verdictTitle}>{verdictLabel}</Text>
              <Text style={s.verdictSummary}>{report.summary}</Text>
            </View>
          </View>

          {/* Score pills */}
          <View style={s.scoreRow}>
            <View style={[s.scorePill, s.scorePillPass]}>
              <Text style={[s.scorePillText, s.scorePillPassText]}>{passCount} Passed</Text>
            </View>
            <View style={[s.scorePill, s.scorePillWarn]}>
              <Text style={[s.scorePillText, s.scorePillWarnText]}>{warnCount} Warnings</Text>
            </View>
            <View style={[s.scorePill, s.scorePillFail]}>
              <Text style={[s.scorePillText, s.scorePillFailText]}>{failCount} Failures</Text>
            </View>
          </View>

          {/* Page stats */}
          <View style={s.statsRow}>
            <View style={s.statBadge}>
              <Text style={s.statText}>{input.ssl ? "HTTPS" : "HTTP"}</Text>
            </View>
            <View style={s.statBadge}>
              <Text style={s.statText}>{input.loadTimeMs}ms load time</Text>
            </View>
            <View style={s.statBadge}>
              <Text style={s.statText}>{input.redirectCount} redirect{input.redirectCount !== 1 ? "s" : ""}</Text>
            </View>
            <View style={s.statBadge}>
              <Text style={s.statText}>Status {input.statusCode}</Text>
            </View>
            <View style={s.statBadge}>
              <Text style={s.statText}>Cookie consent: {input.cookieConsentDetected ? "Yes" : "No"}</Text>
            </View>
            <View style={s.statBadge}>
              <Text style={s.statText}>{input.imageCount} images ({input.imagesWithoutAlt} no alt)</Text>
            </View>
          </View>

          {/* Scope */}
          {(input.platforms.length > 0 || input.categories.length > 0 || input.countries.length > 0) && (
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
              {input.platforms.length > 0 && (
                <View style={{ flex: 1 }}>
                  <Text style={s.urlLabel}>Platforms</Text>
                  <Text style={{ fontSize: 8.5, color: C.slate900 }}>{input.platforms.join(", ")}</Text>
                </View>
              )}
              {input.categories.length > 0 && (
                <View style={{ flex: 1 }}>
                  <Text style={s.urlLabel}>Categories</Text>
                  <Text style={{ fontSize: 8.5, color: C.slate900 }}>{input.categories.join(", ")}</Text>
                </View>
              )}
              {input.countries.length > 0 && (
                <View style={{ flex: 1 }}>
                  <Text style={s.urlLabel}>Countries</Text>
                  <Text style={{ fontSize: 8.5, color: C.slate900 }}>{input.countries.join(", ")}</Text>
                </View>
              )}
            </View>
          )}

          {/* Findings by category */}
          {Object.entries(grouped).map(([cat, findings]) => (
            <View key={cat}>
              <Text style={s.categoryHeader}>
                {CATEGORY_LABELS[cat] ?? cat}
              </Text>
              {findings.map((finding, fi) => {
                const isPass = finding.severity === "pass";
                const isWarn = finding.severity === "warning";
                const itemStyle = isPass ? s.findingPass : isWarn ? s.findingWarn : s.findingFail;
                const bulletStyle = isPass ? s.findingBulletPass : isWarn ? s.findingBulletWarn : s.findingBulletFail;
                const bullet = isPass ? "\u2713" : isWarn ? "!" : "X";
                const tagStyle = isPass ? s.tagPass : isWarn ? s.tagWarn : s.tagFail;
                const tagLabel = isPass ? "PASS" : isWarn ? "WARNING" : "FAIL";

                return (
                  <View key={fi} style={[s.findingItem, itemStyle]} wrap={false}>
                    <Text style={[s.findingBullet, bulletStyle]}>{bullet}</Text>
                    <View style={s.findingContent}>
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <Text style={s.findingTitle}>{finding.title}</Text>
                        <Text style={[s.severityTag, tagStyle]}>{tagLabel}</Text>
                      </View>
                      <Text style={s.findingDetail}>{finding.detail}</Text>
                      {finding.recommendation && (
                        <Text style={s.findingRec}>
                          Recommendation: {finding.recommendation}
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          ))}
        </View>

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerBrand}>Ad Compliance Pro</Text>
          <Text style={s.footerText}>Confidential</Text>
          <Text
            style={s.footerText}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}

// ── Export ───────────────────────────────────────────────────────────────────

export async function generateScanReportPdf(input: ScanReportPdfInput): Promise<Buffer> {
  return renderToBuffer(<ScanReportDocument input={input} />);
}
