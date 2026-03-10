/**
 * Splits the generic "Insurance Products" category into specific insurance
 * sub-categories and fully populates Pet Insurance, Life Insurance, and
 * Travel Insurance with:
 *   - Platform rules (Instagram, Facebook, Google Ads)
 *   - Geo rules (GB, US, CA, AU, DE + EU general)
 *   - Legislation records
 *   - Platform policy records
 *   - ComplianceRule records (general + platform-specific)
 *
 * Run: npx tsx prisma/add-insurance-categories.ts
 */

import { PrismaClient, RuleStatus, CategoryMaturity } from "@prisma/client";
import { config } from "dotenv";

config({ path: ".env.local" });

const db = new PrismaClient();

// ─────────────────────────────────────────────
// 1. INSURANCE SUB-CATEGORIES
// ─────────────────────────────────────────────

const INSURANCE_SUBCATEGORIES = [
  { name: "Pet Insurance",      slug: "insurance-pet",      description: "Pet health and accident insurance for cats, dogs and other animals", sortOrder: 260 },
  { name: "Life Insurance",     slug: "insurance-life",     description: "Term life, whole life, endowment and death-in-service insurance products", sortOrder: 261 },
  { name: "Travel Insurance",   slug: "insurance-travel",   description: "Holiday, trip cancellation, medical travel and baggage insurance", sortOrder: 262 },
  { name: "Home Insurance",     slug: "insurance-home",     description: "Buildings, contents, landlord and tenant insurance products", sortOrder: 263 },
  { name: "Auto Insurance",     slug: "insurance-auto",     description: "Motor vehicle, fleet, breakdown and roadside assistance insurance", sortOrder: 264 },
  { name: "Health Insurance",   slug: "insurance-health",   description: "Private medical insurance, dental plans and critical illness cover", sortOrder: 265 },
  { name: "Business Insurance", slug: "insurance-business", description: "Professional indemnity, public liability, D&O and commercial insurance", sortOrder: 266 },
  { name: "Cyber Insurance",    slug: "insurance-cyber",    description: "Data breach, cyber liability and technology errors & omissions insurance", sortOrder: 267 },
];

// Only these three will get full rule population in this script
const POPULATED_SLUGS = ["insurance-pet", "insurance-life", "insurance-travel"];

const PLATFORM_SLUGS = ["instagram", "facebook", "google-ads"];

// ─────────────────────────────────────────────
// 2. PLATFORM RULES per sub-category
// ─────────────────────────────────────────────
// Format: [platformSlug, categorySlug, status, notes, referenceUrl]

type PlatformRuleSeed = [string, string, RuleStatus, string, string?];

const PLATFORM_RULES: PlatformRuleSeed[] = [
  // ── PET INSURANCE ─────────────────────────────
  ["instagram", "insurance-pet", "RESTRICTED",
    "Pet insurance falls under Meta's Special Ad Category for Financial Products and Services. Age targeting disabled, location targeting limited to 15-mile minimum radius, detailed targeting significantly reduced. 18+ age minimum required. Must not directly request personally identifiable information.",
    "https://transparency.meta.com/policies/ad-standards/restricted-goods-services/financial-services/"],
  ["facebook", "insurance-pet", "RESTRICTED",
    "Pet insurance falls under Meta's Special Ad Category for Financial Products and Services. Same restrictions as Instagram — age targeting disabled, 15-mile geo minimum, reduced detailed targeting. Business Manager validation required.",
    "https://transparency.meta.com/policies/ad-standards/restricted-goods-services/financial-services/"],
  ["google-ads", "insurance-pet", "RESTRICTED",
    "Pet insurance is subject to Google's Financial Products and Services policy. Must provide physical business address and list all fees/charges. In UK requires FCA Financial Services Verification. In Australia requires G2RS verification demonstrating ASIC licensing. Not subject to US health insurance certification.",
    "https://support.google.com/adspolicy/answer/2464998"],

  // ── LIFE INSURANCE ────────────────────────────
  ["instagram", "insurance-life", "RESTRICTED",
    "Life insurance falls under Meta's Special Ad Category for Financial Products and Services. Age targeting is disabled — major impact as life insurance typically targets specific age demographics. Location targeting limited to 15-mile minimum radius. 18+ age minimum.",
    "https://transparency.meta.com/policies/ad-standards/restricted-goods-services/financial-services/"],
  ["facebook", "insurance-life", "RESTRICTED",
    "Life insurance falls under Meta's Special Ad Category for Financial Products and Services. Age targeting disabled (major impact for senior-targeted products like over-50s life insurance). 15-mile geo minimum. Business Manager validation required.",
    "https://transparency.meta.com/policies/ad-standards/restricted-goods-services/financial-services/"],
  ["google-ads", "insurance-life", "RESTRICTED",
    "Life insurance is subject to Google's Financial Products and Services policy. Must provide physical business address and list all fees/charges. In UK requires FCA Financial Services Verification. In Australia requires G2RS verification demonstrating ASIC licensing. In US/Canada cannot target by gender, age, parental status, marital status, or ZIP code.",
    "https://support.google.com/adspolicy/answer/2464998"],

  // ── TRAVEL INSURANCE ──────────────────────────
  ["instagram", "insurance-travel", "RESTRICTED",
    "Travel insurance falls under Meta's Special Ad Category for Financial Products and Services. Age targeting disabled, location targeting limited to 15-mile minimum radius (limits geo-targeting for departure-point marketing). 18+ age minimum.",
    "https://transparency.meta.com/policies/ad-standards/restricted-goods-services/financial-services/"],
  ["facebook", "insurance-travel", "RESTRICTED",
    "Travel insurance falls under Meta's Special Ad Category for Financial Products and Services. Same restrictions as Instagram — cannot narrow-geo-target for airport or departure-city campaigns. Business Manager validation required.",
    "https://transparency.meta.com/policies/ad-standards/restricted-goods-services/financial-services/"],
  ["google-ads", "insurance-travel", "RESTRICTED",
    "Travel insurance is subject to Google's Financial Products and Services policy. Explicitly exempt from US health insurance advertiser certification. In UK requires FCA Financial Services Verification. In Australia requires G2RS verification demonstrating ASIC licensing. Must list all fees/charges and provide physical business address.",
    "https://support.google.com/adspolicy/answer/2464998"],
];

// ─────────────────────────────────────────────
// 3. GEO RULES per sub-category per country
// ─────────────────────────────────────────────
// Format: [countryCode, categorySlug, platformSlug|null, status, conditions, notes, legislationUrl]

type GeoRuleSeed = [string, string, string | null, RuleStatus, object | null, string, string?];

