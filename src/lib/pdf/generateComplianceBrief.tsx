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
  // Neutrals
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
  // Semantic
  red700:     "#b91c1c",
  red600:     "#dc2626",
  red100:     "#fee2e2",
  red50:      "#fef2f2",
  amber700:   "#b45309",
  amber600:   "#d97706",
  amber100:   "#fef3c7",
  amber50:    "#fffbeb",
  green700:   "#15803d",
  green100:   "#dcfce7",
  green50:    "#f0fdf4",
  blue700:    "#1d4ed8",
  blue100:    "#dbeafe",
  blue50:     "#eff6ff",
  purple700:  "#7c3aed",
  purple100:  "#ede9fe",
  purple50:   "#f5f3ff",
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
  // ── Header ──
  headerBar: {
    backgroundColor: C.brandDark,
    paddingTop: 24,
    paddingBottom: 24,
    paddingLeft: 40,
    paddingRight: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 0,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  logo: {
    width: 48,
    height: 28,
  },
  headerBrand: {
    flexDirection: "column",
  },
  brandName: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: C.white,
    letterSpacing: 0.3,
  },
  brandSub: {
    fontSize: 8,
    color: C.slate400,
    marginTop: 1,
  },
  headerRight: {
    alignItems: "flex-end",
  },
  headerDate: {
    fontSize: 8,
    color: C.slate300,
  },
  headerType: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: C.brandBlue,
    marginTop: 2,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  // ── Accent stripe ──
  accentStripe: {
    height: 3,
    flexDirection: "row",
  },
  stripeBlue: {
    flex: 1,
    backgroundColor: C.brandBlue,
  },
  stripePink: {
    flex: 1,
    backgroundColor: C.brandPink,
  },
  // ── Body ──
  body: {
    paddingLeft: 40,
    paddingRight: 40,
    paddingTop: 20,
  },
  // ── Scope ──
  scopeRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  scopeCard: {
    flex: 1,
    backgroundColor: C.slate50,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.slate200,
    paddingTop: 10,
    paddingBottom: 10,
    paddingLeft: 12,
    paddingRight: 12,
  },
  scopeLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: C.slate500,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  scopeValue: {
    fontSize: 8.5,
    color: C.slate900,
    lineHeight: 1.5,
  },
  // ── Section ──
  sectionHeading: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginBottom: 8,
    marginTop: 8,
    paddingBottom: 5,
    paddingTop: 5,
    paddingLeft: 8,
    borderRadius: 4,
    flexDirection: "row",
    alignItems: "center",
  },
  sectionCount: {
    fontSize: 8,
    fontFamily: "Helvetica",
    marginLeft: 6,
    paddingTop: 1,
    paddingBottom: 1,
    paddingLeft: 6,
    paddingRight: 6,
    borderRadius: 8,
    backgroundColor: C.white,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: C.slate200,
    marginTop: 16,
    marginBottom: 16,
  },
  // ── Guidance items ──
  guidanceItem: {
    flexDirection: "row",
    marginBottom: 5,
    paddingTop: 7,
    paddingBottom: 7,
    paddingLeft: 10,
    paddingRight: 10,
    borderRadius: 5,
    borderLeftWidth: 3,
  },
  guidanceBullet: {
    width: 14,
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginRight: 8,
    flexShrink: 0,
    textAlign: "center",
  },
  guidanceContent: { flex: 1 },
  guidanceText: { fontSize: 8.5, color: C.slate900, lineHeight: 1.5 },
  guidanceSource: { fontSize: 7, color: C.slate500, marginTop: 2 },
  // ── Colour variants ──
  prohibItem:       { backgroundColor: C.red50, borderLeftColor: C.red600 },
  prohibBullet:     { color: C.red700 },
  prohibHeading:    { backgroundColor: C.red100, color: C.red700 },
  mustItem:         { backgroundColor: C.red50, borderLeftColor: C.red700 },
  mustBullet:       { color: C.red700 },
  mustHeading:      { backgroundColor: C.red100, color: C.red700 },
  shouldItem:       { backgroundColor: C.blue50, borderLeftColor: C.brandBlue },
  shouldBullet:     { color: C.brandBlue },
  shouldHeading:    { backgroundColor: C.blue100, color: C.blue700 },
  shouldNotItem:    { backgroundColor: C.amber50, borderLeftColor: C.amber600 },
  shouldNotBullet:  { color: C.amber700 },
  shouldNotHeading: { backgroundColor: C.amber100, color: C.amber700 },
  // ── Legislation ──
  legislationSection: {
    marginTop: 4,
    marginBottom: 4,
  },
  legislationHeading: {
    backgroundColor: C.purple100,
    color: C.purple700,
  },
  legislationItem: {
    flexDirection: "row",
    marginBottom: 5,
    paddingTop: 7,
    paddingBottom: 7,
    paddingLeft: 10,
    paddingRight: 10,
    borderRadius: 5,
    backgroundColor: C.purple50,
    borderLeftWidth: 3,
    borderLeftColor: C.purple700,
  },
  legislationName: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: C.slate900,
    marginBottom: 2,
  },
  legislationJurisdiction: {
    fontSize: 7,
    color: C.purple700,
    marginBottom: 3,
  },
  legislationSummary: {
    fontSize: 8.5,
    color: C.slate700,
    lineHeight: 1.5,
  },
  // ── Practical Requirements ──
  practicalHeading: {
    backgroundColor: C.green100,
    color: C.green700,
  },
  practicalItem: {
    flexDirection: "row",
    marginBottom: 5,
    paddingTop: 7,
    paddingBottom: 7,
    paddingLeft: 10,
    paddingRight: 10,
    borderRadius: 5,
    backgroundColor: C.green50,
    borderLeftWidth: 3,
    borderLeftColor: C.green700,
  },
  practicalBullet: {
    color: C.green700,
  },
  practicalSource: {
    fontSize: 7,
    color: C.green700,
    marginTop: 2,
  },
  // ── Category section ──
  categorySectionHeader: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: C.brandDark,
    marginTop: 18,
    marginBottom: 10,
    paddingBottom: 6,
    paddingTop: 6,
    paddingLeft: 10,
    borderLeftWidth: 4,
    borderLeftColor: C.brandBlue,
    backgroundColor: C.slate50,
    borderRadius: 4,
  },
  universalHeader: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: C.brandDark,
    marginBottom: 10,
    paddingBottom: 6,
    paddingTop: 6,
    paddingLeft: 10,
    borderLeftWidth: 4,
    borderLeftColor: C.slate400,
    backgroundColor: C.slate50,
    borderRadius: 4,
  },
  categoryLabel: {
    fontSize: 7,
    color: C.slate500,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: -2,
  },
  // ── Info box ──
  infoBox: {
    backgroundColor: C.slate50,
    borderWidth: 1,
    borderColor: C.slate200,
    borderRadius: 6,
    padding: 14,
    marginTop: 18,
    flexDirection: "row",
    gap: 10,
  },
  infoAccent: {
    width: 3,
    backgroundColor: C.brandBlue,
    borderRadius: 2,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: C.brandBlue,
    marginBottom: 4,
  },
  infoText: {
    fontSize: 8,
    color: C.slate600,
    lineHeight: 1.5,
  },
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

