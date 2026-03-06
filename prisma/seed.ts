import { PrismaClient, GeographicRegion, RuleStatus, ChannelSpecType } from "@prisma/client";
import bcrypt from "bcryptjs";
import { config } from "dotenv";

config({ path: ".env.local" });

const db = new PrismaClient();

// ─────────────────────────────────────────────
// DATA DEFINITIONS
// ─────────────────────────────────────────────

const PLATFORMS = [
  { name: "Instagram", slug: "instagram", logoUrl: "/logos/instagram.svg", parentName: "Meta", sortOrder: 1 },
  { name: "Facebook", slug: "facebook", logoUrl: "/logos/facebook.svg", parentName: "Meta", sortOrder: 2 },
  { name: "Google Ads", slug: "google-ads", logoUrl: "/logos/google-ads.svg", parentName: "Google", sortOrder: 3 },
];

const CHANNEL_REQUIREMENTS: Record<string, Array<{ specType: ChannelSpecType; specKey: string; value: string; notes?: string }>> = {
  instagram: [
    { specType: "CHARACTER_LIMIT", specKey: "headline_char_limit", value: "125", notes: "Primary text / caption" },
    { specType: "CHARACTER_LIMIT", specKey: "description_char_limit", value: "2200", notes: "Full caption limit" },
    { specType: "CHARACTER_LIMIT", specKey: "display_url_char_limit", value: "30" },
    { specType: "FILE_SIZE", specKey: "max_image_size_kb", value: "8192", notes: "8MB max" },
    { specType: "FILE_SIZE", specKey: "max_video_size_mb", value: "4096", notes: "4GB max" },
    { specType: "DURATION", specKey: "max_video_duration_seconds_feed", value: "60" },
    { specType: "DURATION", specKey: "max_video_duration_seconds_reels", value: "90" },
    { specType: "DIMENSIONS", specKey: "image_dimensions_square", value: "1080x1080", notes: "Recommended square" },
    { specType: "DIMENSIONS", specKey: "image_dimensions_portrait", value: "1080x1350", notes: "4:5 portrait" },
    { specType: "DIMENSIONS", specKey: "image_dimensions_landscape", value: "1080x566", notes: "1.91:1 landscape" },
    { specType: "DIMENSIONS", specKey: "image_dimensions_stories", value: "1080x1920", notes: "9:16 Stories/Reels" },
    { specType: "FILE_FORMAT", specKey: "accepted_image_formats", value: "JPG,PNG,GIF,WebP" },
    { specType: "FILE_FORMAT", specKey: "accepted_video_formats", value: "MP4,MOV" },
    { specType: "SAFE_ZONE", specKey: "safe_zone_top_pct", value: "14", notes: "Top 14% reserved for UI" },
    { specType: "SAFE_ZONE", specKey: "safe_zone_bottom_pct", value: "20", notes: "Bottom 20% reserved for UI" },
  ],
  facebook: [
    { specType: "CHARACTER_LIMIT", specKey: "headline_char_limit", value: "40", notes: "Link ad headline" },
    { specType: "CHARACTER_LIMIT", specKey: "primary_text_char_limit", value: "125", notes: "Recommended; 2200 max" },
    { specType: "CHARACTER_LIMIT", specKey: "description_char_limit", value: "30", notes: "Link description" },
    { specType: "CHARACTER_LIMIT", specKey: "display_url_char_limit", value: "30" },
    { specType: "FILE_SIZE", specKey: "max_image_size_kb", value: "8192", notes: "8MB max" },
    { specType: "FILE_SIZE", specKey: "max_video_size_mb", value: "4096", notes: "4GB max" },
    { specType: "DURATION", specKey: "max_video_duration_seconds_feed", value: "241", notes: "Up to 241 minutes" },
    { specType: "DIMENSIONS", specKey: "image_dimensions_square", value: "1080x1080" },
    { specType: "DIMENSIONS", specKey: "image_dimensions_landscape", value: "1200x628", notes: "Recommended for links" },
    { specType: "DIMENSIONS", specKey: "image_dimensions_stories", value: "1080x1920", notes: "9:16 Stories" },
    { specType: "FILE_FORMAT", specKey: "accepted_image_formats", value: "JPG,PNG,GIF,WebP" },
    { specType: "FILE_FORMAT", specKey: "accepted_video_formats", value: "MP4,MOV,AVI,GIF" },
    { specType: "SAFE_ZONE", specKey: "safe_zone_top_pct", value: "14" },
    { specType: "SAFE_ZONE", specKey: "safe_zone_bottom_pct", value: "20" },
  ],
  "google-ads": [
    { specType: "CHARACTER_LIMIT", specKey: "headline_char_limit", value: "30", notes: "Per headline (up to 15 headlines in RSA)" },
    { specType: "CHARACTER_LIMIT", specKey: "description_char_limit", value: "90", notes: "Per description (up to 4 in RSA)" },
    { specType: "CHARACTER_LIMIT", specKey: "display_url_char_limit", value: "15", notes: "Per path field (2 path fields)" },
    { specType: "CHARACTER_LIMIT", specKey: "headline_count_max", value: "15", notes: "RSA max headlines" },
    { specType: "CHARACTER_LIMIT", specKey: "description_count_max", value: "4", notes: "RSA max descriptions" },
    { specType: "FILE_SIZE", specKey: "max_image_size_kb_display", value: "5120", notes: "5MB for display/responsive" },
    { specType: "FILE_SIZE", specKey: "max_video_size_mb", value: "256", notes: "YouTube hosted preferred" },
    { specType: "DIMENSIONS", specKey: "image_dimensions_landscape", value: "1200x628", notes: "1.91:1 required for responsive display" },
    { specType: "DIMENSIONS", specKey: "image_dimensions_square", value: "1200x1200", notes: "1:1 required for responsive display" },
    { specType: "DIMENSIONS", specKey: "image_dimensions_portrait", value: "960x1200", notes: "4:5 portrait optional" },
    { specType: "FILE_FORMAT", specKey: "accepted_image_formats", value: "JPG,PNG,GIF,WebP" },
    { specType: "FILE_FORMAT", specKey: "accepted_video_formats", value: "MP4,MOV,AVI,WMV,FLV,MPEG" },
    { specType: "SAFE_ZONE", specKey: "safe_zone_top_pct", value: "0" },
    { specType: "SAFE_ZONE", specKey: "safe_zone_bottom_pct", value: "0" },
  ],
};

