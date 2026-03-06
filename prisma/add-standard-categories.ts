/**
 * One-time script: adds standard (non-sensitive) categories and marks them
 * ALLOWED on all platforms. Safe to run multiple times (upsert).
 *
 * Run: npx ts-node --project tsconfig.json -e "require('./prisma/add-standard-categories.ts')"
 * Or:  npx tsx prisma/add-standard-categories.ts
 */

import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";

config({ path: ".env.local" });

const db = new PrismaClient();

const NEW_CATEGORIES = [
  // ── Food & Drink (non-alcohol) ────────────────────────────────────────────
  { name: "Food & Beverage — General",       slug: "food-beverage-general",    description: "General food and non-alcoholic drink advertising", sortOrder: 100 },
  { name: "Restaurants & Dining",            slug: "restaurants-dining",        description: "Cafes, restaurants, takeaways and dining experiences", sortOrder: 101 },
  { name: "Grocery & Supermarkets",          slug: "grocery-supermarkets",      description: "Grocery stores, supermarkets and food retailers", sortOrder: 102 },
  { name: "Healthy Food & Nutrition",        slug: "healthy-food-nutrition",    description: "Salads, health foods, whole foods and nutritious meal options", sortOrder: 103 },
  { name: "Non-Alcoholic Beverages",         slug: "non-alcoholic-beverages",   description: "Water, juices, smoothies, teas, coffees and soft drinks (non-HFSS)", sortOrder: 104 },
  { name: "Coffee & Hot Drinks",             slug: "coffee-hot-drinks",         description: "Coffee shops, tea, hot drinks and café chains", sortOrder: 105 },
  { name: "Bakery & Confectionery",          slug: "bakery-confectionery",      description: "Bread, cakes, pastries and bakery products (standard sugar levels)", sortOrder: 106 },
  { name: "Organic & Natural Foods",         slug: "organic-natural-foods",     description: "Organic produce, natural and free-from food products", sortOrder: 107 },

  // ── Fashion & Apparel ─────────────────────────────────────────────────────
  { name: "Fashion & Clothing",              slug: "fashion-clothing",          description: "Everyday apparel, streetwear, formal wear and fashion brands", sortOrder: 110 },
  { name: "Footwear",                        slug: "footwear",                  description: "Shoes, trainers, boots and all footwear", sortOrder: 111 },
  { name: "Accessories & Jewellery",         slug: "accessories-jewellery",     description: "Handbags, belts, hats, scarves, jewellery and fashion accessories", sortOrder: 112 },
  { name: "Watches & Luxury Goods",          slug: "watches-luxury",            description: "Watches, luxury handbags and premium lifestyle goods", sortOrder: 113 },
  { name: "Sportswear & Activewear",         slug: "sportswear-activewear",     description: "Athletic clothing, running gear and gym wear", sortOrder: 114 },
  { name: "Children's Clothing",             slug: "childrens-clothing",        description: "Kids and infant clothing and school uniforms", sortOrder: 115 },
  { name: "Sustainable & Ethical Fashion",   slug: "sustainable-fashion",       description: "Eco-friendly, recycled and ethically sourced fashion brands", sortOrder: 116 },

  // ── Travel & Holidays ─────────────────────────────────────────────────────
  { name: "Travel & Holidays — General",     slug: "travel-holidays-general",   description: "General travel and holiday advertising", sortOrder: 120 },
  { name: "Hotels & Accommodation",          slug: "hotels-accommodation",      description: "Hotels, B&Bs, resorts and short-term rental accommodation", sortOrder: 121 },
  { name: "Airlines & Flights",              slug: "airlines-flights",          description: "Airline carriers, flight booking and aviation services", sortOrder: 122 },
  { name: "Package Holidays & Tours",        slug: "package-holidays-tours",    description: "All-inclusive holidays, tour operators and holiday packages", sortOrder: 123 },
  { name: "Car Hire & Vehicle Rental",       slug: "car-hire-rental",           description: "Car rental, van hire and vehicle leasing", sortOrder: 124 },
  { name: "Cruises",                         slug: "cruises",                   description: "Ocean, river and luxury cruise advertising", sortOrder: 125 },
  { name: "Travel Accessories & Luggage",    slug: "travel-accessories-luggage",description: "Suitcases, travel gear, adapters and holiday accessories", sortOrder: 126 },

  // ── Beauty & Personal Care ────────────────────────────────────────────────
  { name: "Beauty & Personal Care — General",slug: "beauty-personal-care",      description: "General health and beauty products without medical claims", sortOrder: 130 },
  { name: "Skincare (Non-Medical)",          slug: "skincare-non-medical",      description: "Moisturisers, cleansers, sunscreen and everyday skincare without therapeutic claims", sortOrder: 131 },
  { name: "Haircare & Hair Colour",          slug: "haircare-hair-colour",      description: "Shampoo, conditioners, hair dye and styling products", sortOrder: 132 },
  { name: "Fragrances & Perfume",            slug: "fragrances-perfume",        description: "Perfumes, aftershaves and home fragrance", sortOrder: 133 },
  { name: "Makeup & Cosmetics",              slug: "makeup-cosmetics",          description: "Foundation, lipstick, eyeshadow and everyday cosmetics", sortOrder: 134 },
  { name: "Men's Grooming",                  slug: "mens-grooming",             description: "Razors, shaving products and men's personal care", sortOrder: 135 },

  // ── Home & Garden ─────────────────────────────────────────────────────────
  { name: "Home & Garden — General",         slug: "home-garden-general",       description: "General home and garden products and services", sortOrder: 140 },
  { name: "Furniture & Home Décor",          slug: "furniture-home-decor",      description: "Sofas, beds, tables, lamps and interior design products", sortOrder: 141 },
  { name: "Home Improvement & DIY",          slug: "home-improvement-diy",      description: "Power tools, paint, flooring and home renovation", sortOrder: 142 },
  { name: "Gardening & Plants",              slug: "gardening-plants",          description: "Plants, seeds, compost, outdoor furniture and garden tools", sortOrder: 143 },
  { name: "Cleaning & Household Products",   slug: "cleaning-household",        description: "Cleaning supplies, detergents and household consumables", sortOrder: 144 },
  { name: "Kitchen & Cookware",              slug: "kitchen-cookware",          description: "Pots, pans, utensils, appliances and kitchen equipment", sortOrder: 145 },
  { name: "Bedding & Textiles",              slug: "bedding-textiles",          description: "Duvets, pillows, curtains and home textiles", sortOrder: 146 },

  // ── Technology & Electronics ──────────────────────────────────────────────
  { name: "Consumer Electronics — General",  slug: "consumer-electronics",      description: "TVs, audio equipment and general consumer electronics", sortOrder: 150 },
  { name: "Mobile Phones & Accessories",     slug: "mobile-phones-accessories", description: "Smartphones, cases, chargers and mobile accessories", sortOrder: 151 },
  { name: "Computers & Laptops",             slug: "computers-laptops",         description: "PCs, laptops, tablets and computing equipment", sortOrder: 152 },
  { name: "Gaming & Video Games",            slug: "gaming-video-games",        description: "Consoles, video games and gaming accessories", sortOrder: 153 },
  { name: "Software & Apps",                 slug: "software-apps",             description: "Productivity software, mobile apps and SaaS tools", sortOrder: 154 },
  { name: "Smart Home & IoT Devices",        slug: "smart-home-iot",            description: "Smart speakers, doorbells, thermostats and connected home devices", sortOrder: 155 },
  { name: "Cameras & Photography Equipment", slug: "cameras-photography",       description: "Cameras, lenses, drones and photography gear", sortOrder: 156 },

  // ── Automotive ────────────────────────────────────────────────────────────
  { name: "Automotive — Car Sales & Leasing",slug: "automotive-car-sales",      description: "New and used car sales, leasing and dealerships", sortOrder: 160 },
  { name: "Automotive — Car Accessories",    slug: "automotive-accessories",    description: "Car parts, accessories, tyres and vehicle care products", sortOrder: 161 },
  { name: "Automotive — Electric Vehicles",  slug: "automotive-electric",       description: "Electric cars, charging infrastructure and EV accessories", sortOrder: 162 },
  { name: "Automotive — Motorbikes & Scooters", slug: "automotive-motorbikes",  description: "Motorcycles, scooters, mopeds and related accessories", sortOrder: 163 },

  // ── Sports, Fitness & Outdoors ────────────────────────────────────────────
  { name: "Sports & Fitness Equipment",      slug: "sports-fitness-equipment",  description: "Gym equipment, weights, bikes and fitness gear", sortOrder: 170 },
  { name: "Outdoor & Adventure",             slug: "outdoor-adventure",         description: "Hiking, camping, climbing and adventure sports equipment", sortOrder: 171 },
  { name: "Cycling",                         slug: "cycling",                   description: "Bicycles, e-bikes, cycling clothing and accessories", sortOrder: 172 },
  { name: "Water Sports & Swimming",         slug: "water-sports-swimming",     description: "Swimwear, surfing, kayaking and water sports equipment", sortOrder: 173 },
  { name: "Team Sports & Ball Sports",       slug: "team-sports",               description: "Football, rugby, cricket, tennis and ball sport equipment", sortOrder: 174 },
  { name: "Gym Memberships & Fitness Classes", slug: "gym-fitness-memberships", description: "Gym chains, fitness studios and personal training services", sortOrder: 175 },

  // ── Entertainment & Culture ────────────────────────────────────────────────
  { name: "Entertainment & Events",          slug: "entertainment-events",      description: "Concerts, theatre, exhibitions and live events", sortOrder: 180 },
  { name: "Streaming & Media Services",      slug: "streaming-media",           description: "Video and music streaming subscriptions", sortOrder: 181 },
  { name: "Books & Publishing",              slug: "books-publishing",          description: "Books, e-books, audiobooks and magazines", sortOrder: 182 },
  { name: "Music & Instruments",             slug: "music-instruments",         description: "Musical instruments, recording equipment and music lessons", sortOrder: 183 },
  { name: "Film & Cinema",                   slug: "film-cinema",               description: "Movie releases, cinema advertising and DVD/Blu-ray", sortOrder: 184 },
  { name: "Hobbies & Crafts",                slug: "hobbies-crafts",            description: "Art supplies, craft kits, model making and creative hobbies", sortOrder: 185 },

  // ── Children, Toys & Education ────────────────────────────────────────────
  { name: "Toys & Children's Games",         slug: "toys-childrens-games",      description: "Toys, board games, puzzles and children's play equipment", sortOrder: 190 },
  { name: "Baby & Infant Products",          slug: "baby-infant-products",      description: "Baby clothing, nappies, prams, bouncers and nursery items (excluding formula)", sortOrder: 191 },
  { name: "Children's Education & Learning", slug: "childrens-education",       description: "Educational toys, children's apps and school learning resources", sortOrder: 192 },
  { name: "Online Learning & Courses",       slug: "online-learning-courses",   description: "Adult education, online courses, certifications and professional training", sortOrder: 193 },
  { name: "Schools & Universities",          slug: "schools-universities",      description: "Educational institutions, schools and university advertising", sortOrder: 194 },

  // ── Pets ──────────────────────────────────────────────────────────────────
  { name: "Pet Food & Treats",               slug: "pet-food-treats",           description: "Dog food, cat food, bird seed and pet treats", sortOrder: 200 },
  { name: "Pet Accessories & Toys",          slug: "pet-accessories-toys",      description: "Leads, collars, beds, toys and pet accessories", sortOrder: 201 },
  { name: "Veterinary & Pet Health Services",slug: "veterinary-pet-health",     description: "Vets, pet insurance, flea treatment and animal healthcare", sortOrder: 202 },

  // ── Professional & Other Services ─────────────────────────────────────────
  { name: "Professional Services — General", slug: "professional-services",     description: "Accountants, consultants, HR and non-regulated business services", sortOrder: 210 },
  { name: "Charity & Non-Profit",            slug: "charity-non-profit",        description: "Charitable fundraising, NGOs and non-profit organisations", sortOrder: 211 },
  { name: "Events & Weddings",               slug: "events-weddings",           description: "Event planning, wedding services, catering and venues", sortOrder: 212 },
  { name: "Cleaning & Home Services",        slug: "cleaning-home-services",    description: "Domestic cleaning, plumbing, electricians and home maintenance services", sortOrder: 213 },
  { name: "Stationery & Office Supplies",    slug: "stationery-office-supplies",description: "Pens, notebooks, paper, printer supplies and office consumables", sortOrder: 214 },
  { name: "Printing & Signage",              slug: "printing-signage",          description: "Print-on-demand, business cards, banners and signage services", sortOrder: 215 },
  { name: "Photography & Videography Services", slug: "photography-videography",description: "Photography studios, video production and creative media services", sortOrder: 216 },
];