export interface LegislationItem {
  name: string;
  summary: string;
  jurisdiction: string;
}

export interface PracticalRequirement {
  requirement: string;
  source: string;
}

export interface GuidanceSection {
  prohibited: { text: string; source: string }[];
  must: { text: string; source: string }[];
  should: { text: string; source: string }[];
  shouldNot: { text: string; source: string }[];
  legislationSummary?: LegislationItem[];
  practicalRequirements?: PracticalRequirement[];
}

export interface CategoryGuidance {
  category: string;
  prohibited?: { text: string; source: string }[];
  must?: { text: string; source: string }[];
  should?: { text: string; source: string }[];
  shouldNot?: { text: string; source: string }[];
  legislationSummary?: LegislationItem[];
  practicalRequirements?: PracticalRequirement[];
}

export interface BriefPdfInput {
  generatedAt: Date;
  platforms: string[];
  categories: string[];
  countries: string[];
  guidance: {
    universal: GuidanceSection;
    categorySpecific: CategoryGuidance[];
  };
}

// ── Reusable guidance section block ──────────────────────────────────────────

function GuidanceSectionBlock({ section, showLegislation = true, showPractical = true }: { section: GuidanceSection; showLegislation?: boolean; showPractical?: boolean }) {
  const legislation = section.legislationSummary ?? [];
  const practical = section.practicalRequirements ?? [];
  const hasContent = section.prohibited.length > 0 || section.must.length > 0 || section.should.length > 0 || section.shouldNot.length > 0 || (showLegislation && legislation.length > 0) || (showPractical && practical.length > 0);

  if (!hasContent) return null;

  return (
    <View>
      {/* Legislation */}
      {showLegislation && legislation.length > 0 && (
        <View>
          <View style={[s.sectionHeading, s.legislationHeading]}>
            <Text>Key Legislation</Text>
            <Text style={[s.sectionCount, { color: C.purple700 }]}>{legislation.length}</Text>
          </View>
          {legislation.map((item, i) => (
            <View key={i} style={s.legislationItem} wrap={false}>
              <View style={{ flex: 1 }}>
                <Text style={s.legislationName}>{item.name}</Text>
                <Text style={s.legislationJurisdiction}>{item.jurisdiction}</Text>
                <Text style={s.legislationSummary}>{item.summary}</Text>
              </View>
            </View>
          ))}
          <View style={s.sectionDivider} />
        </View>
      )}

      {/* Prohibited */}
      {section.prohibited.length > 0 && (
        <View>
          <View style={[s.sectionHeading, s.prohibHeading]}>
            <Text>Prohibited — Do Not Advertise</Text>
            <Text style={[s.sectionCount, { color: C.red700 }]}>{section.prohibited.length}</Text>
          </View>
          {section.prohibited.map((item, i) => (
            <View key={i} style={[s.guidanceItem, s.prohibItem]} wrap={false}>
              <Text style={[s.guidanceBullet, s.prohibBullet]}>X</Text>
              <View style={s.guidanceContent}>
                <Text style={s.guidanceText}>{item.text}</Text>
                {item.source && <Text style={s.guidanceSource}>{item.source}</Text>}
              </View>
            </View>
          ))}
          <View style={s.sectionDivider} />
        </View>
      )}

      {/* Must */}
      {section.must.length > 0 && (
        <View>
          <View style={[s.sectionHeading, s.mustHeading]}>
            <Text>Must — Mandatory Requirements</Text>
            <Text style={[s.sectionCount, { color: C.red700 }]}>{section.must.length}</Text>
          </View>
          {section.must.map((item, i) => (
            <View key={i} style={[s.guidanceItem, s.mustItem]} wrap={false}>
              <Text style={[s.guidanceBullet, s.mustBullet]}>!</Text>
              <View style={s.guidanceContent}>
                <Text style={s.guidanceText}>{item.text}</Text>
                {item.source && <Text style={s.guidanceSource}>{item.source}</Text>}
              </View>
            </View>
          ))}
          <View style={s.sectionDivider} />
        </View>
      )}

      {/* Should */}
      {section.should.length > 0 && (
        <View>
          <View style={[s.sectionHeading, s.shouldHeading]}>
            <Text>Should — Recommended Best Practice</Text>
            <Text style={[s.sectionCount, { color: C.blue700 }]}>{section.should.length}</Text>
          </View>
          {section.should.map((item, i) => (
            <View key={i} style={[s.guidanceItem, s.shouldItem]} wrap={false}>
              <Text style={[s.guidanceBullet, s.shouldBullet]}>+</Text>
              <View style={s.guidanceContent}>
                <Text style={s.guidanceText}>{item.text}</Text>
                {item.source && <Text style={s.guidanceSource}>{item.source}</Text>}
              </View>
            </View>
          ))}
          <View style={s.sectionDivider} />
        </View>
      )}

      {/* Should Not */}
      {section.shouldNot.length > 0 && (
        <View>
          <View style={[s.sectionHeading, s.shouldNotHeading]}>
            <Text>Should Not — Avoid</Text>
            <Text style={[s.sectionCount, { color: C.amber700 }]}>{section.shouldNot.length}</Text>
          </View>
          {section.shouldNot.map((item, i) => (
            <View key={i} style={[s.guidanceItem, s.shouldNotItem]} wrap={false}>
              <Text style={[s.guidanceBullet, s.shouldNotBullet]}>-</Text>
              <View style={s.guidanceContent}>
                <Text style={s.guidanceText}>{item.text}</Text>
                {item.source && <Text style={s.guidanceSource}>{item.source}</Text>}
              </View>
            </View>
          ))}
          <View style={s.sectionDivider} />
        </View>
      )}

      {/* Practical Requirements */}
      {showPractical && practical.length > 0 && (
        <View>
          <View style={[s.sectionHeading, s.practicalHeading]}>
            <Text>Practical Requirements — Action Items</Text>
            <Text style={[s.sectionCount, { color: C.green700 }]}>{practical.length}</Text>
          </View>
          {practical.map((item, i) => (
            <View key={i} style={s.practicalItem} wrap={false}>
              <Text style={[s.guidanceBullet, s.practicalBullet]}>&#x2713;</Text>
              <View style={s.guidanceContent}>
                <Text style={s.guidanceText}>{item.requirement}</Text>
                {item.source && <Text style={s.practicalSource}>{item.source}</Text>}
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ── Document ────────────────────────────────────────────────────────────────

function BriefDocument({ input }: { input: BriefPdfInput }) {
  const { generatedAt, platforms, categories, countries, guidance } = input;

  const dateStr = generatedAt.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const logoUri = getLogoDataUri();

  return (
    <Document
      title="Ad Compliance Pro — Compliance Brief"
      author="Ad Compliance Pro by AUX"
      subject={`Compliance Brief — ${dateStr}`}
    >
      <Page size="LETTER" style={s.page}>
        {/* ── Branded Header ── */}
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
            <Text style={s.headerType}>Compliance Brief</Text>
          </View>
        </View>

        {/* ── Gradient accent stripe ── */}
        <View style={s.accentStripe} fixed>
          <View style={s.stripeBlue} />
          <View style={s.stripePink} />
        </View>

        {/* ── Body content ── */}
        <View style={s.body}>
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

          {/* ── Universal Requirements ── */}
          <View>
            <Text style={s.universalHeader}>
              Universal Requirements — All Categories
            </Text>
            <GuidanceSectionBlock section={guidance.universal} />
          </View>

          {/* ── Category-Specific Sections ── */}
          {guidance.categorySpecific.map((catSection, ci) => (
            <View key={ci}>
              <Text style={s.categorySectionHeader}>
                {catSection.category}
              </Text>
              <Text style={s.categoryLabel}>Category-specific requirements</Text>
              <GuidanceSectionBlock
                section={{
                  prohibited: catSection.prohibited ?? [],
                  must: catSection.must ?? [],
                  should: catSection.should ?? [],
                  shouldNot: catSection.shouldNot ?? [],
                  legislationSummary: catSection.legislationSummary,
                  practicalRequirements: catSection.practicalRequirements,
                }}
              />
            </View>
          ))}

          {/* ── Info box ── */}
          <View style={s.infoBox}>
            <View style={s.infoAccent} />
            <View style={s.infoContent}>
              <Text style={s.infoTitle}>Further Reading</Text>
              <Text style={s.infoText}>
                Visit the Policy Library in Ad Compliance Pro for detailed articles,
                guides, and training materials on each of the regulations and
                platform policies referenced in this brief.
              </Text>
            </View>
          </View>
        </View>

        {/* ── Footer ── */}
        <View style={s.footer} fixed>
          <Text style={s.footerBrand}>Ad Compliance Pro</Text>
          <Text style={s.footerText}>Confidential</Text>
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

// ── Export ───────────────────────────────────────────────────────────────────

export async function generateComplianceBriefPdf(input: BriefPdfInput): Promise<Buffer> {
  return renderToBuffer(<BriefDocument input={input} />);
}