const CATEGORIES = [
  { name: "Alcohol — Beer", slug: "alcohol-beer", description: "Beer and lager advertising", sortOrder: 1 },
  { name: "Alcohol — Wine", slug: "alcohol-wine", description: "Wine advertising", sortOrder: 2 },
  { name: "Alcohol — Spirits & Whiskey", slug: "alcohol-spirits", description: "Spirits, whiskey, vodka, gin and other distilled products", sortOrder: 3 },
  { name: "Alcohol — General", slug: "alcohol-general", description: "Catch-all for mixed or unspecified alcohol products", sortOrder: 4 },
  { name: "Tobacco — Cigarettes", slug: "tobacco-cigarettes", description: "Cigarette and tobacco advertising", sortOrder: 5 },
  { name: "Tobacco — Cigars & Pipe Tobacco", slug: "tobacco-cigars", description: "Cigars and pipe tobacco", sortOrder: 6 },
  { name: "E-cigarettes & Vaping Products", slug: "e-cigarettes-vaping", description: "Vapes, e-cigarettes and nicotine devices", sortOrder: 7 },
  { name: "Nicotine Replacement Products", slug: "nicotine-replacement", description: "Patches, gums, sprays and other NRT", sortOrder: 8 },
  { name: "Prescription Medications", slug: "prescription-medications", description: "Rx prescription drugs and pharmaceuticals", sortOrder: 9 },
  { name: "Over-the-Counter Medications", slug: "otc-medications", description: "Non-prescription drugs and remedies", sortOrder: 10 },
  { name: "Medical Devices & Equipment", slug: "medical-devices", description: "Medical devices, prosthetics, diagnostic equipment", sortOrder: 11 },
  { name: "Dietary Supplements", slug: "dietary-supplements", description: "Vitamins, supplements and health claims", sortOrder: 12 },
  { name: "Weight Loss Products & Services", slug: "weight-loss", description: "Diet products, meal replacements, weight loss programs", sortOrder: 13 },
  { name: "Cannabis — CBD Products", slug: "cannabis-cbd", description: "Hemp-derived CBD products", sortOrder: 14 },
  { name: "Cannabis — THC / Recreational", slug: "cannabis-thc", description: "Psychoactive cannabis and THC products", sortOrder: 15 },
  { name: "Online Gambling / Casino", slug: "online-gambling", description: "Online casinos, poker, and chance-based games", sortOrder: 16 },
  { name: "Sports Betting", slug: "sports-betting", description: "Sports wagering and fixed-odds betting", sortOrder: 17 },
  { name: "Lotteries & Sweepstakes", slug: "lotteries-sweepstakes", description: "State or national lotteries and prize draws", sortOrder: 18 },
  { name: "Fantasy Sports", slug: "fantasy-sports", description: "Paid entry fantasy sports leagues (e.g. DraftKings, FanDuel)", sortOrder: 19 },
  { name: "Financial Services — General", slug: "financial-services-general", description: "Banks, fintech, general financial products", sortOrder: 20 },
  { name: "Loans & Credit Products", slug: "loans-credit", description: "Personal loans, credit cards, buy now pay later", sortOrder: 21 },
  { name: "Payday Loans & Short-Term Lending", slug: "payday-loans", description: "High-cost short-term credit", sortOrder: 22 },
  { name: "Debt Relief & Credit Repair", slug: "debt-relief", description: "Debt management and credit repair services", sortOrder: 23 },
  { name: "Cryptocurrency & NFTs", slug: "cryptocurrency-nfts", description: "Crypto assets, NFTs, and blockchain products", sortOrder: 24 },
  { name: "Investment & Trading Services", slug: "investment-trading", description: "CFDs, forex, stocks, trading platforms", sortOrder: 25 },
  { name: "Insurance Products", slug: "insurance", description: "Life, health, home, auto, and travel insurance", sortOrder: 26 },
  { name: "Legal Services — General", slug: "legal-services-general", description: "Law firms and general legal advice", sortOrder: 27 },
  { name: "Immigration Legal Services", slug: "legal-immigration", description: "Immigration law and visa services", sortOrder: 28 },
  { name: "Personal Injury Legal Services", slug: "legal-personal-injury", description: "Ambulance chasers and claims management", sortOrder: 29 },
  { name: "VPNs & Privacy Software", slug: "vpns-privacy", description: "Virtual private networks and anonymity tools", sortOrder: 30 },
  { name: "Surveillance & Tracking Software", slug: "surveillance-tracking", description: "Monitoring, spyware and tracking applications", sortOrder: 31 },
  { name: "Cybersecurity & Hacking Tools", slug: "cybersecurity-tools", description: "Dual-use security tools and exploit kits", sortOrder: 32 },
  { name: "Adult Content & Pornography", slug: "adult-content", description: "Sexually explicit content and adult services", sortOrder: 33 },
  { name: "Dating Services & Applications", slug: "dating-services", description: "Online dating apps and matchmaking services", sortOrder: 34 },
  { name: "Weapons — Firearms & Ammunition", slug: "weapons-firearms", description: "Guns, rifles, pistols, and ammunition", sortOrder: 35 },
  { name: "Weapons — Knives & Bladed Weapons", slug: "weapons-knives", description: "Knives, swords and bladed implements", sortOrder: 36 },
  { name: "Weapons — Explosives & Pyrotechnics", slug: "weapons-explosives", description: "Explosive devices and professional fireworks", sortOrder: 37 },
  { name: "Bail Bond Services", slug: "bail-bonds", description: "Bail bondsmen and surety services", sortOrder: 38 },
  { name: "Political Advertising", slug: "political-advertising", description: "Party political and election campaign advertising", sortOrder: 39 },
  { name: "Electoral & Voter Messaging", slug: "electoral-voter", description: "Voter registration, get out the vote campaigns", sortOrder: 40 },
  { name: "Social Issues Advertising", slug: "social-issues", description: "Ads relating to controversial social topics", sortOrder: 41 },
  { name: "Cosmetic Surgery & Aesthetic Procedures", slug: "cosmetic-surgery", description: "Plastic surgery, fillers, botox and body modification", sortOrder: 42 },
  { name: "Fertility Treatments", slug: "fertility-treatments", description: "IVF, egg freezing, surrogacy and fertility clinics", sortOrder: 43 },
  { name: "Mental Health Services", slug: "mental-health", description: "Therapy, counselling and mental health apps", sortOrder: 44 },
  { name: "Drug & Alcohol Rehabilitation", slug: "rehabilitation-services", description: "Rehab centres and addiction treatment", sortOrder: 45 },
  { name: "Counterfeit & Replica Goods", slug: "counterfeit-goods", description: "Fake branded goods and replicas", sortOrder: 46 },
  { name: "Multi-Level Marketing (MLM)", slug: "mlm", description: "Network marketing and pyramid-adjacent schemes", sortOrder: 47 },
  { name: "Business Opportunity Schemes", slug: "business-opportunity", description: "Get-rich-quick and work-from-home schemes", sortOrder: 48 },
  { name: "Subscription Traps / Negative Option Billing", slug: "subscription-traps", description: "Hidden recurring charges and hard-to-cancel subscriptions", sortOrder: 49 },
  { name: "Debt Collection Services", slug: "debt-collection", description: "Third-party collection agencies", sortOrder: 50 },
  { name: "Funeral & Bereavement Services", slug: "funeral-services", description: "Funeral homes, prepaid plans and bereavement services", sortOrder: 51 },
  { name: "HFSS Foods — Sugary Snacks & Confectionery", slug: "hfss-sugary-snacks", description: "High fat, sugar or salt snacks and sweets", sortOrder: 52 },
  { name: "HFSS Foods — Fast Food & QSR", slug: "hfss-fast-food", description: "Quick-service restaurants and fast food chains", sortOrder: 53 },
  { name: "HFSS Foods — Energy Drinks", slug: "hfss-energy-drinks", description: "High-caffeine and high-sugar energy beverages", sortOrder: 54 },
  { name: "HFSS Foods — Sugary Soft Drinks", slug: "hfss-soft-drinks", description: "Sugar-sweetened beverages and fizzy drinks", sortOrder: 55 },
  { name: "Infant Formula & Baby Food", slug: "infant-formula", description: "Baby formula and early-stage infant nutrition", sortOrder: 56 },
  { name: "Real Estate Services", slug: "real-estate", description: "Property sales, lettings and real estate agents", sortOrder: 57 },
  { name: "Mortgage Services", slug: "mortgage-services", description: "Home loans, remortgage and equity release", sortOrder: 58 },
  { name: "Online Pharmacies", slug: "online-pharmacies", description: "Internet-based prescription and OTC drug dispensing", sortOrder: 59 },
  { name: "Stem Cell & Experimental Therapies", slug: "stem-cell-therapy", description: "Unproven regenerative medicine and experimental treatments", sortOrder: 60 },
  { name: "Psychic, Astrology & Occult Services", slug: "psychic-occult", description: "Fortune telling, astrology readings and occult services", sortOrder: 61 },
  { name: "Hypnosis Services", slug: "hypnosis", description: "Hypnotherapy and hypnotic suggestion services", sortOrder: 62 },
  { name: "Drug Paraphernalia", slug: "drug-paraphernalia", description: "Equipment for illicit drug use", sortOrder: 63 },
  { name: "Fireworks & Consumer Explosives", slug: "consumer-fireworks", description: "Consumer-grade fireworks and pyrotechnics", sortOrder: 64 },
  { name: "Hunting & Outdoor Weapons", slug: "hunting-weapons", description: "Bows, crossbows, hunting rifles and outdoor weapons", sortOrder: 65 },
  { name: "Ringtones & Subscription Media", slug: "ringtones-subscriptions", description: "Premium SMS services and recurring media subscriptions", sortOrder: 66 },
  { name: "Telemarketing & Robo-calling Services", slug: "telemarketing", description: "Automated calling and aggressive telemarketing", sortOrder: 67 },
  { name: "Penny Auctions", slug: "penny-auctions", description: "Pay-per-bid auction sites", sortOrder: 68 },
  { name: "Online Trading Schools", slug: "trading-schools", description: "Forex, crypto and stock trading education/courses", sortOrder: 69 },
  { name: "Cosmetics with Medical Claims", slug: "cosmetics-medical-claims", description: "Beauty products claiming therapeutic or medical benefits", sortOrder: 70 },
];