const GEO_RULES: GeoRuleSeed[] = [
  // ── UK — PET INSURANCE ────────────────────────
  ["GB", "insurance-pet", null, "RESTRICTED", {
    mandatoryDisclaimer: "FCA authorisation number must be displayed.",
    regulatoryRequirements: ["FCA_AUTHORISATION", "CLEAR_FAIR_NOT_MISLEADING", "IPID_REQUIRED"],
    audienceRestrictions: ["no_misleading_claims"],
  }, "Pet insurance is a general insurance product regulated by the FCA under FSMA 2000. Must be promoted by or with approval of an FCA-authorised person. Insurance Product Information Document (IPID) must be provided under ICOBS/IDD. Communications must be clear, fair and not misleading. FCA firm reference number must be displayed.",
    "https://www.fca.org.uk/firms/financial-promotions-adverts"],

  // ── UK — LIFE INSURANCE ───────────────────────
  ["GB", "insurance-life", null, "RESTRICTED", {
    mandatoryDisclaimer: "FCA authorisation number must be displayed. Capital at risk warning where applicable.",
    regulatoryRequirements: ["FCA_AUTHORISATION", "CLEAR_FAIR_NOT_MISLEADING", "RISK_WARNING_REQUIRED"],
    audienceRestrictions: ["no_misleading_claims", "no_guaranteed_returns_claims"],
  }, "Life insurance is a long-term insurance product regulated by the FCA under FSMA 2000. Must be promoted by an FCA-authorised person. COBS rules apply (not ICOBS). Risk warnings required where returns are not guaranteed. Must not imply guaranteed investment performance. FCA firm reference number required.",
    "https://www.fca.org.uk/firms/financial-promotions-adverts"],

  // ── UK — TRAVEL INSURANCE ─────────────────────
  ["GB", "insurance-travel", null, "RESTRICTED", {
    mandatoryDisclaimer: "FCA authorisation number must be displayed.",
    regulatoryRequirements: ["FCA_AUTHORISATION", "CLEAR_FAIR_NOT_MISLEADING", "IPID_REQUIRED", "PRE_EXISTING_CONDITIONS_DISCLOSURE"],
    audienceRestrictions: ["no_misleading_claims"],
  }, "Travel insurance is a general insurance product regulated by the FCA under FSMA 2000 and ICOBS. IPID required. Must disclose pre-existing medical condition limitations prominently. FCA reviewing travel insurance signposting requirements (2025-2026). Must be clear about policy exclusions and excess amounts.",
    "https://www.fca.org.uk/firms/financial-promotions-adverts"],

  // ── US — PET INSURANCE ────────────────────────
  ["US", "insurance-pet", null, "RESTRICTED", {
    regulatoryRequirements: ["STATE_LICENSING", "PRE_EXISTING_CONDITIONS_DISCLOSURE", "NAIC_MODEL_LAW"],
    stateSpecific: { CA: "California Insurance Code 12880-12880.4 requires specific disclosures for pet insurance including reimbursement benefits and pre-existing condition limitations." },
    audienceRestrictions: ["truthful_not_misleading"],
  }, "Pet insurance regulated at state level under NAIC Unfair Trade Practices Act (Model Law 880). California has the only dedicated state pet insurance statute (Insurance Code 12880). NAIC pet insurance model law adopted by 14+ states as of 2025. Must disclose pre-existing condition limitations. Ads must be truthful and not misleading in fact or by implication.",
    "https://content.naic.org/insurance-topics/pet-insurance"],

  // ── US — LIFE INSURANCE ───────────────────────
  ["US", "insurance-life", null, "RESTRICTED", {
    regulatoryRequirements: ["STATE_LICENSING", "NAIC_MDL_570", "PRODUCT_TYPE_DISCLOSURE", "ANNUAL_COMPLIANCE_CERTIFICATION"],
    mandatoryDisclaimer: "Must prominently describe the type of insurance policy being advertised.",
    audienceRestrictions: ["truthful_not_misleading", "no_free_language_unless_genuine"],
  }, "Life insurance advertising governed by NAIC MDL-570 (Advertisements of Life Insurance and Annuities). Must prominently describe policy type. 'Free' or 'no cost' language prohibited unless genuinely true with payor disclosed. All limitations, exceptions and restrictions must be set out conspicuously. Annual signed certification of compliance required with state filing. State commissioner can impose fines up to $250,000.",
    "https://content.naic.org/sites/default/files/model-law-570.pdf"],

  // ── US — TRAVEL INSURANCE ─────────────────────
  ["US", "insurance-travel", null, "RESTRICTED", {
    regulatoryRequirements: ["STATE_LICENSING", "NAIC_MODEL_LAW", "EXCLUSION_DISCLOSURE"],
    audienceRestrictions: ["truthful_not_misleading"],
  }, "Travel insurance regulated at state level. Not subject to Google's US health insurance advertiser certification (explicitly exempt). Must disclose all limitations and exclusions. State licensing required. NAIC general advertising model regulation (MDL-040) applies. Record retention: 3-5 years typical.",
    "https://content.naic.org/sites/default/files/model-law-040.pdf"],

  // ── CANADA — PET INSURANCE ────────────────────
  ["CA", "insurance-pet", null, "RESTRICTED", {
    regulatoryRequirements: ["PROVINCIAL_LICENSING", "CLHIA_GUIDELINES"],
    audienceRestrictions: ["clear_communication"],
  }, "Pet insurance regulated by provincial insurance acts. CLHIA Guideline G9 (Direct Marketing) applies — insurer's full corporate name and address must be clearly indicated. Consumers must be advised of limitations and exclusions prior to purchase. No federal-level pet insurance-specific law.",
    "https://www.clhia.ca/"],

  // ── CANADA — LIFE INSURANCE ───────────────────
  ["CA", "insurance-life", null, "RESTRICTED", {
    regulatoryRequirements: ["PROVINCIAL_LICENSING", "CLHIA_G6_ILLUSTRATIONS", "CLHIA_G9_DIRECT_MARKETING"],
    audienceRestrictions: ["clear_communication", "no_misleading_illustrations"],
  }, "Life insurance regulated by provincial insurance acts and federal Insurance Companies Act. CLHIA Guidelines G6 (Illustrations) and G9 (Direct Marketing) apply. Provincial licensing required. Must clearly communicate product terms and limitations.",
    "https://laws-lois.justice.gc.ca/eng/acts/i-11.8/FullText.html"],

  // ── CANADA — TRAVEL INSURANCE ─────────────────
  ["CA", "insurance-travel", null, "RESTRICTED", {
    regulatoryRequirements: ["PROVINCIAL_LICENSING", "CLHIA_G5_TRAVEL", "PRE_EXISTING_CONDITIONS_DISCLOSURE"],
    mandatoryDisclaimer: "Consumers must be advised of pre-existing medical condition limitations prior to purchase.",
    audienceRestrictions: ["clear_communication"],
  }, "Travel insurance specifically governed by CLHIA Guideline G5 (Travel Insurance). All advertising must advise consumers of limitations, exclusions, and pre-existing medical condition limitations prior to purchase. Assistance centre requirements apply. Provincial licensing required.",
    "https://www.clhia.ca/web/CLHIA_LP4W_LND_Webstation.nsf/page/60EE0E7A699C06EE8525784F0058C901/$file/G5.pdf"],

  // ── AUSTRALIA — PET INSURANCE ─────────────────
  ["AU", "insurance-pet", null, "RESTRICTED", {
    regulatoryRequirements: ["AFSL_REQUIRED", "ASIC_RG234", "NOT_MISLEADING_OR_DECEPTIVE"],
    audienceRestrictions: ["sufficient_prominence_disclaimers"],
  }, "Pet insurance is a general insurance product requiring Australian Financial Services Licence (AFSL). ASIC RG 234 applies — warnings, disclaimers and qualifications must have sufficient prominence on first viewing. Consumers should not need to visit another website to read disclaimers. Google Ads requires G2RS financial services verification demonstrating ASIC licensing.",
    "https://www.asic.gov.au/regulatory-resources/find-a-document/regulatory-guides/rg-234-advertising-financial-products-and-services-including-credit-good-practice-guidance/"],

  // ── AUSTRALIA — LIFE INSURANCE ────────────────
  ["AU", "insurance-life", null, "RESTRICTED", {
    regulatoryRequirements: ["AFSL_REQUIRED", "ASIC_RG234", "NOT_MISLEADING_OR_DECEPTIVE", "CORPORATIONS_ACT_CH7"],
    audienceRestrictions: ["sufficient_prominence_disclaimers", "no_misleading_comparisons"],
  }, "Life insurance requires AFSL under Corporations Act 2001 Chapter 7. ASIC RG 234 applies — price comparison ads must compare products with sufficiently similar features and clearly identify differences. Insurance Contracts Act 1984 governs policy terms; advertising must be consistent with actual terms. Google Ads requires G2RS verification.",
    "https://download.asic.gov.au/media/rkzj5nxb/rg234-published-15-november-2012-20211008.pdf"],

  // ── AUSTRALIA — TRAVEL INSURANCE ──────────────
  ["AU", "insurance-travel", null, "RESTRICTED", {
    regulatoryRequirements: ["AFSL_REQUIRED", "ASIC_RG234", "NOT_MISLEADING_OR_DECEPTIVE"],
    audienceRestrictions: ["sufficient_prominence_disclaimers"],
  }, "Travel insurance is a general insurance product requiring AFSL. ASIC RG 234 applies. Must clearly disclose exclusions, excess amounts and pre-existing condition limitations. Google Ads requires G2RS financial services verification.",
    "https://www.asic.gov.au/regulatory-resources/find-a-document/regulatory-guides/rg-234-advertising-financial-products-and-services-including-credit-good-practice-guidance/"],

  // ── GERMANY / EU — PET INSURANCE ──────────────
  ["DE", "insurance-pet", null, "RESTRICTED", {
    regulatoryRequirements: ["IDD_COMPLIANCE", "IPID_REQUIRED", "FAIR_CLEAR_NOT_MISLEADING"],
    audienceRestrictions: ["marketing_clearly_identifiable"],
  }, "Pet insurance governed by EU Insurance Distribution Directive (IDD 2016/97) as transposed into German law. Marketing must be fair, clear and not misleading. Must be clearly identifiable as marketing. Insurance Product Information Document (IPID) required for non-life products. Cross-selling transparency: consumers must be able to buy main product (e.g. pet) without insurance.",
    "https://eur-lex.europa.eu/eli/dir/2016/97/oj"],

  // ── GERMANY / EU — LIFE INSURANCE ─────────────
  ["DE", "insurance-life", null, "RESTRICTED", {
    regulatoryRequirements: ["IDD_COMPLIANCE", "FAIR_CLEAR_NOT_MISLEADING", "GDPR_HEALTH_DATA_CONSENT"],
    audienceRestrictions: ["marketing_clearly_identifiable", "no_misleading_practices"],
  }, "Life insurance governed by IDD 2016/97 as transposed into German law. Marketing must be fair, clear and not misleading. GDPR applies — health data used in life insurance underwriting is 'special category' requiring explicit consent. Unfair Commercial Practices Directive prohibits misleading omissions of material information.",
    "https://eur-lex.europa.eu/eli/dir/2016/97/oj"],

  // ── GERMANY / EU — TRAVEL INSURANCE ───────────
  ["DE", "insurance-travel", null, "RESTRICTED", {
    regulatoryRequirements: ["IDD_COMPLIANCE", "IPID_REQUIRED", "FAIR_CLEAR_NOT_MISLEADING", "CROSS_SELLING_TRANSPARENCY"],
    audienceRestrictions: ["marketing_clearly_identifiable"],
  }, "Travel insurance governed by IDD 2016/97 as transposed into German law. IPID required for non-life products. Cross-selling transparency particularly relevant — travel insurance often sold alongside flights/holidays; consumers must be able to buy the main product without insurance. Marketing must be fair, clear and not misleading.",
    "https://eur-lex.europa.eu/eli/dir/2016/97/oj"],
];

