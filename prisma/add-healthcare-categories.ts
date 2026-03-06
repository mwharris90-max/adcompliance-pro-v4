/**
 * Adds granular healthcare & pharma categories so the AI category detection
 * can distinguish between prohibited activities (e.g. DTC prescription drug ads)
 * and permitted ones (e.g. pharma corporate comms, healthcare services).
 *
 * Run: npx tsx prisma/add-healthcare-categories.ts
 */

import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";

config({ path: ".env.local" });

const db = new PrismaClient();

const NEW_CATEGORIES = [
  // ── Healthcare Services (ALLOWED) ───────────────────────────────────────────
  { name: "Healthcare Services — General",      slug: "healthcare-services-general",  description: "Hospitals, clinics, GP surgeries and general healthcare provider advertising", sortOrder: 220 },
  { name: "Dental Services",                    slug: "dental-services",              description: "Dentists, orthodontists, dental hygiene and teeth whitening services", sortOrder: 221 },
  { name: "Optometry & Eye Care",               slug: "optometry-eye-care",           description: "Opticians, eye tests, glasses, contact lenses and laser eye surgery", sortOrder: 222 },
  { name: "Physiotherapy & Rehabilitation",     slug: "physiotherapy-rehabilitation", description: "Physiotherapists, chiropractors, osteopaths and physical rehabilitation services", sortOrder: 223 },
  { name: "Nursing & Home Care Services",       slug: "nursing-home-care",            description: "Home nursing, elderly care, domiciliary care and care home advertising", sortOrder: 224 },
  { name: "Veterinary Services",                slug: "veterinary-services",          description: "Veterinary clinics, animal hospitals and pet health services", sortOrder: 225 },

  // ── Pharma Corporate & Non-Promotional (ALLOWED) ──────────────────────────
  { name: "Pharma — Corporate Communications",  slug: "pharma-corporate-comms",       description: "Pharmaceutical company brand advertising, investor relations, annual reports, company news and recruitment — NOT promoting specific drugs", sortOrder: 230 },
  { name: "Pharma — Clinical Trials & Research", slug: "pharma-clinical-trials",      description: "Clinical trial recruitment, research study participation and medical research announcements", sortOrder: 231 },
  { name: "Pharma — Investor Relations",        slug: "pharma-investor-relations",    description: "Share price updates, IPO announcements, financial results and shareholder communications for pharma companies", sortOrder: 232 },
  { name: "Pharma — Disease Awareness",         slug: "pharma-disease-awareness",     description: "Unbranded disease awareness campaigns that educate the public without promoting a specific treatment (e.g. 'Talk to your doctor about X')", sortOrder: 233 },

  // ── Health & Wellness (ALLOWED) ─────────────────────────────────────────────
  { name: "Health & Wellness — General",        slug: "health-wellness-general",      description: "General wellness, healthy living tips, mindfulness and wellbeing content — no product-specific medical claims", sortOrder: 240 },
  { name: "Fitness & Nutrition Coaching",       slug: "fitness-nutrition-coaching",    description: "Personal trainers, nutritionists, meal planning services and fitness coaching", sortOrder: 241 },
  { name: "Mental Health & Wellbeing Apps",     slug: "mental-health-apps",           description: "Meditation apps, therapy platforms, stress management and mental wellness tools", sortOrder: 242 },
  { name: "Sleep & Recovery Products",          slug: "sleep-recovery-products",      description: "Mattresses, sleep aids (non-pharmaceutical), white noise machines and recovery tools", sortOrder: 243 },

  // ── Medical Education & Professional (ALLOWED) ──────────────────────────────
  { name: "Medical Education & Training",       slug: "medical-education-training",   description: "Medical schools, CPD courses, nursing qualifications and healthcare professional training", sortOrder: 250 },
  { name: "Healthcare IT & Software",           slug: "healthcare-it-software",       description: "Electronic health records, practice management software, telehealth platforms and healthtech SaaS", sortOrder: 251 },
  { name: "Medical Conferences & Events",       slug: "medical-conferences-events",   description: "Medical conferences, healthcare exhibitions, symposia and professional networking events", sortOrder: 252 },

  // ── Specific Medical Services (RESTRICTED — have rules but are advertisable) ─
  { name: "Telehealth & Online Consultations",  slug: "telehealth-online-consults",   description: "Online doctor consultations, virtual GP services and remote healthcare platforms", sortOrder: 260 },
  { name: "Diagnostic Testing & Screening",     slug: "diagnostic-testing-screening", description: "Blood tests, genetic testing, health screening services and at-home test kits", sortOrder: 261 },
  { name: "Hearing Aids & Audiology",           slug: "hearing-aids-audiology",       description: "Hearing aids, cochlear implants, audiology services and hearing tests", sortOrder: 262 },
  { name: "Mobility Aids & Assistive Devices",  slug: "mobility-aids-assistive",      description: "Wheelchairs, mobility scooters, walking aids and assistive technology", sortOrder: 263 },
];

const PLATFORM_SLUGS = ["instagram", "facebook", "google-ads"];

// Categories that should be marked RESTRICTED rather than ALLOWED
const RESTRICTED_SLUGS = new Set([
  "telehealth-online-consults",
  "diagnostic-testing-screening",
]);

async function main() {
  console.log("Fetching existing platforms...");
  const platforms = await db.platform.findMany({
    where: { slug: { in: PLATFORM_SLUGS } },
    select: { id: true, slug: true, name: true },
  });

  if (platforms.length === 0) {
    console.error("No platforms found. Run the main seed first.");
    process.exit(1);
  }

  console.log(`Found ${platforms.length} platform(s): ${platforms.map((p) => p.name).join(", ")}`);
  console.log(`Adding ${NEW_CATEGORIES.length} healthcare categories...\n`);

  let created = 0;
  let skipped = 0;

  for (const cat of NEW_CATEGORIES) {
    const category = await db.category.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, description: cat.description, sortOrder: cat.sortOrder },
      create: { name: cat.name, slug: cat.slug, description: cat.description, sortOrder: cat.sortOrder },
    });

    const isRestricted = RESTRICTED_SLUGS.has(cat.slug);
    const status = isRestricted ? "RESTRICTED" : "ALLOWED";

    for (const platform of platforms) {
      const existing = await db.platformRule.findFirst({
        where: { platformId: platform.id, categoryId: category.id },
      });

      if (existing) {
        skipped++;
      } else {
        const notes = isRestricted
          ? `${cat.name} advertising is permitted on ${platform.name} but may require compliance with healthcare advertising regulations. Must not make unsubstantiated medical claims.`
          : `${cat.name} advertising is permitted on ${platform.name} without category-specific restrictions. Standard platform content policies apply.`;

        await db.platformRule.create({
          data: {
            platformId: platform.id,
            categoryId: category.id,
            status,
            notes,
            conditions: {},
          },
        });
        created++;
      }
    }

    const label = isRestricted ? " [RESTRICTED]" : "";
    process.stdout.write(`  ✓ ${cat.name}${label}\n`);
  }

  console.log(`\nDone. Created ${created} platform rules, skipped ${skipped} existing.`);
}

main()
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