const COUNTRIES: Array<{
  name: string; code: string; region: GeographicRegion; approved: boolean; complexRules: boolean;
}> = [
  // NORTH AMERICA
  { name: "United States", code: "US", region: "NORTH_AMERICA", approved: true, complexRules: true },
  { name: "Canada", code: "CA", region: "NORTH_AMERICA", approved: true, complexRules: true },
  { name: "Mexico", code: "MX", region: "NORTH_AMERICA", approved: false, complexRules: false },
  // LATIN AMERICA
  { name: "Brazil", code: "BR", region: "LATIN_AMERICA", approved: false, complexRules: false },
  { name: "Argentina", code: "AR", region: "LATIN_AMERICA", approved: false, complexRules: false },
  { name: "Chile", code: "CL", region: "LATIN_AMERICA", approved: false, complexRules: false },
  { name: "Colombia", code: "CO", region: "LATIN_AMERICA", approved: false, complexRules: false },
  { name: "Peru", code: "PE", region: "LATIN_AMERICA", approved: false, complexRules: false },
  { name: "Dominican Republic", code: "DO", region: "LATIN_AMERICA", approved: false, complexRules: false },
  { name: "Costa Rica", code: "CR", region: "LATIN_AMERICA", approved: false, complexRules: false },
  { name: "Panama", code: "PA", region: "LATIN_AMERICA", approved: false, complexRules: false },
  { name: "Uruguay", code: "UY", region: "LATIN_AMERICA", approved: false, complexRules: false },
  // UNITED KINGDOM
  { name: "United Kingdom", code: "GB", region: "UNITED_KINGDOM", approved: true, complexRules: true },
  // EUROPEAN UNION
  { name: "Germany", code: "DE", region: "EUROPEAN_UNION", approved: true, complexRules: true },
  { name: "France", code: "FR", region: "EUROPEAN_UNION", approved: true, complexRules: true },
  { name: "Italy", code: "IT", region: "EUROPEAN_UNION", approved: true, complexRules: false },
  { name: "Spain", code: "ES", region: "EUROPEAN_UNION", approved: true, complexRules: false },
  { name: "Netherlands", code: "NL", region: "EUROPEAN_UNION", approved: true, complexRules: false },
  { name: "Belgium", code: "BE", region: "EUROPEAN_UNION", approved: true, complexRules: false },
  { name: "Austria", code: "AT", region: "EUROPEAN_UNION", approved: true, complexRules: false },
  { name: "Portugal", code: "PT", region: "EUROPEAN_UNION", approved: true, complexRules: false },
  { name: "Ireland", code: "IE", region: "EUROPEAN_UNION", approved: true, complexRules: false },
  { name: "Finland", code: "FI", region: "EUROPEAN_UNION", approved: true, complexRules: false },
  { name: "Sweden", code: "SE", region: "EUROPEAN_UNION", approved: true, complexRules: false },
  { name: "Denmark", code: "DK", region: "EUROPEAN_UNION", approved: true, complexRules: false },
  { name: "Poland", code: "PL", region: "EUROPEAN_UNION", approved: false, complexRules: false },
  { name: "Czech Republic", code: "CZ", region: "EUROPEAN_UNION", approved: false, complexRules: false },
  { name: "Slovakia", code: "SK", region: "EUROPEAN_UNION", approved: false, complexRules: false },
  { name: "Hungary", code: "HU", region: "EUROPEAN_UNION", approved: false, complexRules: false },
  { name: "Romania", code: "RO", region: "EUROPEAN_UNION", approved: false, complexRules: false },
  { name: "Bulgaria", code: "BG", region: "EUROPEAN_UNION", approved: false, complexRules: false },
  { name: "Croatia", code: "HR", region: "EUROPEAN_UNION", approved: false, complexRules: false },
  { name: "Slovenia", code: "SI", region: "EUROPEAN_UNION", approved: false, complexRules: false },
  { name: "Lithuania", code: "LT", region: "EUROPEAN_UNION", approved: false, complexRules: false },
  { name: "Latvia", code: "LV", region: "EUROPEAN_UNION", approved: false, complexRules: false },
  { name: "Estonia", code: "EE", region: "EUROPEAN_UNION", approved: false, complexRules: false },
  { name: "Luxembourg", code: "LU", region: "EUROPEAN_UNION", approved: false, complexRules: false },
  { name: "Malta", code: "MT", region: "EUROPEAN_UNION", approved: false, complexRules: false },
  { name: "Cyprus", code: "CY", region: "EUROPEAN_UNION", approved: false, complexRules: false },
  { name: "Greece", code: "GR", region: "EUROPEAN_UNION", approved: false, complexRules: false },
  // EUROPE OTHER
  { name: "Norway", code: "NO", region: "EUROPE_OTHER", approved: true, complexRules: false },
  { name: "Switzerland", code: "CH", region: "EUROPE_OTHER", approved: true, complexRules: false },
  { name: "Iceland", code: "IS", region: "EUROPE_OTHER", approved: false, complexRules: false },
  { name: "Serbia", code: "RS", region: "EUROPE_OTHER", approved: false, complexRules: false },
  { name: "Montenegro", code: "ME", region: "EUROPE_OTHER", approved: false, complexRules: false },
  { name: "North Macedonia", code: "MK", region: "EUROPE_OTHER", approved: false, complexRules: false },
  { name: "Albania", code: "AL", region: "EUROPE_OTHER", approved: false, complexRules: false },
  { name: "Bosnia & Herzegovina", code: "BA", region: "EUROPE_OTHER", approved: false, complexRules: false },
  { name: "Ukraine", code: "UA", region: "EUROPE_OTHER", approved: false, complexRules: false },
  { name: "Turkey", code: "TR", region: "EUROPE_OTHER", approved: false, complexRules: true },
  // ASIA PACIFIC
  { name: "Australia", code: "AU", region: "OCEANIA", approved: true, complexRules: true },
  { name: "New Zealand", code: "NZ", region: "OCEANIA", approved: true, complexRules: false },
  { name: "Fiji", code: "FJ", region: "OCEANIA", approved: false, complexRules: false },
  { name: "Japan", code: "JP", region: "ASIA_PACIFIC", approved: false, complexRules: true },
  { name: "South Korea", code: "KR", region: "ASIA_PACIFIC", approved: false, complexRules: true },
  { name: "China", code: "CN", region: "ASIA_PACIFIC", approved: false, complexRules: true },
  { name: "Hong Kong", code: "HK", region: "ASIA_PACIFIC", approved: false, complexRules: true },
  { name: "Taiwan", code: "TW", region: "ASIA_PACIFIC", approved: false, complexRules: false },
  { name: "Singapore", code: "SG", region: "ASIA_PACIFIC", approved: true, complexRules: true },
  { name: "Malaysia", code: "MY", region: "ASIA_PACIFIC", approved: false, complexRules: false },
  { name: "Thailand", code: "TH", region: "ASIA_PACIFIC", approved: false, complexRules: true },
  { name: "Vietnam", code: "VN", region: "ASIA_PACIFIC", approved: false, complexRules: false },
  { name: "Philippines", code: "PH", region: "ASIA_PACIFIC", approved: false, complexRules: false },
  { name: "Indonesia", code: "ID", region: "ASIA_PACIFIC", approved: false, complexRules: true },
  // SOUTH ASIA
  { name: "India", code: "IN", region: "SOUTH_ASIA", approved: false, complexRules: true },
  { name: "Pakistan", code: "PK", region: "SOUTH_ASIA", approved: false, complexRules: true },
  { name: "Bangladesh", code: "BD", region: "SOUTH_ASIA", approved: false, complexRules: false },
  { name: "Sri Lanka", code: "LK", region: "SOUTH_ASIA", approved: false, complexRules: false },
  { name: "Nepal", code: "NP", region: "SOUTH_ASIA", approved: false, complexRules: false },
  // MIDDLE EAST & AFRICA
  { name: "United Arab Emirates", code: "AE", region: "MIDDLE_EAST_AFRICA", approved: false, complexRules: true },
  { name: "Saudi Arabia", code: "SA", region: "MIDDLE_EAST_AFRICA", approved: false, complexRules: true },
  { name: "Israel", code: "IL", region: "MIDDLE_EAST_AFRICA", approved: false, complexRules: false },
  { name: "Qatar", code: "QA", region: "MIDDLE_EAST_AFRICA", approved: false, complexRules: true },
  { name: "Kuwait", code: "KW", region: "MIDDLE_EAST_AFRICA", approved: false, complexRules: true },
  { name: "Jordan", code: "JO", region: "MIDDLE_EAST_AFRICA", approved: false, complexRules: false },
  { name: "Egypt", code: "EG", region: "MIDDLE_EAST_AFRICA", approved: false, complexRules: true },
  { name: "Morocco", code: "MA", region: "MIDDLE_EAST_AFRICA", approved: false, complexRules: false },
  { name: "Tunisia", code: "TN", region: "MIDDLE_EAST_AFRICA", approved: false, complexRules: false },
  { name: "South Africa", code: "ZA", region: "MIDDLE_EAST_AFRICA", approved: false, complexRules: false },
  { name: "Nigeria", code: "NG", region: "MIDDLE_EAST_AFRICA", approved: false, complexRules: false },
  { name: "Kenya", code: "KE", region: "MIDDLE_EAST_AFRICA", approved: false, complexRules: false },
  { name: "Ghana", code: "GH", region: "MIDDLE_EAST_AFRICA", approved: false, complexRules: false },
  { name: "Tanzania", code: "TZ", region: "MIDDLE_EAST_AFRICA", approved: false, complexRules: false },
  { name: "Ethiopia", code: "ET", region: "MIDDLE_EAST_AFRICA", approved: false, complexRules: false },
];

