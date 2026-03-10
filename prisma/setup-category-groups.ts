/**
 * Sets up parent category groups and assigns existing categories as children.
 * Also adds any missing sub-categories.
 *
 * Run: npx tsx prisma/setup-category-groups.ts
 */

import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";

config({ path: ".env.local" });

const db = new PrismaClient();

// Parent groups with icons (lucide icon names)
const PARENT_GROUPS = [
  { name: "Alcohol & Tobacco", slug: "group-alcohol-tobacco", iconName: "Wine", sortOrder: 1, description: "Alcoholic beverages, tobacco products, nicotine and vaping" },
  { name: "Healthcare & Pharma", slug: "group-healthcare-pharma", iconName: "Heart", sortOrder: 2, description: "Medical services, pharmaceuticals, treatments and health products" },
  { name: "Financial Services", slug: "group-financial-services", iconName: "Landmark", sortOrder: 3, description: "Banking, insurance, investments, lending and cryptocurrency" },
  { name: "Gambling & Betting", slug: "group-gambling-betting", iconName: "Dice5", sortOrder: 4, description: "Online gambling, sports betting, lotteries and fantasy sports" },
  { name: "Cannabis & Controlled Substances", slug: "group-cannabis-substances", iconName: "Leaf", sortOrder: 5, description: "Cannabis, CBD, controlled substances and drug paraphernalia" },
  { name: "Legal Services", slug: "group-legal-services", iconName: "Scale", sortOrder: 6, description: "Law firms, immigration, personal injury and legal advice" },
  { name: "Technology & Privacy", slug: "group-technology-privacy", iconName: "Shield", sortOrder: 7, description: "VPNs, surveillance, cybersecurity and privacy tools" },
  { name: "Adult & Dating", slug: "group-adult-dating", iconName: "HeartHandshake", sortOrder: 8, description: "Adult content, dating services and age-restricted material" },
  { name: "Weapons & Safety", slug: "group-weapons-safety", iconName: "Swords", sortOrder: 9, description: "Firearms, knives, explosives and hunting equipment" },
  { name: "Political & Social", slug: "group-political-social", iconName: "Vote", sortOrder: 10, description: "Political advertising, electoral messaging and social issues" },
  { name: "Health & Beauty", slug: "group-health-beauty", iconName: "Sparkles", sortOrder: 11, description: "Cosmetic surgery, fertility, mental health and beauty treatments" },
  { name: "Food & Nutrition", slug: "group-food-nutrition", iconName: "UtensilsCrossed", sortOrder: 12, description: "HFSS foods, infant formula, dietary products and food advertising" },
  { name: "Consumer & Commerce", slug: "group-consumer-commerce", iconName: "ShoppingBag", sortOrder: 13, description: "MLM, counterfeit goods, subscription traps and consumer protection" },
  { name: "Property & Housing", slug: "group-property-housing", iconName: "Home", sortOrder: 14, description: "Real estate, mortgages and property services" },
  { name: "Entertainment & Media", slug: "group-entertainment-media", iconName: "Tv", sortOrder: 15, description: "Streaming, gaming, ringtones and media subscriptions" },
  { name: "Education & Training", slug: "group-education-training", iconName: "GraduationCap", sortOrder: 16, description: "Online courses, trading schools and educational services" },
  { name: "General Industries", slug: "group-general-industries", iconName: "Building2", sortOrder: 17, description: "Standard industry categories — fashion, travel, automotive, sports, pets and more" },
];

