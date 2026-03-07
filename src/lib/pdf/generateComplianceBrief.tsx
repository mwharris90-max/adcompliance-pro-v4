import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";

// ── Palette ──────────────────────────────────────────────────────────────────

const C = {
  brand:    "#0f172a",
  slate600: "#475569",
  slate400: "#94a3b8",
  slate200: "#e2e8f0",
  slate100: "#f1f5f9",
  white:    "#ffffff",
  red700:   "#b91c1c",
  red100:   "#fee2e2",
  red200:   "#fecaca",
  amber700: "#b45309",
  amber100: "#fef3c7",
  amber200: "#fde68a",
  green700: "#15803d",
  green100: "#dcfce7",
  green200: "#bbf7d0",
  blue700:  "#1d4ed8",
  blue100:  "#dbeafe",
  blue200:  "#bfdbfe",
};

// ── Styles ───────────────────────────────────────────────────────────────────

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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
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
  divider: { height: 1, backgroundColor: C.slate200, marginBottom: 18 },
  // Scope
  scopeRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
  scopeCard: {
    flex: 1,
    backgroundColor: C.slate100,
    borderRadius: 4,
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 10,
    paddingRight: 10,
  },
  scopeLabel: {
    fontSize: 7,
    color: C.slate400,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  scopeValue: { fontSize: 8.5, color: C.brand, lineHeight: 1.5 },
  // Section
  sectionHeading: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginBottom: 10,
    marginTop: 6,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: C.slate200,
  },
  sectionDivider: { height: 1, backgroundColor: C.slate200, marginTop: 14, marginBottom: 14 },
  // Guidance items
  guidanceItem: {
    flexDirection: "row",
    marginBottom: 6,
    paddingTop: 6,
    paddingBottom: 6,
    paddingLeft: 8,
    paddingRight: 8,
    borderRadius: 4,
  },
  guidanceBullet: {
    width: 14,
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    marginRight: 6,
    flexShrink: 0,
  },
  guidanceContent: { flex: 1 },
  guidanceText: { fontSize: 8.5, color: C.brand, lineHeight: 1.5 },
  guidanceSource: { fontSize: 7, color: C.slate400, marginTop: 2 },
  // Colour variants
  mustItem:       { backgroundColor: C.red100, borderWidth: 1, borderColor: C.red200 },
  mustBullet:     { color: C.red700 },
  mustHeading:    { color: C.red700 },
  shouldItem:     { backgroundColor: C.blue100, borderWidth: 1, borderColor: C.blue200 },
  shouldBullet:   { color: C.blue700 },
  shouldHeading:  { color: C.blue700 },
  shouldNotItem:  { backgroundColor: C.amber100, borderWidth: 1, borderColor: C.amber200 },
  shouldNotBullet:{ color: C.amber700 },
  shouldNotHeading:{ color: C.amber700 },
  prohibItem:     { backgroundColor: C.red100, borderWidth: 1, borderColor: C.red200 },
  prohibBullet:   { color: C.red700 },
  prohibHeading:  { color: C.red700 },
  // Info box
  infoBox: {
    backgroundColor: C.green100,
    borderWidth: 1,
    borderColor: C.green200,
    borderRadius: 6,
    padding: 12,
    marginTop: 16,
  },
  infoTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", color: C.green700, marginBottom: 4 },
  infoText: { fontSize: 8, color: C.green700, lineHeight: 1.5 },
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

// ── Types ────────────────────────────────────────────────────────────────────

export interface BriefPdfInput {
  generatedAt: Date;
  platforms: string[];
  categories: string[];
  countries: string[];
  guidance: {
    must: { text: string; source: string }[];
    should: { text: string; source: string }[];
    shouldNot: { text: string; source: string }[];
    prohibited: { text: string; source: string }[];
  };
}

// ── Document ─────────────────────────────────────────────────────────────────