// Platform rules for the most critical restricted categories
// Format: [platformSlug, categorySlug, status, notes, referenceUrl]
type PlatformRuleSeed = [string, string, RuleStatus, string, string?];
const PLATFORM_RULES: PlatformRuleSeed[] = [
  // ── INSTAGRAM ──────────────────────────────────────────────────────
  ["instagram", "alcohol-spirits",  "RESTRICTED",  "Allowed with age-gating (18+). Must not appeal to minors. No depictions of excessive consumption. Requires advertiser registration in some regions.", "https://www.facebook.com/policies/ads/"],
  ["instagram", "alcohol-beer",     "RESTRICTED",  "Allowed with age-gating (18+). No appeal to minors. Must not show irresponsible consumption.", "https://www.facebook.com/policies/ads/"],
  ["instagram", "alcohol-wine",     "RESTRICTED",  "Allowed with age-gating (18+). Same conditions as spirits.", "https://www.facebook.com/policies/ads/"],
  ["instagram", "alcohol-general",  "RESTRICTED",  "All alcohol ads require age-gating and compliance with local laws.", "https://www.facebook.com/policies/ads/"],
  ["instagram", "tobacco-cigarettes","PROHIBITED", "All tobacco advertising is prohibited on Instagram.", "https://www.facebook.com/policies/ads/"],
  ["instagram", "tobacco-cigars",   "PROHIBITED",  "Cigar and pipe tobacco advertising is prohibited.", "https://www.facebook.com/policies/ads/"],
  ["instagram", "e-cigarettes-vaping","PROHIBITED","E-cigarette, vaping device, and e-liquid advertising is prohibited on Instagram.", "https://www.facebook.com/policies/ads/"],
  ["instagram", "nicotine-replacement","RESTRICTED","NRT products (patches, gums) may be permitted with prior written permission from Meta. Subject to local law.", "https://www.facebook.com/policies/ads/"],
  ["instagram", "prescription-medications","RESTRICTED","Prescription drugs require prior written permission from Meta. Must comply with local pharmaceutical advertising laws.", "https://www.facebook.com/policies/ads/"],
  ["instagram", "otc-medications",  "RESTRICTED",  "OTC medications must comply with local laws. No misleading health claims. Prior permission may be required.", "https://www.facebook.com/policies/ads/"],
  ["instagram", "online-gambling",  "PROHIBITED",  "Online gambling advertising is prohibited by default. Advertisers may apply for written permission from Meta in approved jurisdictions.", "https://www.facebook.com/policies/ads/"],
  ["instagram", "sports-betting",   "PROHIBITED",  "Sports betting requires prior written permission from Meta. Only licensed operators in approved territories.", "https://www.facebook.com/policies/ads/"],
  ["instagram", "lotteries-sweepstakes","RESTRICTED","State/national lotteries may advertise with permission. Private prize draws must comply with local law.", "https://www.facebook.com/policies/ads/"],
  ["instagram", "cannabis-cbd",     "RESTRICTED",  "CBD products without THC may be permitted in some jurisdictions. Cannot promote consumption or make medical claims. Requires prior written approval.", "https://www.facebook.com/policies/ads/"],
  ["instagram", "cannabis-thc",     "PROHIBITED",  "THC/psychoactive cannabis products are prohibited regardless of local legal status.", "https://www.facebook.com/policies/ads/"],
  ["instagram", "cryptocurrency-nfts","RESTRICTED", "Crypto products require prior written permission from Meta. Must include required risk disclosures.", "https://www.facebook.com/policies/ads/"],
  ["instagram", "investment-trading","RESTRICTED",  "Financial products must be approved by Meta. Requires licensing evidence and appropriate risk warnings.", "https://www.facebook.com/policies/ads/"],
  ["instagram", "adult-content",    "PROHIBITED",  "Sexually explicit content is strictly prohibited.", "https://www.facebook.com/policies/ads/"],
  ["instagram", "weapons-firearms", "PROHIBITED",  "Firearms, ammunition, and related products are prohibited on Instagram.", "https://www.facebook.com/policies/ads/"],
  ["instagram", "weapons-knives",   "RESTRICTED",  "Hunting knives and outdoor tools may be permitted. Combat knives and weapons marketed for harm are prohibited.", "https://www.facebook.com/policies/ads/"],
  ["instagram", "political-advertising","RESTRICTED","Political and electoral ads require authorisation and disclosure of funder. Targeting restrictions apply.", "https://www.facebook.com/policies/ads/"],
  ["instagram", "social-issues",    "RESTRICTED",  "Social issue ads require authorisation and 'Paid for by' disclaimer. Targeting is restricted.", "https://www.facebook.com/policies/ads/"],
  ["instagram", "dietary-supplements","RESTRICTED", "Dietary supplements allowed but must not make disease treatment claims. No before/after imagery.", "https://www.facebook.com/policies/ads/"],
  ["instagram", "weight-loss",      "RESTRICTED",  "Weight loss products cannot show before/after images or make unsupported claims. Body shaming not permitted.", "https://www.facebook.com/policies/ads/"],
  ["instagram", "cosmetic-surgery", "RESTRICTED",  "Cosmetic procedures allowed but cannot promote negative body image. Before/after images restricted. Age gate required.", "https://www.facebook.com/policies/ads/"],
  ["instagram", "hfss-sugary-snacks","RESTRICTED",  "HFSS food ads must comply with local regulations. May not target minors where prohibited by law.", "https://www.facebook.com/policies/ads/"],
  ["instagram", "financial-services-general","RESTRICTED","Financial services must provide required regulatory disclosures. Platform approval may be required.", "https://www.facebook.com/policies/ads/"],
  ["instagram", "loans-credit",     "RESTRICTED",  "Loans and credit products must include APR and required local disclosures. High-cost credit subject to additional restrictions.", "https://www.facebook.com/policies/ads/"],
  ["instagram", "payday-loans",     "PROHIBITED",  "Payday loans and high-cost short-term credit are prohibited on Instagram.", "https://www.facebook.com/policies/ads/"],
  ["instagram", "drug-paraphernalia","PROHIBITED",  "Drug paraphernalia is prohibited.", "https://www.facebook.com/policies/ads/"],
  ["instagram", "counterfeit-goods","PROHIBITED",   "Counterfeit or replica goods are prohibited.", "https://www.facebook.com/policies/ads/"],

  // ── FACEBOOK ───────────────────────────────────────────────────────
  ["facebook", "alcohol-spirits",   "RESTRICTED",  "Allowed with age-gating (18+). Must not appeal to minors. Meta advertiser registration required in some markets.", "https://www.facebook.com/policies/ads/"],
  ["facebook", "alcohol-beer",      "RESTRICTED",  "Allowed with age-gating (18+). No appeal to minors.", "https://www.facebook.com/policies/ads/"],
  ["facebook", "alcohol-wine",      "RESTRICTED",  "Allowed with age-gating (18+).", "https://www.facebook.com/policies/ads/"],
  ["facebook", "alcohol-general",   "RESTRICTED",  "All alcohol requires age-gating and local law compliance.", "https://www.facebook.com/policies/ads/"],
  ["facebook", "tobacco-cigarettes","PROHIBITED",   "Tobacco advertising is prohibited on Facebook.", "https://www.facebook.com/policies/ads/"],
  ["facebook", "tobacco-cigars",    "PROHIBITED",   "Cigar and pipe tobacco is prohibited.", "https://www.facebook.com/policies/ads/"],
  ["facebook", "e-cigarettes-vaping","PROHIBITED",  "All vaping and e-cigarette products are prohibited.", "https://www.facebook.com/policies/ads/"],
  ["facebook", "nicotine-replacement","RESTRICTED", "NRT may be permitted with prior written permission from Meta.", "https://www.facebook.com/policies/ads/"],
  ["facebook", "prescription-medications","RESTRICTED","Rx drugs require prior written permission from Meta.", "https://www.facebook.com/policies/ads/"],
  ["facebook", "otc-medications",   "RESTRICTED",   "OTC medications must comply with local advertising laws. Prior permission may be required.", "https://www.facebook.com/policies/ads/"],
  ["facebook", "online-gambling",   "PROHIBITED",   "Online gambling prohibited by default. Written permission required from Meta per jurisdiction.", "https://www.facebook.com/policies/ads/"],
  ["facebook", "sports-betting",    "PROHIBITED",   "Requires prior written permission from Meta. Licensed operators only.", "https://www.facebook.com/policies/ads/"],
  ["facebook", "lotteries-sweepstakes","RESTRICTED","State lotteries may advertise. Private promotions must comply with local law.", "https://www.facebook.com/policies/ads/"],
  ["facebook", "cannabis-cbd",      "RESTRICTED",   "CBD (no THC) may be permitted. No consumption promotion. Prior approval required.", "https://www.facebook.com/policies/ads/"],
  ["facebook", "cannabis-thc",      "PROHIBITED",   "THC/psychoactive cannabis is prohibited.", "https://www.facebook.com/policies/ads/"],
  ["facebook", "cryptocurrency-nfts","RESTRICTED",  "Crypto requires prior written permission. Risk warnings required.", "https://www.facebook.com/policies/ads/"],
  ["facebook", "investment-trading","RESTRICTED",   "Financial products require approval, licensing evidence and risk warnings.", "https://www.facebook.com/policies/ads/"],
  ["facebook", "adult-content",     "PROHIBITED",   "Sexually explicit content is strictly prohibited.", "https://www.facebook.com/policies/ads/"],
  ["facebook", "weapons-firearms",  "PROHIBITED",   "Firearms and ammunition are prohibited.", "https://www.facebook.com/policies/ads/"],
  ["facebook", "political-advertising","RESTRICTED","Requires authorisation and funding disclosure.", "https://www.facebook.com/policies/ads/"],
  ["facebook", "social-issues",     "RESTRICTED",   "Requires authorisation and 'Paid for by' disclaimer.", "https://www.facebook.com/policies/ads/"],
  ["facebook", "payday-loans",      "PROHIBITED",   "Payday loans are prohibited.", "https://www.facebook.com/policies/ads/"],
  ["facebook", "drug-paraphernalia","PROHIBITED",   "Drug paraphernalia is prohibited.", "https://www.facebook.com/policies/ads/"],
  ["facebook", "counterfeit-goods", "PROHIBITED",   "Counterfeit goods are prohibited.", "https://www.facebook.com/policies/ads/"],
  ["facebook", "hfss-sugary-snacks","RESTRICTED",   "Must comply with local HFSS regulations and not target minors.", "https://www.facebook.com/policies/ads/"],
  ["facebook", "financial-services-general","RESTRICTED","Requires platform approval and regulatory disclosures.", "https://www.facebook.com/policies/ads/"],
  ["facebook", "loans-credit",      "RESTRICTED",   "Must include APR and required local disclosures.", "https://www.facebook.com/policies/ads/"],

  // ── GOOGLE ADS ─────────────────────────────────────────────────────
  ["google-ads", "alcohol-spirits",  "RESTRICTED", "Permitted where local laws allow. Must comply with Google's alcohol policy and local age restrictions. Personalised ads cannot target minors.", "https://support.google.com/adspolicy/answer/6012382"],
  ["google-ads", "alcohol-beer",     "RESTRICTED", "Permitted in markets where allowed. Local law compliance required.", "https://support.google.com/adspolicy/answer/6012382"],
  ["google-ads", "alcohol-wine",     "RESTRICTED", "Permitted where local laws allow.", "https://support.google.com/adspolicy/answer/6012382"],
  ["google-ads", "alcohol-general",  "RESTRICTED", "Must comply with local alcohol advertising laws.", "https://support.google.com/adspolicy/answer/6012382"],
  ["google-ads", "tobacco-cigarettes","PROHIBITED","Cigarettes and tobacco products are prohibited on Google Ads.", "https://support.google.com/adspolicy/answer/6014699"],
  ["google-ads", "tobacco-cigars",   "PROHIBITED", "Cigars and pipe tobacco are prohibited.", "https://support.google.com/adspolicy/answer/6014699"],
  ["google-ads", "e-cigarettes-vaping","PROHIBITED","Vaping devices and e-cigarette products are prohibited.", "https://support.google.com/adspolicy/answer/6014699"],
  ["google-ads", "nicotine-replacement","RESTRICTED","NRT products may be advertised subject to local law and Google approval.", "https://support.google.com/adspolicy/answer/6014699"],
  ["google-ads", "prescription-medications","RESTRICTED","Rx drugs require Google Healthcare & Medicines certification. Strict DTC restrictions. Prohibited in many markets.", "https://support.google.com/adspolicy/answer/176031"],
  ["google-ads", "otc-medications",  "RESTRICTED", "Permitted where legal but must comply with local laws. Healthcare certification may be required.", "https://support.google.com/adspolicy/answer/176031"],
  ["google-ads", "online-gambling",  "RESTRICTED", "Gambling requires Google certification per country. Licensed operators only. Strict targeting restrictions.", "https://support.google.com/adspolicy/answer/6018017"],
  ["google-ads", "sports-betting",   "RESTRICTED", "Requires Google gambling certification in each target country. Must be licensed operator.", "https://support.google.com/adspolicy/answer/6018017"],
  ["google-ads", "lotteries-sweepstakes","RESTRICTED","State/national lotteries may advertise. Operators must be licensed. Google certification required.", "https://support.google.com/adspolicy/answer/6018017"],
  ["google-ads", "cannabis-cbd",     "RESTRICTED", "CBD without THC claims may be permitted in some jurisdictions. No medical claims. Country-specific restrictions apply.", "https://support.google.com/adspolicy/answer/6014699"],
  ["google-ads", "cannabis-thc",     "PROHIBITED", "THC and recreational cannabis products are prohibited globally.", "https://support.google.com/adspolicy/answer/6014699"],
  ["google-ads", "cryptocurrency-nfts","RESTRICTED","Crypto exchanges and wallets require Google certification. ICOs and DeFi have additional restrictions.", "https://support.google.com/adspolicy/answer/12055153"],
  ["google-ads", "investment-trading","RESTRICTED","Financial products require Google Financial Products and Services certification. Requires FCA or equivalent regulator registration.", "https://support.google.com/adspolicy/answer/2464998"],
  ["google-ads", "adult-content",    "PROHIBITED", "Sexually explicit content is prohibited on standard inventory. Adult content policy applies.", "https://support.google.com/adspolicy/answer/6023699"],
  ["google-ads", "weapons-firearms", "RESTRICTED", "Firearms ads are prohibited in most countries. May be permitted for licensed dealers in limited markets with restrictions.", "https://support.google.com/adspolicy/answer/6014695"],
  ["google-ads", "political-advertising","RESTRICTED","Electoral ads require Google election advertising verification. Applies to US, UK, EU and many other jurisdictions.", "https://support.google.com/adspolicy/answer/9004807"],
  ["google-ads", "social-issues",    "RESTRICTED", "Social issue ads may require election advertising verification in some markets.", "https://support.google.com/adspolicy/answer/9004807"],
  ["google-ads", "payday-loans",     "PROHIBITED", "Payday loans and high-APR short-term loans are prohibited on Google Ads.", "https://support.google.com/adspolicy/answer/2464998"],
  ["google-ads", "loans-credit",     "RESTRICTED", "Personal loans must meet minimum loan term requirements and include APR disclosures.", "https://support.google.com/adspolicy/answer/2464998"],
  ["google-ads", "dietary-supplements","RESTRICTED","Dietary supplements must not make unapproved health claims. Healthcare certification may be required.", "https://support.google.com/adspolicy/answer/176031"],
  ["google-ads", "hfss-sugary-snacks","RESTRICTED", "Subject to local HFSS advertising regulations. Must not target children where prohibited by law.", "https://support.google.com/adspolicy"],
  ["google-ads", "drug-paraphernalia","PROHIBITED", "Drug paraphernalia is prohibited.", "https://support.google.com/adspolicy/answer/6014695"],
  ["google-ads", "counterfeit-goods","PROHIBITED",  "Counterfeit goods are prohibited.", "https://support.google.com/adspolicy/answer/6023676"],
  ["google-ads", "financial-services-general","RESTRICTED","Requires Google Financial Products and Services certification and local regulatory compliance.", "https://support.google.com/adspolicy/answer/2464998"],
];

