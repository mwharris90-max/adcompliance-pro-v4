import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

/**
 * Platform certification programmes that affect compliance checks.
 * Each certification maps to specific categories — if a user holds the cert,
 * certification-requirement flags are suppressed for those categories.
 */
const CERTIFICATIONS: Array<{
  slug: string;
  name: string;
  platformSlug: string;
  description: string;
  infoUrl: string;
  categorySlugs: string[];
}> = [
  {
    slug: "google-healthcare-medicines",
    name: "Google Healthcare & Medicines",
    platformSlug: "google-ads",
    description:
      "Required for advertising prescription medications, OTC drugs, and pharmaceutical products on Google Ads. Obtained through Google's Healthcare & Medicines certification programme.",
    infoUrl: "https://support.google.com/adspolicy/answer/176031",
    categorySlugs: [
      "prescription-medications",
      "otc-medications",
      "dietary-supplements",
    ],
  },
  {
    slug: "google-gambling-games",
    name: "Google Gambling & Games",
    platformSlug: "google-ads",
    description:
      "Required for advertising online gambling, sports betting, and lotteries on Google Ads. Must be a licensed operator in each target country.",
    infoUrl: "https://support.google.com/adspolicy/answer/6018017",
    categorySlugs: [
      "online-gambling",
      "sports-betting",
      "lotteries-sweepstakes",
    ],
  },
  {
    slug: "google-financial-products",
    name: "Google Financial Products & Services",
    platformSlug: "google-ads",
    description:
      "Required for advertising financial products including investments, trading platforms, loans, and credit services on Google Ads.",
    infoUrl: "https://support.google.com/adspolicy/answer/2464998",
    categorySlugs: [
      "investment-trading",
      "loans-credit",
      "financial-services-general",
    ],
  },
  {
    slug: "google-cryptocurrency",
    name: "Google Cryptocurrency",
    platformSlug: "google-ads",
    description:
      "Required for advertising cryptocurrency exchanges and wallets on Google Ads. ICOs and DeFi have additional restrictions.",
    infoUrl: "https://support.google.com/adspolicy/answer/12055153",
    categorySlugs: ["cryptocurrency-nfts"],
  },
  {
    slug: "google-election-advertising",
    name: "Google Election Advertising",
    platformSlug: "google-ads",
    description:
      "Required for electoral and political advertising on Google Ads. Applies in the US, UK, EU, and many other jurisdictions.",
    infoUrl: "https://support.google.com/adspolicy/answer/9004807",
    categorySlugs: ["political-advertising", "social-issues"],
  },
  {
    slug: "google-alcohol",
    name: "Google Alcohol Advertising",
    platformSlug: "google-ads",
    description:
      "Required in certain jurisdictions for advertising alcoholic beverages on Google Ads. Must comply with local age restrictions and alcohol advertising laws.",
    infoUrl: "https://support.google.com/adspolicy/answer/6012382",
    categorySlugs: [
      "alcohol-spirits",
      "alcohol-beer",
      "alcohol-wine",
      "alcohol-general",
    ],
  },
  {
    slug: "meta-gambling-gaming",
    name: "Meta Gambling & Gaming",
    platformSlug: "facebook",
    description:
      "Prior written permission from Meta required for advertising gambling and gaming on Facebook and Instagram. Only licensed operators in approved territories.",
    infoUrl: "https://www.facebook.com/policies/ads/",
    categorySlugs: [
      "online-gambling",
      "sports-betting",
      "lotteries-sweepstakes",
    ],
  },
];

async function main() {
  console.log("Seeding platform certifications...");

  for (const cert of CERTIFICATIONS) {
    // Look up platform
    const platform = await db.platform.findUnique({
      where: { slug: cert.platformSlug },
    });
    if (!platform) {
      console.warn(`  Platform "${cert.platformSlug}" not found — skipping ${cert.slug}`);
      continue;
    }

    // Look up category IDs
    const categories = await db.category.findMany({
      where: { slug: { in: cert.categorySlugs } },
      select: { id: true, slug: true },
    });

    const categoryIds = categories.map((c) => c.id);
    const foundSlugs = categories.map((c) => c.slug);
    const missingSlugs = cert.categorySlugs.filter((s) => !foundSlugs.includes(s));
    if (missingSlugs.length > 0) {
      console.warn(`  Missing categories for ${cert.slug}: ${missingSlugs.join(", ")}`);
    }

    await db.platformCertification.upsert({
      where: { slug: cert.slug },
      create: {
        slug: cert.slug,
        name: cert.name,
        platformId: platform.id,
        description: cert.description,
        infoUrl: cert.infoUrl,
        categoryIds,
      },
      update: {
        name: cert.name,
        platformId: platform.id,
        description: cert.description,
        infoUrl: cert.infoUrl,
        categoryIds,
      },
    });

    console.log(`  ✓ ${cert.name} (${categoryIds.length} categories)`);
  }

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