function BriefDocument({ input }: { input: BriefPdfInput }) {
  const { generatedAt, platforms, categories, countries, guidance } = input;

  const dateStr = generatedAt.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Document
      title="AdCompliance Pro — Compliance Brief"
      author="AdCompliance Pro"
      subject={`Compliance Brief — ${dateStr}`}
    >
      <Page size="LETTER" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.brandName}>AdCompliance Pro</Text>
            <Text style={s.reportTitle}>Compliance Brief</Text>
          </View>
          <View>
            <Text style={s.headerMeta}>{dateStr}</Text>
            <Text style={s.headerMeta}>Pre-Campaign Guidance</Text>
          </View>
        </View>
        <View style={s.divider} />

        {/* Scope */}
        <View style={s.scopeRow}>
          <View style={s.scopeCard}>
            <Text style={s.scopeLabel}>Platforms</Text>
            <Text style={s.scopeValue}>{platforms.join(", ")}</Text>
          </View>
          {categories.length > 0 && (
            <View style={s.scopeCard}>
              <Text style={s.scopeLabel}>Categories</Text>
              <Text style={s.scopeValue}>
                {categories.length <= 4
                  ? categories.join(", ")
                  : `${categories.slice(0, 3).join(", ")} +${categories.length - 3} more`}
              </Text>
            </View>
          )}
          <View style={s.scopeCard}>
            <Text style={s.scopeLabel}>Countries</Text>
            <Text style={s.scopeValue}>{countries.join(", ")}</Text>
          </View>
        </View>

        {/* Prohibited */}
        {guidance.prohibited.length > 0 && (
          <View>
            <Text style={[s.sectionHeading, s.prohibHeading]}>
              Prohibited — Do Not Advertise ({guidance.prohibited.length})
            </Text>
            {guidance.prohibited.map((item, i) => (
              <View key={i} style={[s.guidanceItem, s.prohibItem]} wrap={false}>
                <Text style={[s.guidanceBullet, s.prohibBullet]}>X</Text>
                <View style={s.guidanceContent}>
                  <Text style={s.guidanceText}>{item.text}</Text>
                  {item.source && <Text style={s.guidanceSource}>{item.source}</Text>}
                </View>
              </View>
            ))}
          </View>
        )}

        {guidance.prohibited.length > 0 && guidance.must.length > 0 && (
          <View style={s.sectionDivider} />
        )}

        {/* Must */}
        {guidance.must.length > 0 && (
          <View>
            <Text style={[s.sectionHeading, s.mustHeading]}>
              Must — Mandatory Requirements ({guidance.must.length})
            </Text>
            {guidance.must.map((item, i) => (
              <View key={i} style={[s.guidanceItem, s.mustItem]} wrap={false}>
                <Text style={[s.guidanceBullet, s.mustBullet]}>!</Text>
                <View style={s.guidanceContent}>
                  <Text style={s.guidanceText}>{item.text}</Text>
                  {item.source && <Text style={s.guidanceSource}>{item.source}</Text>}
                </View>
              </View>
            ))}
          </View>
        )}

        {guidance.must.length > 0 && guidance.should.length > 0 && (
          <View style={s.sectionDivider} />
        )}

        {/* Should */}
        {guidance.should.length > 0 && (
          <View>
            <Text style={[s.sectionHeading, s.shouldHeading]}>
              Should — Recommended Best Practice ({guidance.should.length})
            </Text>
            {guidance.should.map((item, i) => (
              <View key={i} style={[s.guidanceItem, s.shouldItem]} wrap={false}>
                <Text style={[s.guidanceBullet, s.shouldBullet]}>+</Text>
                <View style={s.guidanceContent}>
                  <Text style={s.guidanceText}>{item.text}</Text>
                  {item.source && <Text style={s.guidanceSource}>{item.source}</Text>}
                </View>
              </View>
            ))}
          </View>
        )}

        {guidance.should.length > 0 && guidance.shouldNot.length > 0 && (
          <View style={s.sectionDivider} />
        )}

        {/* Should Not */}
        {guidance.shouldNot.length > 0 && (
          <View>
            <Text style={[s.sectionHeading, s.shouldNotHeading]}>
              Should Not — Avoid ({guidance.shouldNot.length})
            </Text>
            {guidance.shouldNot.map((item, i) => (
              <View key={i} style={[s.guidanceItem, s.shouldNotItem]} wrap={false}>
                <Text style={[s.guidanceBullet, s.shouldNotBullet]}>-</Text>
                <View style={s.guidanceContent}>
                  <Text style={s.guidanceText}>{item.text}</Text>
                  {item.source && <Text style={s.guidanceSource}>{item.source}</Text>}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Info box */}
        <View style={s.infoBox}>
          <Text style={s.infoTitle}>Further Reading</Text>
          <Text style={s.infoText}>
            Visit the Policy Library in AdCompliance Pro for detailed articles,
            guides, and training materials on each of the regulations and
            platform policies referenced in this brief.
          </Text>
        </View>

        {/* Footer */}
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

// ── Export ────────────────────────────────────────────────────────────────────

export async function generateComplianceBriefPdf(input: BriefPdfInput): Promise<Buffer> {
  return renderToBuffer(<BriefDocument input={input} />);
}