// All three platforms — these categories are ALLOWED on all of them
const PLATFORM_SLUGS = ["instagram", "facebook", "google-ads"];

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
  console.log(`Adding ${NEW_CATEGORIES.length} categories...\n`);

  let created = 0;
  let skipped = 0;

  for (const cat of NEW_CATEGORIES) {
    // Upsert category
    const category = await db.category.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, description: cat.description, sortOrder: cat.sortOrder },
      create: { name: cat.name, slug: cat.slug, description: cat.description, sortOrder: cat.sortOrder },
    });

    // Create ALLOWED platform rule for each platform (upsert)
    for (const platform of platforms) {
      const existing = await db.platformRule.findFirst({
        where: { platformId: platform.id, categoryId: category.id },
      });

      if (existing) {
        skipped++;
      } else {
        await db.platformRule.create({
          data: {
            platformId: platform.id,
            categoryId: category.id,
            status: "ALLOWED",
            notes: `${cat.name} advertising is permitted on ${platform.name} without category-specific restrictions. Standard platform content policies apply.`,
            conditions: {},
          },
        });
        created++;
      }
    }

    process.stdout.write(`  ✓ ${cat.name}\n`);
  }

  console.log(`\nDone. Created ${created} platform rules, skipped ${skipped} existing.`);
}

main()
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