// Geographic rules: [countryCode, categorySlug, platformSlug|null, status, restrictions (JSON), notes, legislationUrl]
type GeoRuleSeed = [string, string, string | null, RuleStatus, object | null, string, string?];
const GEO_RULES: GeoRuleSeed[] = [
  // ── UNITED KINGDOM ─────────────────────────────────────────────────
  ["GB", "alcohol-spirits",  null, "RESTRICTED",  { ageTargetingRequired: 18, mandatoryDisclaimer: "Please drink responsibly.", audienceRestrictions: ["no_under_18_targeting"] }, "UK alcohol advertising governed by CAP/BCAP codes. Must not glamorise excessive drinking. Must include responsible drinking message. Cannot be targeted at under-18s.", "https://www.asa.org.uk/type/non_broadcast/code_section/18.html"],
  ["GB", "alcohol-beer",     null, "RESTRICTED",  { ageTargetingRequired: 18, mandatoryDisclaimer: "Please drink responsibly." }, "Same as spirits — CAP/BCAP code compliance required.", "https://www.asa.org.uk/type/non_broadcast/code_section/18.html"],
  ["GB", "alcohol-wine",     null, "RESTRICTED",  { ageTargetingRequired: 18, mandatoryDisclaimer: "Please drink responsibly." }, "CAP code compliance. Must not appeal to under 18s.", "https://www.asa.org.uk/type/non_broadcast/code_section/18.html"],
  ["GB", "tobacco-cigarettes",null,"PROHIBITED",  null, "All tobacco advertising is prohibited in the UK under the Tobacco Advertising and Promotion Act 2002.", "https://www.legislation.gov.uk/ukpga/2002/36/contents"],
  ["GB", "tobacco-cigars",   null, "PROHIBITED",  null, "Tobacco advertising prohibition applies to all tobacco products.", "https://www.legislation.gov.uk/ukpga/2002/36/contents"],
  ["GB", "e-cigarettes-vaping",null,"RESTRICTED", { ageTargetingRequired: 18, audienceRestrictions: ["no_under_18_targeting"] }, "E-cigarettes regulated under TRPR/MHRA. Advertising restricted to over-18s only. No health claims unless MHRA authorised.", "https://www.gov.uk/guidance/e-cigarettes-regulations-for-consumer-products"],
  ["GB", "online-gambling",  null, "RESTRICTED",  { ageTargetingRequired: 18, mandatoryDisclaimer: "18+ BeGambleAware.org", audienceRestrictions: ["no_under_18_targeting", "no_vulnerable_audience_targeting"] }, "Requires UK Gambling Commission licence. Must display BeGambleAware message. Affordability checks rules apply. HFSS-style restrictions being introduced.", "https://www.gamblingcommission.gov.uk/licensees-and-businesses/guide/page/advertising-codes-of-practice"],
  ["GB", "sports-betting",   null, "RESTRICTED",  { ageTargetingRequired: 18, mandatoryDisclaimer: "18+ BeGambleAware.org", audienceRestrictions: ["no_under_18_targeting"] }, "UKGC licence required. Same conditions as online gambling.", "https://www.gamblingcommission.gov.uk/"],
  ["GB", "hfss-sugary-snacks",null,"RESTRICTED",  { ageTargetingRequired: 16, audienceRestrictions: ["no_under_16_targeting"], timeRestrictions: { prohibited: false, notes: "Broadcast watershed applies (before 9pm) but digital HFSS rules also restrict targeting under-16s" } }, "UK HFSS regulations prohibit targeting under-16s with ads for high fat, salt or sugar food. ASA CAP rule 15.18.", "https://www.asa.org.uk/type/non_broadcast/code_section/15.html"],
  ["GB", "hfss-fast-food",   null, "RESTRICTED",  { ageTargetingRequired: 16, audienceRestrictions: ["no_under_16_targeting"] }, "HFSS rules apply to fast food and QSR advertising targeting under-16s online.", "https://www.asa.org.uk/type/non_broadcast/code_section/15.html"],
  ["GB", "hfss-energy-drinks",null,"RESTRICTED",  { ageTargetingRequired: 16, audienceRestrictions: ["no_under_16_targeting"] }, "HFSS rules apply. Energy drinks with high sugar/caffeine content cannot be targeted at under-16s.", "https://www.asa.org.uk/type/non_broadcast/code_section/15.html"],
  ["GB", "prescription-medications",null,"PROHIBITED",null,"Direct-to-consumer prescription drug advertising is prohibited in the UK under the Human Medicines Regulations 2012.", "https://www.legislation.gov.uk/uksi/2012/1916/contents/made"],
  ["GB", "political-advertising",null,"RESTRICTED",{ mandatoryDisclaimer: "Promoted by [Party/Individual name]", audienceRestrictions: ["must_disclose_funder"] }, "Political advertising must comply with the Political Parties, Elections and Referendums Act 2000. Disclosure of funder required.", "https://www.legislation.gov.uk/ukpga/2000/41/contents"],
  ["GB", "loans-credit",     null, "RESTRICTED",  { mandatoryDisclaimer: "Representative APR must be stated. Warning: Late repayment can cause you serious money problems." }, "FCA regulated. Must include representative APR. Consumer Credit Act compliance required. Warning text mandated for high-cost credit.", "https://www.fca.org.uk/firms/financial-promotions"],
  ["GB", "payday-loans",     null, "PROHIBITED",  null, "High-cost short-term credit (HCSTC) advertising is heavily restricted by the FCA and effectively prohibited on major digital platforms.", "https://www.fca.org.uk/firms/high-cost-short-term-credit"],
  ["GB", "cannabis-thc",     null, "PROHIBITED",  null, "Cannabis (THC) is a controlled substance (Class B) in the UK. All advertising is prohibited.", "https://www.legislation.gov.uk/ukpga/1971/38/contents"],

  // ── UNITED STATES ──────────────────────────────────────────────────
  ["US", "alcohol-spirits",  null, "RESTRICTED",  { ageTargetingRequired: 21, mandatoryDisclaimer: "Drink Responsibly. Must be 21+ to purchase.", audienceRestrictions: ["no_under_21_targeting"] }, "FTC and Distilled Spirits Council (DISCUS) guidelines. Legal drinking age is 21. Must not target under-21s. State-specific rules may also apply.", "https://www.ftc.gov/reports/alcohol-marketing"],
  ["US", "alcohol-beer",     null, "RESTRICTED",  { ageTargetingRequired: 21, audienceRestrictions: ["no_under_21_targeting"] }, "Beer Institute guidelines and FTC rules apply. Minimum age 21.", "https://www.ftc.gov/reports/alcohol-marketing"],
  ["US", "alcohol-wine",     null, "RESTRICTED",  { ageTargetingRequired: 21, audienceRestrictions: ["no_under_21_targeting"] }, "Wine Institute guidelines and FTC rules. Age 21+ required.", "https://www.ftc.gov/reports/alcohol-marketing"],
  ["US", "online-gambling",  null, "RESTRICTED",  { ageTargetingRequired: 21, mandatoryDisclaimer: "Gambling Problem? Call 1-800-GAMBLER", audienceRestrictions: ["no_under_21_targeting", "state_licensed_only"] }, "Online gambling is legal only in specific US states. Must be licensed in each state. Problem gambling helpline required.", "https://www.ftc.gov/"],
  ["US", "sports-betting",   null, "RESTRICTED",  { ageTargetingRequired: 21, mandatoryDisclaimer: "Must be 21+ and in a state where sports wagering is legal. Gambling Problem? Call 1-800-GAMBLER." }, "Legal in many but not all states since PASPA repeal 2018. State-by-state licensing required.", "https://www.ncpgambling.org/"],
  ["US", "prescription-medications",null,"RESTRICTED",{ mandatoryDisclaimer: "Prescription drug advertising must include fair balance: benefits, side effects, and contraindications. See full Prescribing Information." }, "FDA regulates DTC pharmaceutical advertising. Must include 'fair balance' of benefits and risks. Brief summary or major statement required.", "https://www.fda.gov/drugs/prescription-drug-advertising"],
  ["US", "cannabis-thc",     null, "RESTRICTED",  { audienceRestrictions: ["state_licensed_markets_only", "no_under_21_targeting"] }, "Federally illegal but legal in many states. Advertising only permitted in states where cannabis is legal. Must be licensed. Cannot target under-21s.", "https://www.dea.gov/drug-information/drug-scheduling"],
  ["US", "cannabis-cbd",     null, "RESTRICTED",  { mandatoryDisclaimer: "These statements have not been evaluated by the FDA." }, "Hemp-derived CBD with <0.3% THC is federally legal under the 2018 Farm Bill, but FDA does not permit health claims. State laws vary.", "https://www.fda.gov/consumers/consumer-updates/what-you-need-know-and-what-were-working-find-out-about-products-containing-cannabis-or-cannabis"],
  ["US", "political-advertising",null,"RESTRICTED",{ mandatoryDisclaimer: "Paid for by [Committee Name]. Authorized by [Candidate Name].", audienceRestrictions: ["must_disclose_funder"] }, "FEC regulations require political ad disclosures. FARA applies to foreign-funded political advertising.", "https://www.fec.gov/help-candidates-and-committees/advertising-and-public-communications/"],
  ["US", "payday-loans",     null, "PROHIBITED",  null, "Payday loans prohibited on Google. FTC regulations and CFPB rules severely restrict deceptive advertising. Many state-level bans.", "https://www.ftc.gov/news-events/topics/truth-lending-act"],

  // ── CANADA ─────────────────────────────────────────────────────────
  ["CA", "alcohol-spirits",  null, "RESTRICTED",  { ageTargetingRequired: 19, mandatoryDisclaimer: "Enjoy Responsibly. Must be legal drinking age.", audienceRestrictions: ["no_minor_targeting"], notes: "Age 18 in Alberta, Manitoba, Quebec; 19 elsewhere" }, "CRTC and provincial liquor authority rules. Drinking age is 18 or 19 depending on province. No appeals to minors. No association with risk-taking behaviour.", "https://www.canada.ca/en/health-canada/services/substance-use/alcohol.html"],
  ["CA", "alcohol-beer",     null, "RESTRICTED",  { ageTargetingRequired: 19, mandatoryDisclaimer: "Enjoy Responsibly." }, "Provincial rules apply. Advertising standards CAB code applies to broadcast; CAP digital code applies online.", "https://www.canada.ca/en/health-canada/services/substance-use/alcohol.html"],
  ["CA", "cannabis-thc",     null, "RESTRICTED",  { ageTargetingRequired: 19, mandatoryDisclaimer: "For adult use only. Keep out of reach of children.", audienceRestrictions: ["no_under_18_targeting", "no_appeal_to_youth", "licensed_producers_only"] }, "Cannabis Act (2018) regulates cannabis advertising. Only licensed producers may advertise. Cannot appeal to youth, use testimonials, or depict use. Strict content restrictions.", "https://laws-lois.justice.gc.ca/eng/acts/C-24.5/"],
  ["CA", "cannabis-cbd",     null, "RESTRICTED",  { ageTargetingRequired: 19, audienceRestrictions: ["licensed_operators_only"] }, "CBD is treated as cannabis under the Cannabis Act in Canada. Same restrictions as THC advertising apply. Only licensed producers/retailers.", "https://laws-lois.justice.gc.ca/eng/acts/C-24.5/"],
  ["CA", "online-gambling",  null, "RESTRICTED",  { ageTargetingRequired: 19, mandatoryDisclaimer: "Play responsibly. For help call 1-866-531-2600.", audienceRestrictions: ["provincial_licensed_only"] }, "Gambling regulated provincially. Federal Criminal Code permits provincial lotteries. iGaming Ontario regulates online gambling in Ontario. Must be licensed by provincial authority.", "https://www.igamingontario.ca/"],
  ["CA", "tobacco-cigarettes",null,"PROHIBITED",  null, "Tobacco advertising is prohibited under the Tobacco and Vaping Products Act (TVPA).", "https://laws-lois.justice.gc.ca/eng/acts/T-11.5/"],
  ["CA", "prescription-medications",null,"RESTRICTED",{ mandatoryDisclaimer: "This product is available only by prescription. Ask your doctor." }, "Health Canada regulates DTC pharmaceutical advertising. Brand-name DTC advertising with product claims is prohibited for prescription drugs under the Food and Drugs Act.", "https://www.canada.ca/en/health-canada/services/drugs-health-products/drug-products/advertising.html"],
  ["CA", "hfss-sugary-snacks",null,"RESTRICTED",  { ageTargetingRequired: 13, audienceRestrictions: ["no_under_13_targeting"] }, "Bill C-13 (Protecting Children from Internet Predators Act context) and proposed food marketing rules. Quebec Consumer Protection Act prohibits commercial advertising to under-13s in all categories.", "https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/food-marketing.html"],

  // ── AUSTRALIA ──────────────────────────────────────────────────────
  ["AU", "alcohol-spirits",  null, "RESTRICTED",  { ageTargetingRequired: 18, mandatoryDisclaimer: "Enjoy responsibly. Visit drinkwise.org.au", audienceRestrictions: ["no_under_18_targeting"] }, "ABAC Responsible Alcohol Marketing Code applies. Must include Drinkwise message. Cannot appeal to minors or depict irresponsible consumption.", "https://www.abac.org.au/"],
  ["AU", "alcohol-beer",     null, "RESTRICTED",  { ageTargetingRequired: 18, mandatoryDisclaimer: "Enjoy responsibly. Visit drinkwise.org.au" }, "ABAC code compliance. Drinkwise message required.", "https://www.abac.org.au/"],
  ["AU", "online-gambling",  null, "RESTRICTED",  { ageTargetingRequired: 18, mandatoryDisclaimer: "Gamble Responsibly. Call Gambling Help on 1800 858 858.", audienceRestrictions: ["no_under_18_targeting", "licensed_operators_only"] }, "Interactive Gambling Act 2001 regulates online gambling. Must be licensed. Inducement advertising (free bets, bonus offers) is subject to ACMA restrictions. Problem gambling message required.", "https://www.acma.gov.au/interactive-gambling"],
  ["AU", "sports-betting",   null, "RESTRICTED",  { ageTargetingRequired: 18, mandatoryDisclaimer: "Gamble Responsibly. Think! About your choices. Call Gambling Help 1800 858 858.", timeRestrictions: { prohibited: false, notes: "Live odds advertising prohibited before 8:30pm during live sport on broadcast. Digital rules are evolving." } }, "Governed by state racing authority and ACMA. Live odds display during broadcasting of sport is restricted. Inducements banned.", "https://www.acma.gov.au/"],
  ["AU", "tobacco-cigarettes",null,"PROHIBITED",  null, "Tobacco advertising is prohibited under the Tobacco Advertising Prohibition Act 1992.", "https://www.legislation.gov.au/Details/C2017C00064"],
  ["AU", "prescription-medications",null,"PROHIBITED",null,"Direct-to-consumer advertising of prescription-only medicines (Schedule 4 and 8) is prohibited under the Therapeutic Goods Act 1989.", "https://www.tga.gov.au/resources/publication/publications/advertising-therapeutic-goods-australia-regulatory-framework"],
  ["AU", "hfss-sugary-snacks",null,"RESTRICTED",  { ageTargetingRequired: 15, audienceRestrictions: ["no_child_targeting_voluntary_code"] }, "Australian Food and Grocery Council (AFGC) and Quick Service Restaurant Initiative (QSRI) codes restrict advertising of high-sugar/fat foods to children under 15. Self-regulatory framework pending government mandate.", "https://www.afgc.org.au/industry-resources/responsible-children-marketing-initiative/"],

  // ── GERMANY ────────────────────────────────────────────────────────
  ["DE", "alcohol-spirits",  null, "RESTRICTED",  { ageTargetingRequired: 18, audienceRestrictions: ["no_under_18_targeting"], mandatoryDisclaimer: "Kein Alkohol für Kinder und Jugendliche unter 18 Jahren." }, "German Youth Protection Act (JuSchG) and Jugendmedienschutz-Staatsvertrag prohibit alcohol ads targeting under-18s. Alcohol advertising must not appeal to young people.", "https://www.gesetze-im-internet.de/juschg/"],
  ["DE", "tobacco-cigarettes",null,"PROHIBITED",  null, "Tobacco advertising is prohibited in Germany under the Tabakerzeugnisgesetz (TabakerzG) implementing EU Directive 2003/33/EC.", "https://www.gesetze-im-internet.de/tabakerzg/"],
  ["DE", "tobacco-cigars",   null, "PROHIBITED",  null, "Tobacco advertising prohibition applies.", "https://www.gesetze-im-internet.de/tabakerzg/"],
  ["DE", "e-cigarettes-vaping",null,"RESTRICTED", { ageTargetingRequired: 18, audienceRestrictions: ["no_under_18_targeting"] }, "E-cigarettes regulated under the Tabakerzeugnisgesetz. Cannot target under-18s. Must comply with TRPR-equivalent German implementation.", "https://www.gesetze-im-internet.de/tabakerzg/"],
  ["DE", "online-gambling",  null, "RESTRICTED",  { ageTargetingRequired: 18, mandatoryDisclaimer: "Glücksspiel kann süchtig machen. Hilfe: www.bzga.de", audienceRestrictions: ["licensed_operators_only", "no_under_18_targeting"] }, "German Interstate Treaty on Gambling (Glücksspielstaatsvertrag 2021 - GlüStV). Sports betting and online casino restricted. Must be licensed by GGL (Gemeinsame Glücksspielbehörde der Länder).", "https://www.gluecksspiel-behoerde.de/"],
  ["DE", "prescription-medications",null,"PROHIBITED",null,"Direct-to-consumer prescription drug advertising is prohibited under the German Medicines Act (AMG §10 and §11).", "https://www.gesetze-im-internet.de/amg_1976/"],
  ["DE", "political-advertising",null,"RESTRICTED",{ mandatoryDisclaimer: "Bezahlte politische Werbung — Auftraggeber: [Name]" }, "Political advertising must be clearly labelled as political advertising with funder identified. German Election Campaign Law applies.", "https://www.bundeswahlleiter.de/"],
];