// Map child slugs to parent group slugs
const CHILD_TO_PARENT: Record<string, string[]> = {
  "group-alcohol-tobacco": [
    "alcohol-beer", "alcohol-wine", "alcohol-spirits", "alcohol-general",
    "tobacco-cigarettes", "tobacco-cigars", "e-cigarettes-vaping", "nicotine-replacement",
  ],
  "group-healthcare-pharma": [
    "prescription-medications", "otc-medications", "medical-devices", "dietary-supplements",
    "online-pharmacies", "stem-cell-therapy", "cosmetics-medical-claims",
    "healthcare-services-general", "dental-services", "optometry-eye-care",
    "physiotherapy-rehabilitation", "nursing-home-care", "veterinary-services",
    "pharma-corporate-comms", "pharma-clinical-trials", "pharma-investor-relations",
    "pharma-disease-awareness", "telehealth-online-consults", "diagnostic-testing-screening",
    "hearing-aids-audiology", "mobility-aids-assistive",
  ],
  "group-financial-services": [
    "financial-services-general", "loans-credit", "payday-loans", "debt-relief",
    "cryptocurrency-nfts", "investment-trading", "insurance",
    "insurance-pet", "insurance-life", "insurance-travel",
    "insurance-home", "insurance-auto", "insurance-health",
    "insurance-business", "insurance-cyber",
  ],
  "group-gambling-betting": [
    "online-gambling", "sports-betting", "lotteries-sweepstakes", "fantasy-sports",
  ],
  "group-cannabis-substances": [
    "cannabis-cbd", "cannabis-thc", "drug-paraphernalia",
  ],
  "group-legal-services": [
    "legal-services-general", "legal-immigration", "legal-personal-injury",
  ],
  "group-technology-privacy": [
    "vpns-privacy", "surveillance-tracking", "cybersecurity-tools",
  ],
  "group-adult-dating": [
    "adult-content", "dating-services",
  ],
  "group-weapons-safety": [
    "weapons-firearms", "weapons-knives", "weapons-explosives",
    "hunting-weapons", "consumer-fireworks",
  ],
  "group-political-social": [
    "political-advertising", "electoral-voter", "social-issues",
  ],
  "group-health-beauty": [
    "cosmetic-surgery", "fertility-treatments", "mental-health",
    "rehabilitation-services", "weight-loss",
    "health-wellness-general", "fitness-nutrition-coaching",
    "mental-health-apps", "sleep-recovery-products",
    "beauty-personal-care", "skincare-non-medical", "haircare-hair-colour",
    "fragrances-perfume", "makeup-cosmetics", "mens-grooming",
  ],
  "group-food-nutrition": [
    "hfss-sugary-snacks", "hfss-fast-food", "hfss-energy-drinks", "hfss-soft-drinks",
    "infant-formula",
    "food-beverage-general", "restaurants-dining", "grocery-supermarkets",
    "healthy-food-nutrition", "non-alcoholic-beverages", "coffee-hot-drinks",
    "bakery-confectionery", "organic-natural-foods",
  ],
  "group-consumer-commerce": [
    "counterfeit-goods", "mlm", "business-opportunity", "subscription-traps",
    "debt-collection", "funeral-services", "bail-bonds",
    "penny-auctions", "telemarketing", "ringtones-subscriptions",
  ],
  "group-property-housing": [
    "real-estate", "mortgage-services",
  ],
  "group-entertainment-media": [
    "psychic-occult", "hypnosis",
    "entertainment-events", "streaming-media", "books-publishing",
    "music-instruments", "film-cinema", "hobbies-crafts",
  ],
  "group-education-training": [
    "trading-schools",
    "medical-education-training", "healthcare-it-software", "medical-conferences-events",
    "online-learning-courses", "schools-universities", "childrens-education",
  ],
  "group-general-industries": [
    "fashion-clothing", "footwear", "accessories-jewellery", "watches-luxury",
    "sportswear-activewear", "childrens-clothing", "sustainable-fashion",
    "travel-holidays-general", "hotels-accommodation", "airlines-flights",
    "package-holidays-tours", "car-hire-rental", "cruises", "travel-accessories-luggage",
    "home-garden-general", "furniture-home-decor", "home-improvement-diy",
    "gardening-plants", "cleaning-household", "kitchen-cookware", "bedding-textiles",
    "consumer-electronics", "mobile-phones-accessories", "computers-laptops",
    "gaming-video-games", "software-apps", "smart-home-iot", "cameras-photography",
    "automotive-car-sales", "automotive-accessories", "automotive-electric", "automotive-motorbikes",
    "sports-fitness-equipment", "outdoor-adventure", "cycling", "water-sports-swimming",
    "team-sports", "gym-fitness-memberships",
    "toys-childrens-games", "baby-infant-products",
    "pet-food-treats", "pet-accessories-toys", "veterinary-pet-health",
    "professional-services", "charity-non-profit", "events-weddings",
    "cleaning-home-services", "stationery-office-supplies", "printing-signage",
    "photography-videography",
  ],
};

async function main() {
  console.log("Setting up category parent groups...\n");

  // 1. Create parent groups
  for (const group of PARENT_GROUPS) {
    await db.category.upsert({
      where: { slug: group.slug },
      update: { name: group.name, description: group.description, iconName: group.iconName, sortOrder: group.sortOrder },
      create: { name: group.name, slug: group.slug, description: group.description, iconName: group.iconName, sortOrder: group.sortOrder },
    });
    console.log(`  + Group: ${group.name} (${group.iconName})`);
  }

  // 2. Assign children to parents
  let assigned = 0;
  let missing = 0;

  for (const [parentSlug, childSlugs] of Object.entries(CHILD_TO_PARENT)) {
    const parent = await db.category.findUnique({ where: { slug: parentSlug } });
    if (!parent) {
      console.error(`  ! Parent not found: ${parentSlug}`);
      continue;
    }

    for (const childSlug of childSlugs) {
      const child = await db.category.findUnique({ where: { slug: childSlug } });
      if (!child) {
        console.log(`  ? Missing child: ${childSlug} (parent: ${parentSlug})`);
        missing++;
        continue;
      }

      if (child.parentId !== parent.id) {
        await db.category.update({
          where: { id: child.id },
          data: { parentId: parent.id },
        });
        assigned++;
      }
    }
  }

  console.log(`\nDone. Assigned ${assigned} children to parents. ${missing} child slugs not found in DB.`);
}

main()
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