// ─────────────────────────────────────────────
// 4. LEGISLATION RECORDS
// ─────────────────────────────────────────────

interface LegislationSeed {
  title: string;
  slug: string;
  type: "STATUTE" | "REGULATION" | "DIRECTIVE" | "INDUSTRY_CODE" | "GUIDANCE";
  countryCode: string | null;
  region?: string;
  sourceUrl: string;
  summary: string;
  tags: string[];
}

const LEGISLATION: LegislationSeed[] = [
  // UK
  {
    title: "Financial Services and Markets Act 2000 (FSMA)",
    slug: "uk-fsma-2000",
    type: "STATUTE",
    countryCode: "GB",
    sourceUrl: "https://www.legislation.gov.uk/ukpga/2000/8/contents",
    summary: "Primary UK legislation governing financial services. Section 21 requires all insurance advertising (financial promotions) to be issued or approved by an FCA-authorised person. Unauthorised financial promotions are a criminal offence. Establishes the 'clear, fair and not misleading' standard.",
    tags: ["insurance", "financial-services", "fca", "financial-promotion"],
  },
  {
    title: "Insurance Conduct of Business Sourcebook (ICOBS)",
    slug: "uk-fca-icobs",
    type: "REGULATION",
    countryCode: "GB",
    sourceUrl: "https://www.handbook.fca.org.uk/handbook/ICOBS/2/2.html",
    summary: "FCA handbook rules for general insurance distribution. ICOBS 2.2 requires communications to be clear, fair and not misleading. Marketing must be clearly identifiable as such. Requires Insurance Product Information Document (IPID) for non-life products (pet insurance, travel insurance). Life insurance falls under COBS instead.",
    tags: ["insurance", "pet-insurance", "travel-insurance", "ipid", "fca"],
  },
  {
    title: "Consumer Insurance (Disclosure and Representations) Act 2012",
    slug: "uk-consumer-insurance-act-2012",
    type: "STATUTE",
    countryCode: "GB",
    sourceUrl: "https://www.legislation.gov.uk/ukpga/2012/6",
    summary: "Governs pre-contractual disclosure for consumer insurance contracts. Advertising materials produced by the insurer are considered relevant factors when assessing consumer duty of reasonable care. Advertising must not encourage misrepresentation.",
    tags: ["insurance", "consumer-protection", "disclosure"],
  },
  {
    title: "FCA Financial Promotions Rules",
    slug: "uk-fca-financial-promotions",
    type: "REGULATION",
    countryCode: "GB",
    sourceUrl: "https://www.fca.org.uk/firms/financial-promotions-adverts",
    summary: "FCA rules requiring all financial promotions (including insurance ads) to display FCA firm reference number, identify the regulated firm, include risk warnings where appropriate, and meet the 'clear, fair and not misleading' standard. Applies to digital ads including social media, PPC and display.",
    tags: ["insurance", "financial-promotion", "fca", "digital-advertising"],
  },
  {
    title: "UK CAP Code Section 14 — Financial Products",
    slug: "uk-cap-code-s14",
    type: "INDUSTRY_CODE",
    countryCode: "GB",
    sourceUrl: "https://www.asa.org.uk/type/non_broadcast/code_section/14.html",
    summary: "ASA/CAP Code governing non-technical aspects of insurance advertising — offence, social responsibility, superiority claims, fear/distress, and competitor denigration. FCA governs technical/regulatory aspects; ASA governs everything else.",
    tags: ["insurance", "advertising-standards", "asa", "cap-code"],
  },

  // US
  {
    title: "NAIC Unfair Trade Practices Act (Model Law 880)",
    slug: "us-naic-model-law-880",
    type: "REGULATION",
    countryCode: "US",
    sourceUrl: "https://content.naic.org/sites/default/files/model-law-880.pdf",
    summary: "NAIC model law adopted by 45+ states prohibiting misrepresentations in insurance advertising. Ads must be truthful and not misleading in fact or by implication. Commissioner can impose fines up to $250,000. Willful violation: licence suspension/revocation. 2023 revision addresses health insurance lead generators.",
    tags: ["insurance", "naic", "unfair-trade-practices", "all-insurance-types"],
  },
  {
    title: "NAIC Advertisements of Life Insurance and Annuities (MDL-570)",
    slug: "us-naic-model-law-570",
    type: "REGULATION",
    countryCode: "US",
    sourceUrl: "https://content.naic.org/sites/default/files/model-law-570.pdf",
    summary: "NAIC model regulation specific to life insurance and annuity advertising. Must prominently describe policy type. 'Free' or 'no cost' language prohibited unless genuinely true. All limitations must be set out conspicuously. Annual signed certification of compliance required. Ratings must show relative level within scale.",
    tags: ["insurance", "life-insurance", "naic", "advertising-regulation"],
  },
  {
    title: "NAIC Insurance Advertising Model Regulation (MDL-040)",
    slug: "us-naic-model-law-040",
    type: "REGULATION",
    countryCode: "US",
    sourceUrl: "https://content.naic.org/sites/default/files/model-law-040.pdf",
    summary: "General advertising standards for all insurance types. Record retention: 3-5 years typical. Applies to pet, travel and all non-life insurance categories. California requires long-term care ads to be filed 30 days before use.",
    tags: ["insurance", "naic", "general-advertising", "pet-insurance", "travel-insurance"],
  },
  {
    title: "California Pet Insurance Statute (Insurance Code 12880)",
    slug: "us-ca-pet-insurance-12880",
    type: "STATUTE",
    countryCode: "US",
    sourceUrl: "https://leginfo.legislature.ca.gov/faces/codes_displayText.xhtml?lawCode=INS&division=2.&title=&part=6.&chapter=10.5.&article=",
    summary: "Only US state with a dedicated pet insurance statute (2014). Requires disclosure of reimbursement benefits and pre-existing condition limitations. NAIC pet insurance model law based on this, adopted by 14+ states as of 2025.",
    tags: ["insurance", "pet-insurance", "california", "state-law"],
  },

  // EU
  {
    title: "Insurance Distribution Directive (IDD) 2016/97",
    slug: "eu-idd-2016-97",
    type: "DIRECTIVE",
    countryCode: null,
    region: "EUROPEAN_UNION",
    sourceUrl: "https://eur-lex.europa.eu/eli/dir/2016/97/oj",
    summary: "EU directive requiring all insurance marketing communications to be fair, clear and not misleading. Marketing must be clearly identifiable as such. Non-life products (pet, travel) require Insurance Product Information Document (IPID). Cross-selling transparency required. Minimum harmonisation — member states can impose stricter rules.",
    tags: ["insurance", "eu", "idd", "ipid", "all-insurance-types"],
  },
  {
    title: "Unfair Commercial Practices Directive 2005/29/EC",
    slug: "eu-ucpd-2005-29",
    type: "DIRECTIVE",
    countryCode: null,
    region: "EUROPEAN_UNION",
    sourceUrl: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=celex:32005L0029",
    summary: "Prohibits misleading and aggressive commercial practices in the EU. Insurance advertising cannot contain false information or omit material information that the average consumer needs to make an informed decision.",
    tags: ["insurance", "eu", "consumer-protection", "misleading-advertising"],
  },

  // CANADA
  {
    title: "Canadian Insurance Companies Act (Federal)",
    slug: "ca-insurance-companies-act",
    type: "STATUTE",
    countryCode: "CA",
    sourceUrl: "https://laws-lois.justice.gc.ca/eng/acts/i-11.8/FullText.html",
    summary: "Federal framework for insurance company regulation in Canada. Covers both life and health insurers. Market conduct regulation including advertising is primarily provincial. Joint federal/provincial regulation.",
    tags: ["insurance", "canada", "federal", "all-insurance-types"],
  },
  {
    title: "CLHIA Guideline G5 — Travel Insurance",
    slug: "ca-clhia-g5-travel",
    type: "INDUSTRY_CODE",
    countryCode: "CA",
    sourceUrl: "https://www.clhia.ca/web/CLHIA_LP4W_LND_Webstation.nsf/page/60EE0E7A699C06EE8525784F0058C901/$file/G5.pdf",
    summary: "Industry standard for travel insurance in Canada. All promotion and solicitation of travel insurance (advertisements, brochures, electronic) must comply. Must advise consumers of limitations, exclusions, and pre-existing medical condition limitations prior to purchase.",
    tags: ["insurance", "travel-insurance", "canada", "clhia"],
  },
  {
    title: "CLHIA Guideline G9 — Direct Marketing",
    slug: "ca-clhia-g9-direct-marketing",
    type: "INDUSTRY_CODE",
    countryCode: "CA",
    sourceUrl: "https://www.clhia.ca/web/CLHIA_LP4W_LND_Webstation.nsf/page/D99B8079BC50934685258226006FE573!OpenDocument",
    summary: "CLHIA guideline for direct marketing of insurance products. Insurer's full corporate name and address must be clearly indicated in all advertising. Consumers must be advised of limitations and exclusions prior to purchase. Applies to all distribution channels.",
    tags: ["insurance", "canada", "clhia", "direct-marketing", "all-insurance-types"],
  },

  // AUSTRALIA
  {
    title: "Corporations Act 2001 — Chapter 7 (Financial Services)",
    slug: "au-corporations-act-ch7",
    type: "STATUTE",
    countryCode: "AU",
    sourceUrl: "https://www.legislation.gov.au/Details/C2021C00124",
    summary: "Australian financial services licensing, disclosure and conduct requirements. Section 1018A establishes specific disclosure requirements for advertising financial products including insurance. Requires Australian Financial Services Licence (AFSL) to deal in or advise on insurance.",
    tags: ["insurance", "australia", "afsl", "financial-services"],
  },
  {
    title: "ASIC Regulatory Guide 234 — Advertising Financial Products",
    slug: "au-asic-rg234",
    type: "GUIDANCE",
    countryCode: "AU",
    sourceUrl: "https://download.asic.gov.au/media/rkzj5nxb/rg234-published-15-november-2012-20211008.pdf",
    summary: "ASIC good practice guidance for insurance advertising. Warnings, disclaimers and qualifications must have sufficient prominence on first viewing. The more a qualification is needed to balance a headline claim, the more prominently it must appear. Consumers should not need to go to another website to read disclaimers. Price comparison ads must compare sufficiently similar products.",
    tags: ["insurance", "australia", "asic", "advertising-guidance", "all-insurance-types"],
  },
  {
    title: "Insurance Contracts Act 1984 (Australia)",
    slug: "au-insurance-contracts-act-1984",
    type: "STATUTE",
    countryCode: "AU",
    sourceUrl: "https://www.legislation.gov.au/Details/C2021C00039",
    summary: "Governs the content and terms of insurance contracts in Australia. Advertising must be consistent with actual policy terms. Duty of utmost good faith applies. ASIC Act prohibits misleading or deceptive conduct and unconscionable conduct by insurers.",
    tags: ["insurance", "australia", "contracts", "utmost-good-faith"],
  },
];