// ─────────────────────────────────────────────
// SEED FUNCTIONS
// ─────────────────────────────────────────────

async function seedAdmin() {
  console.log("  Seeding admin user...");
  const username = process.env.SEED_ADMIN_USERNAME;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!username || !password) {
    throw new Error("SEED_ADMIN_USERNAME and SEED_ADMIN_PASSWORD must be set in your environment before seeding.");
  }
  const passwordHash = await bcrypt.hash(password, 12);

  await db.user.upsert({
    where: { username },
    create: {
      username,
      email: "admin@adcompliancepro.com",
      name: "Admin User",
      passwordHash,
      role: "ADMIN",
      active: true,
    },
    update: {},
  });
  console.log(`  ✓ Admin user: ${username}`);
}

async function seedPlatforms() {
  console.log("  Seeding platforms...");
  for (const platform of PLATFORMS) {
    await db.platform.upsert({
      where: { slug: platform.slug },
      create: platform,
      update: { name: platform.name, logoUrl: platform.logoUrl, parentName: platform.parentName, sortOrder: platform.sortOrder },
    });
  }
  console.log(`  ✓ ${PLATFORMS.length} platforms`);
}

async function seedChannelRequirements() {
  console.log("  Seeding channel requirements...");
  let count = 0;
  for (const [platformSlug, requirements] of Object.entries(CHANNEL_REQUIREMENTS)) {
    const platform = await db.platform.findUnique({ where: { slug: platformSlug } });
    if (!platform) continue;
    for (const req of requirements) {
      await db.channelRequirement.upsert({
        where: { platformId_specKey: { platformId: platform.id, specKey: req.specKey } },
        create: { platformId: platform.id, ...req },
        update: { value: req.value, notes: req.notes },
      });
      count++;
    }
  }
  console.log(`  ✓ ${count} channel requirements`);
}

