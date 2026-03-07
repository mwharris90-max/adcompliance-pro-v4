/**
 * One-time script to set initial BETA maturity for:
 * - Healthcare (non-pharma) sub-categories
 * - Legal Services group + children
 * - Insurance category
 *
 * Run: set -a && source .env.local && set +a && npx tsx prisma/set-initial-beta-categories.ts
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// Healthcare non-pharma sub-categories (excluding pharma-specific ones)
const HEALTHCARE_NON_PHARMA_SLUGS = [
  "healthcare-services-general",
  "dental-services",
  "optometry-eye-care",
  "physiotherapy-rehabilitation",
  "nursing-home-care",
  "veterinary-services",
  "telehealth-online-consults",
  "diagnostic-testing-screening",
  "hearing-aids-audiology",
  "mobility-aids-assistive",
];

// Legal Services group and all children
const LEGAL_GROUP_SLUG = "group-legal-services";
const LEGAL_CHILD_SLUGS = [
  "legal-services-general",
  "legal-immigration",
  "legal-personal-injury",
];

// Insurance
const INSURANCE_SLUG = "insurance";

async function main() {
  const allSlugs = [
    ...HEALTHCARE_NON_PHARMA_SLUGS,
    LEGAL_GROUP_SLUG,
    ...LEGAL_CHILD_SLUGS,
    INSURANCE_SLUG,
  ];

  const result = await db.category.updateMany({
    where: { slug: { in: allSlugs } },
    data: { maturity: "BETA" },
  });

  console.log(`Updated ${result.count} categories to BETA maturity.`);

  // Verify
  const updated = await db.category.findMany({
    where: { slug: { in: allSlugs } },
    select: { name: true, slug: true, maturity: true },
    orderBy: { name: "asc" },
  });

  for (const cat of updated) {
    console.log(`  ${cat.maturity} — ${cat.name} (${cat.slug})`);
  }
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