// ─────────────────────────────────────────────
// 5. PLATFORM POLICY RECORDS
// ─────────────────────────────────────────────

interface PlatformPolicySeed {
  title: string;
  slug: string;
  platformSlug: string;
  sourceUrl: string;
  summary: string;
}

const PLATFORM_POLICIES: PlatformPolicySeed[] = [
  {
    title: "Meta — Financial and Insurance Products and Services Policy",
    slug: "meta-financial-insurance-policy",
    platformSlug: "instagram", // Meta policy applies to both; we link to both platforms via compliance rules
    sourceUrl: "https://transparency.meta.com/policies/ad-standards/restricted-goods-services/financial-services/",
    summary: "Meta's Special Ad Category for Financial Products and Services. All insurance products require: age targeting disabled, location targeting limited to 15-mile minimum radius, detailed targeting significantly reduced, 18+ age minimum, Business Manager validation. Ads must not directly request personally identifiable financial information.",
  },
  {
    title: "Meta — Financial and Insurance Products (Facebook)",
    slug: "meta-financial-insurance-policy-facebook",
    platformSlug: "facebook",
    sourceUrl: "https://www.facebook.com/business/help/567423788405762",
    summary: "Facebook implementation of Meta's Special Ad Category for Financial Products and Services. Same restrictions as Instagram. Expanded in 2025 to include all insurance products under finance category. Non-compliance may lead to account suspension.",
  },
  {
    title: "Google Ads — Financial Products and Services Policy",
    slug: "google-ads-financial-products-policy",
    platformSlug: "google-ads",
    sourceUrl: "https://support.google.com/adspolicy/answer/2464998",
    summary: "Google's Financial Products and Services policy covering insurance. Must comply with local regulations, provide physical business address, list all fees/charges. UK: FCA Financial Services Verification required. Australia: G2RS verification with ASIC licensing. US/Canada: cannot target by gender, age, parental status, marital status, or ZIP code for consumer finance ads.",
  },
  {
    title: "Google Ads — UK Financial Services Verification",
    slug: "google-ads-uk-financial-services-verification",
    platformSlug: "google-ads",
    sourceUrl: "https://support.google.com/adspolicy/answer/10770884",
    summary: "UK-specific: advertisers must complete Google's Financial Services Verification and demonstrate FCA authorisation or qualify for an exemption. Business information must exactly match the UK FCA Financial Services Register. A contact with the same email domain as the FCA-registered firm must be in the Google Ads account.",
  },
  {
    title: "Google Ads — Australian Financial Services Verification",
    slug: "google-ads-au-financial-services-verification",
    platformSlug: "google-ads",
    sourceUrl: "https://support.google.com/adspolicy/answer/12175793",
    summary: "Australia-specific: advertisers must be verified by G2 Risk Solutions and demonstrate licensing by ASIC. Enforced since August 30, 2022. Applies to all insurance products advertised on Google Ads targeting Australia.",
  },
];