async function seedCategories() {
  console.log("  Seeding categories...");
  for (const cat of CATEGORIES) {
    await db.category.upsert({
      where: { slug: cat.slug },
      create: cat,
      update: { name: cat.name, description: cat.description, sortOrder: cat.sortOrder },
    });
  }
  console.log(`  ✓ ${CATEGORIES.length} categories`);
}

async function seedCountries() {
  console.log("  Seeding countries...");
  for (const country of COUNTRIES) {
    await db.country.upsert({
      where: { code: country.code },
      create: { ...country, approvedAt: country.approved ? new Date() : null },
      update: { name: country.name, region: country.region, complexRules: country.complexRules },
    });
  }
  const approved = COUNTRIES.filter((c) => c.approved).length;
  console.log(`  ✓ ${COUNTRIES.length} countries (${approved} approved)`);
}

async function seedPlatformRules() {
  console.log("  Seeding platform rules...");
  let count = 0;
  for (const [platformSlug, categorySlug, status, notes, referenceUrl] of PLATFORM_RULES) {
    const platform = await db.platform.findUnique({ where: { slug: platformSlug } });
    const category = await db.category.findUnique({ where: { slug: categorySlug } });
    if (!platform || !category) {
      console.warn(`    ! Skipping rule: ${platformSlug} x ${categorySlug} — not found`);
      continue;
    }
    await db.platformRule.upsert({
      where: { platformId_categoryId: { platformId: platform.id, categoryId: category.id } },
      create: { platformId: platform.id, categoryId: category.id, status, notes, referenceUrl, lastVerifiedAt: new Date() },
      update: { status, notes, referenceUrl },
    });
    count++;
  }
  console.log(`  ✓ ${count} platform rules`);
}