// ─────────────────────────────────────────────
// 6. COMPLIANCE RULES (general + platform-specific)
// ─────────────────────────────────────────────

interface ComplianceRuleSeed {
  categorySlug: string;
  platformSlug?: string;
  countryCode?: string;
  sourceType: "LEGISLATION" | "PLATFORM_POLICY" | "PLATFORM_INDEPENDENT";
  legislationSlug?: string;
  platformPolicySlug?: string;
  status: RuleStatus;
  title: string;
  description: string;
  conditions?: object;
  aiCheckInstructions: string;
  sortOrder: number;
}

const COMPLIANCE_RULES: ComplianceRuleSeed[] = [
  // ── GENERAL RULES (no platform — apply to all) ────────────

  // Pet Insurance
  {
    categorySlug: "insurance-pet",
    sourceType: "PLATFORM_INDEPENDENT",
    status: "RESTRICTED",
    title: "Insurance advertising must be by authorised firms",
    description: "All insurance advertising must be issued or approved by a firm authorised by the relevant financial regulator (FCA in UK, state commissioner in US, ASIC in AU).",
    aiCheckInstructions: "Check whether the ad copy identifies a regulated/authorised firm. Look for FCA numbers, state licensing references, or AFSL numbers. Flag if no regulatory identity is mentioned.",
    sortOrder: 1,
  },
  {
    categorySlug: "insurance-pet",
    sourceType: "PLATFORM_INDEPENDENT",
    status: "RESTRICTED",
    title: "Pre-existing conditions must be disclosed",
    description: "Pet insurance advertising must clearly disclose that pre-existing conditions may not be covered. This is required in most jurisdictions (California law, NAIC model, FCA ICOBS).",
    aiCheckInstructions: "Check if ad mentions pre-existing conditions or exclusions. If the ad implies comprehensive cover without mentioning exclusions, flag as WARNING. If ad explicitly claims 'all conditions covered' without qualification, flag as FAIL.",
    sortOrder: 2,
  },
  {
    categorySlug: "insurance-pet",
    sourceType: "PLATFORM_INDEPENDENT",
    status: "RESTRICTED",
    title: "Claims must be truthful and not misleading",
    description: "Pet insurance advertising must not be misleading by implication. All material limitations, excess amounts, and waiting periods should be disclosed prominently.",
    aiCheckInstructions: "Look for superlative claims like 'best', 'cheapest', 'most comprehensive' without substantiation. Check for misleading implications about coverage scope. Flag claims that omit material limitations.",
    sortOrder: 3,
  },

  // Life Insurance
  {
    categorySlug: "insurance-life",
    sourceType: "PLATFORM_INDEPENDENT",
    status: "RESTRICTED",
    title: "Insurance advertising must be by authorised firms",
    description: "All life insurance advertising must be issued or approved by a firm authorised by the relevant financial regulator.",
    aiCheckInstructions: "Check whether the ad identifies a regulated/authorised firm. Look for FCA numbers, state licensing references, or AFSL numbers. Flag if no regulatory identity is mentioned.",
    sortOrder: 1,
  },
  {
    categorySlug: "insurance-life",
    sourceType: "PLATFORM_INDEPENDENT",
    status: "RESTRICTED",
    title: "Policy type must be prominently described",
    description: "Life insurance ads must clearly identify the type of policy (term, whole life, endowment, universal). Required under NAIC MDL-570 and FCA rules.",
    aiCheckInstructions: "Check if the ad clearly states the type of life insurance product. If the ad is vague about what type of life insurance is being offered, flag as WARNING.",
    sortOrder: 2,
  },
  {
    categorySlug: "insurance-life",
    sourceType: "PLATFORM_INDEPENDENT",
    status: "RESTRICTED",
    title: "No guaranteed returns unless genuinely guaranteed",
    description: "Life insurance ads must not imply guaranteed returns or investment performance unless the product genuinely offers them. 'Free' or 'no cost' language is prohibited unless genuinely true.",
    aiCheckInstructions: "Look for language implying guaranteed returns, guaranteed payouts, or 'free' insurance. Check for 'no cost' claims. If the ad uses such language, flag as FAIL unless the product genuinely offers guarantees.",
    sortOrder: 3,
  },
  {
    categorySlug: "insurance-life",
    sourceType: "PLATFORM_INDEPENDENT",
    status: "RESTRICTED",
    title: "Risk warnings required where applicable",
    description: "Where the life insurance product has an investment component or returns are not guaranteed, appropriate risk warnings must be displayed (e.g. 'Your capital is at risk').",
    aiCheckInstructions: "If the ad mentions investment returns, cash values, or growth, check for a risk warning. Flag as WARNING if investment-linked product is advertised without risk disclosure.",
    sortOrder: 4,
  },

  // Travel Insurance
  {
    categorySlug: "insurance-travel",
    sourceType: "PLATFORM_INDEPENDENT",
    status: "RESTRICTED",
    title: "Insurance advertising must be by authorised firms",
    description: "All travel insurance advertising must be issued or approved by a firm authorised by the relevant financial regulator.",
    aiCheckInstructions: "Check whether the ad identifies a regulated/authorised firm. Look for FCA numbers, state licensing references, or AFSL numbers. Flag if no regulatory identity is mentioned.",
    sortOrder: 1,
  },
  {
    categorySlug: "insurance-travel",
    sourceType: "PLATFORM_INDEPENDENT",
    status: "RESTRICTED",
    title: "Pre-existing conditions and exclusions must be disclosed",
    description: "Travel insurance advertising must clearly disclose that pre-existing medical conditions may not be covered. CLHIA G5 (Canada) and FCA ICOBS (UK) specifically require this.",
    aiCheckInstructions: "Check if ad mentions pre-existing conditions, exclusions, or excess amounts. If ad implies comprehensive cover without mentioning exclusions, flag as WARNING. If ad claims 'everything covered' without qualification, flag as FAIL.",
    sortOrder: 2,
  },
  {
    categorySlug: "insurance-travel",
    sourceType: "PLATFORM_INDEPENDENT",
    status: "RESTRICTED",
    title: "Cross-selling transparency required",
    description: "When travel insurance is sold alongside flights, holidays, or other travel products, consumers must be able to buy the main product without the insurance. Required under EU IDD.",
    aiCheckInstructions: "If the ad bundles travel insurance with a holiday, flight or travel booking, check that it does not imply the insurance is mandatory or automatically included. Flag as WARNING if it appears to be a mandatory add-on.",
    sortOrder: 3,
  },

  // ── PLATFORM-SPECIFIC RULES ───────────────────

  // Meta (Instagram) — applies to all three insurance types
  {
    categorySlug: "insurance-pet",
    platformSlug: "instagram",
    sourceType: "PLATFORM_POLICY",
    platformPolicySlug: "meta-financial-insurance-policy",
    status: "RESTRICTED",
    title: "Meta Special Ad Category — Financial Services targeting restrictions",
    description: "Pet insurance ads on Instagram must comply with Meta's Special Ad Category for Financial Products. Age targeting is disabled, location targeting limited to 15-mile minimum radius, detailed targeting reduced.",
    aiCheckInstructions: "Note that audience targeting restrictions apply at the platform level. Check that ad copy does not reference specific ages, narrow locations, or detailed demographics that cannot be targeted under Special Ad Category rules.",
    sortOrder: 10,
  },
  {
    categorySlug: "insurance-life",
    platformSlug: "instagram",
    sourceType: "PLATFORM_POLICY",
    platformPolicySlug: "meta-financial-insurance-policy",
    status: "RESTRICTED",
    title: "Meta Special Ad Category — Age targeting disabled (major impact)",
    description: "Life insurance ads on Instagram cannot use age targeting — a significant limitation since life insurance products are typically targeted at specific age groups (e.g. over-50s plans). Creative messaging must appeal broadly.",
    aiCheckInstructions: "Check if the ad creative or copy explicitly targets a narrow age group (e.g. 'Over 50s only'). While the copy can mention an age group, the platform will not allow age-based targeting. Flag as WARNING if the ad is clearly designed for a narrow age demographic.",
    sortOrder: 10,
  },
  {
    categorySlug: "insurance-travel",
    platformSlug: "instagram",
    sourceType: "PLATFORM_POLICY",
    platformPolicySlug: "meta-financial-insurance-policy",
    status: "RESTRICTED",
    title: "Meta Special Ad Category — Geo-targeting limited to 15-mile radius",
    description: "Travel insurance ads on Instagram cannot use narrow geo-targeting. This limits departure-point marketing strategies (e.g. targeting airport areas or specific departure cities).",
    aiCheckInstructions: "Note that narrow geo-targeting is not available. If ad copy references a specific departure location or airport, this is fine for creative but the audience cannot be narrowly geo-targeted.",
    sortOrder: 10,
  },

  // Google Ads — UK FCA verification
  {
    categorySlug: "insurance-pet",
    platformSlug: "google-ads",
    countryCode: "GB",
    sourceType: "PLATFORM_POLICY",
    platformPolicySlug: "google-ads-uk-financial-services-verification",
    status: "RESTRICTED",
    title: "Google Ads UK FCA Financial Services Verification required",
    description: "Pet insurance advertisers targeting the UK on Google Ads must complete Financial Services Verification and demonstrate FCA authorisation. Business details must match the FCA Financial Services Register.",
    aiCheckInstructions: "For UK-targeted Google Ads, verify that the advertiser has FCA authorisation. Check that an FCA registration number is referenced or that the business name matches a known FCA-authorised firm.",
    sortOrder: 11,
  },
  {
    categorySlug: "insurance-life",
    platformSlug: "google-ads",
    countryCode: "GB",
    sourceType: "PLATFORM_POLICY",
    platformPolicySlug: "google-ads-uk-financial-services-verification",
    status: "RESTRICTED",
    title: "Google Ads UK FCA Financial Services Verification required",
    description: "Life insurance advertisers targeting the UK on Google Ads must complete Financial Services Verification and demonstrate FCA authorisation.",
    aiCheckInstructions: "For UK-targeted Google Ads, verify that the advertiser has FCA authorisation. FCA registration number should be referenced.",
    sortOrder: 11,
  },
  {
    categorySlug: "insurance-travel",
    platformSlug: "google-ads",
    countryCode: "GB",
    sourceType: "PLATFORM_POLICY",
    platformPolicySlug: "google-ads-uk-financial-services-verification",
    status: "RESTRICTED",
    title: "Google Ads UK FCA Financial Services Verification required",
    description: "Travel insurance advertisers targeting the UK on Google Ads must complete Financial Services Verification and demonstrate FCA authorisation.",
    aiCheckInstructions: "For UK-targeted Google Ads, verify that the advertiser has FCA authorisation. FCA registration number should be referenced.",
    sortOrder: 11,
  },
];