async function seedGeoRules() {
  console.log("  Seeding geographic rules...");
  let count = 0;
  for (const [countryCode, categorySlug, platformSlug, status, restrictions, notes, legislationUrl] of GEO_RULES) {
    const country = await db.country.findUnique({ where: { code: countryCode } });
    const category = await db.category.findUnique({ where: { slug: categorySlug } });
    const platform = platformSlug ? await db.platform.findUnique({ where: { slug: platformSlug } }) : null;
    if (!country || !category) {
      console.warn(`    ! Skipping geo rule: ${countryCode} x ${categorySlug} — not found`);
      continue;
    }
    const platformId = platform?.id ?? null;
    // findFirst + create/update because null platformId can't be used in a compound upsert where clause
    const existing = await db.geoRule.findFirst({
      where: { countryId: country.id, categoryId: category.id, platformId },
    });
    if (existing) {
      await db.geoRule.update({
        where: { id: existing.id },
        data: { status, restrictions: restrictions as object, notes, legislationUrl },
      });
    } else {
      await db.geoRule.create({
        data: {
          countryId: country.id,
          categoryId: category.id,
          platformId,
          status,
          restrictions: restrictions as object,
          notes,
          legislationUrl,
          lastVerifiedAt: new Date(),
        },
      });
    }
    count++;
  }
  console.log(`  ✓ ${count} geographic rules`);
}

// ─────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────

async function main() {
  console.log("🌱 Starting database seed...\n");
  await seedAdmin();
  await seedPlatforms();
  await seedChannelRequirements();
  await seedCategories();
  await seedCountries();
  await seedPlatformRules();
  await seedGeoRules();
  console.log("\n✅ Seed complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