// ─────────────────────────────────────────────
// SEED FUNCTIONS
// ─────────────────────────────────────────────

async function main() {
  console.log("=== Insurance Categories Population Script ===\n");

  // 1. Fetch platforms and parent "Insurance Products" category
  const platforms = await db.platform.findMany({
    where: { slug: { in: PLATFORM_SLUGS } },
    select: { id: true, slug: true, name: true },
  });
  if (platforms.length === 0) {
    console.error("No platforms found. Run the main seed first.");
    process.exit(1);
  }
  const platformMap = Object.fromEntries(platforms.map((p) => [p.slug, p.id]));
  console.log(`Found ${platforms.length} platforms: ${platforms.map((p) => p.name).join(", ")}`);

  const parentInsurance = await db.category.findUnique({ where: { slug: "insurance" } });
  if (!parentInsurance) {
    console.error("Parent 'Insurance Products' category not found. Run the main seed first.");
    process.exit(1);
  }
  console.log(`Parent category: ${parentInsurance.name} (id: ${parentInsurance.id})\n`);

  // 2. Create insurance sub-categories
  console.log("--- Creating insurance sub-categories ---");
  const categoryMap: Record<string, string> = {};

  for (const cat of INSURANCE_SUBCATEGORIES) {
    const category = await db.category.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, description: cat.description, sortOrder: cat.sortOrder, parentId: parentInsurance.id },
      create: {
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        sortOrder: cat.sortOrder,
        parentId: parentInsurance.id,
        maturity: POPULATED_SLUGS.includes(cat.slug) ? "BETA" as CategoryMaturity : "ALPHA" as CategoryMaturity,
      },
    });
    categoryMap[cat.slug] = category.id;

    const isPopulated = POPULATED_SLUGS.includes(cat.slug);
    console.log(`  + ${cat.name} [${isPopulated ? "BETA — full rules" : "ALPHA — placeholder"}]`);
  }

  // 3. Create platform rules
  console.log("\n--- Creating platform rules ---");
  let prCreated = 0;
  let prSkipped = 0;

  for (const [platformSlug, categorySlug, status, notes, referenceUrl] of PLATFORM_RULES) {
    const platformId = platformMap[platformSlug];
    const categoryId = categoryMap[categorySlug];
    if (!platformId || !categoryId) continue;

    const existing = await db.platformRule.findFirst({
      where: { platformId, categoryId },
    });

    if (existing) {
      prSkipped++;
    } else {
      await db.platformRule.create({
        data: { platformId, categoryId, status, notes, referenceUrl, conditions: {} },
      });
      prCreated++;
    }
  }

  // Also create basic RESTRICTED platform rules for non-populated insurance sub-categories
  for (const cat of INSURANCE_SUBCATEGORIES) {
    if (POPULATED_SLUGS.includes(cat.slug)) continue;
    const categoryId = categoryMap[cat.slug];
    if (!categoryId) continue;

    for (const platform of platforms) {
      const existing = await db.platformRule.findFirst({
        where: { platformId: platform.id, categoryId },
      });
      if (existing) {
        prSkipped++;
      } else {
        await db.platformRule.create({
          data: {
            platformId: platform.id,
            categoryId,
            status: "RESTRICTED",
            notes: `${cat.name} advertising is permitted on ${platform.name} but is subject to financial services advertising restrictions. Detailed rules pending population.`,
            conditions: {},
          },
        });
        prCreated++;
      }
    }
  }

  console.log(`  Created ${prCreated} platform rules, skipped ${prSkipped} existing.`);

  // 4. Create geo rules
  console.log("\n--- Creating geo rules ---");
  let grCreated = 0;
  let grSkipped = 0;

  for (const [countryCode, categorySlug, platformSlug, status, conditions, notes, legislationUrl] of GEO_RULES) {
    const categoryId = categoryMap[categorySlug];
    if (!categoryId) continue;

    const country = await db.country.findUnique({ where: { code: countryCode } });
    if (!country) {
      console.log(`  ! Country not found: ${countryCode}`);
      continue;
    }

    const platformId = platformSlug ? platformMap[platformSlug] : null;

    const existing = await db.geoRule.findFirst({
      where: {
        countryId: country.id,
        categoryId,
        ...(platformId ? { platformId } : { platformId: null }),
      },
    });

    if (existing) {
      grSkipped++;
    } else {
      await db.geoRule.create({
        data: {
          countryId: country.id,
          categoryId,
          platformId,
          status,
          restrictions: conditions ?? {},
          notes,
          legislationUrl,
        },
      });
      grCreated++;
    }
  }
  console.log(`  Created ${grCreated} geo rules, skipped ${grSkipped} existing.`);

  // 5. Create legislation records
  console.log("\n--- Creating legislation records ---");
  const legislationMap: Record<string, string> = {};
  let legCreated = 0;

  for (const leg of LEGISLATION) {
    let jurisdictionId: string | null = null;
    if (leg.countryCode) {
      const country = await db.country.findUnique({ where: { code: leg.countryCode } });
      jurisdictionId = country?.id ?? null;
    }

    const record = await db.legislation.upsert({
      where: { slug: leg.slug },
      update: {
        title: leg.title,
        sourceUrl: leg.sourceUrl,
        summary: leg.summary,
        tags: leg.tags,
      },
      create: {
        title: leg.title,
        slug: leg.slug,
        type: leg.type,
        jurisdictionId,
        region: (leg.region as any) ?? null,
        sourceUrl: leg.sourceUrl,
        summary: leg.summary,
        tags: leg.tags,
        maturity: "BETA",
      },
    });

    legislationMap[leg.slug] = record.id;
    legCreated++;
    console.log(`  + ${leg.title}`);
  }
  console.log(`  Total: ${legCreated} legislation records.`);

  // 6. Create platform policy records
  console.log("\n--- Creating platform policy records ---");
  const policyMap: Record<string, string> = {};
  let polCreated = 0;

  for (const pol of PLATFORM_POLICIES) {
    const platformId = platformMap[pol.platformSlug];
    if (!platformId) continue;

    const record = await db.platformPolicy.upsert({
      where: { slug: pol.slug },
      update: {
        title: pol.title,
        sourceUrl: pol.sourceUrl,
        summary: pol.summary,
      },
      create: {
        title: pol.title,
        slug: pol.slug,
        platformId,
        sourceUrl: pol.sourceUrl,
        summary: pol.summary,
        maturity: "BETA",
      },
    });

    policyMap[pol.slug] = record.id;
    polCreated++;
    console.log(`  + ${pol.title}`);
  }
  console.log(`  Total: ${polCreated} platform policy records.`);

  // 7. Create compliance rules
  console.log("\n--- Creating compliance rules ---");
  let crCreated = 0;
  let crSkipped = 0;

  for (const rule of COMPLIANCE_RULES) {
    const categoryId = categoryMap[rule.categorySlug];
    if (!categoryId) continue;

    const platformId = rule.platformSlug ? platformMap[rule.platformSlug] : null;

    let countryId: string | null = null;
    if (rule.countryCode) {
      const country = await db.country.findUnique({ where: { code: rule.countryCode } });
      countryId = country?.id ?? null;
    }

    const legislationId = rule.legislationSlug ? legislationMap[rule.legislationSlug] ?? null : null;
    const platformPolicyId = rule.platformPolicySlug ? policyMap[rule.platformPolicySlug] ?? null : null;

    // Check for existing by title + category + platform + country
    const existing = await db.complianceRule.findFirst({
      where: {
        categoryId,
        title: rule.title,
        ...(platformId ? { platformId } : { platformId: null }),
        ...(countryId ? { countryId } : { countryId: null }),
      },
    });

    if (existing) {
      crSkipped++;
      continue;
    }

    await db.complianceRule.create({
      data: {
        categoryId,
        platformId,
        countryId,
        sourceType: rule.sourceType,
        legislationId,
        platformPolicyId,
        status: rule.status,
        title: rule.title,
        description: rule.description,
        conditions: rule.conditions ?? {},
        aiCheckInstructions: rule.aiCheckInstructions,
        maturity: "BETA",
        sortOrder: rule.sortOrder,
        active: true,
      },
    });
    crCreated++;
  }
  console.log(`  Created ${crCreated} compliance rules, skipped ${crSkipped} existing.`);

  // 8. Update parent group mapping — add new sub-categories as children of "Insurance Products"
  // (Already done via parentId in step 2, but let's also update setup-category-groups if needed)

  console.log("\n=== Summary ===");
  console.log(`  Sub-categories created: ${INSURANCE_SUBCATEGORIES.length}`);
  console.log(`  Platform rules: ${prCreated} created, ${prSkipped} skipped`);
  console.log(`  Geo rules: ${grCreated} created, ${grSkipped} skipped`);
  console.log(`  Legislation records: ${legCreated}`);
  console.log(`  Platform policies: ${polCreated}`);
  console.log(`  Compliance rules: ${crCreated} created, ${crSkipped} skipped`);
  console.log("\nDone.");
}

main()
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
