import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const articles = [
  {
    slug: "meta-alcohol-advertising-policy",
    title: "Meta Alcohol Advertising Policy",
    summary:
      "Understanding Meta's rules for advertising alcohol products on Facebook and Instagram, including age targeting, content restrictions, and regional differences.",
    content: `## Overview

Meta (Facebook and Instagram) allows alcohol advertising but with strict controls. Advertisers must comply with local laws, age-gating requirements, and content restrictions.

## Key Requirements

- **Age targeting**: All alcohol ads must be age-gated to users 18+ (or the legal drinking age in the target country)
- **No targeting minors**: You cannot target audiences under the legal drinking age
- **No excessive consumption**: Ads must not promote binge drinking or excessive consumption
- **No driving**: Ads cannot associate alcohol with operating vehicles
- **Health claims**: You cannot make health or therapeutic claims about alcohol

## Country-Specific Rules

Different countries have varying restrictions:

- **UK**: Must comply with ASA/CAP Code. No appeal to under-18s
- **France**: Loi Évin restricts alcohol advertising significantly — no lifestyle imagery
- **UAE/Saudi Arabia**: Alcohol advertising is completely prohibited

## Best Practices

- Always set age restrictions in your ad targeting
- Include responsible drinking messaging where required
- Avoid imagery that could appeal to minors
- Check local legislation before running campaigns in new markets`,
    examples: [
      {
        good: "Enjoy our award-winning craft beer. Must be 18+ to purchase. Please drink responsibly.",
        bad: "Get wasted this weekend with our new party pack! 🎉🍺",
        explanation:
          "The good example promotes the product responsibly with an age disclaimer and responsibility message. The bad example promotes excessive consumption and targets a party/youth culture.",
      },
      {
        good: "Our vineyard has been producing fine wines since 1850. Discover our heritage collection.",
        bad: "Our wine will help you relax and improve your sleep quality!",
        explanation:
          "Making health or therapeutic claims about alcohol (improved sleep, relaxation benefits) is prohibited. Focus on the product's heritage, taste, or craftsmanship instead.",
      },
    ],
    videoUrl: "https://www.youtube.com/watch?v=dZe3bDeGqpo",
    videoTitle: "Meta Advertising Policies Explained",
    tags: ["alcohol", "age-gate", "meta", "facebook", "instagram"],
    sortOrder: 1,
  },
  {
    slug: "google-ads-healthcare-policy",
    title: "Google Ads Healthcare & Medicines Policy",
    summary:
      "A comprehensive guide to Google's advertising policies for healthcare products, pharmaceuticals, and medical services.",
    content: `## Overview

Google has strict policies around healthcare advertising to protect users from misleading or harmful claims. These rules vary significantly by country and product type.

## What Requires Certification

Google requires advertiser certification for:

- **Prescription drugs** (where allowed by local law)
- **Online pharmacies** — must be verified
- **Addiction services** — requires LegitScript certification in some countries
- **Clinical trial recruitment**

## Prohibited Content

The following are never allowed on Google Ads:

- Unapproved pharmaceuticals or supplements
- Misleading health claims (miracle cures, guaranteed results)
- Prescription drug sales without proper certification
- Speculative or experimental treatments marketed as proven

## Content Restrictions

- Over-the-counter medicines may be advertised with proper disclaimers
- Cosmetic procedures require clear before/after disclaimers
- Weight loss products cannot promise specific results
- Mental health services must be from licensed providers

## Regional Variations

- **US**: Prescription drug ads allowed with FDA-approved medications only
- **UK**: Must comply with MHRA rules, no prescription drug ads to consumers
- **EU**: Strict rules on pharmaceutical advertising vary by member state`,
    examples: [
      {
        good: "Consult your doctor about treatment options for arthritis. Book an appointment at our certified clinic today.",
        bad: "Our supplement CURES arthritis in 7 days! No doctor needed. 100% guaranteed results!",
        explanation:
          "Google prohibits misleading health claims, guarantees of results, and discouraging medical consultation. The good example directs users to a professional, while the bad example makes prohibited miracle cure claims.",
      },
    ],
    videoUrl: "https://www.youtube.com/watch?v=3fhVROqLSIQ",
    videoTitle: "Google Ads Policies for Healthcare",
    tags: ["healthcare", "pharmaceuticals", "google-ads", "certification"],
    sortOrder: 2,
  },
  {
    slug: "gambling-advertising-regulations",
    title: "Gambling Advertising Regulations",
    summary:
      "How to advertise gambling and betting services compliantly across Meta, Google, and Instagram — including licensing requirements and responsible gambling messaging.",
    content: `## Overview

Gambling advertising is one of the most heavily regulated categories in digital advertising. Rules vary dramatically between platforms, countries, and types of gambling.

## Platform Requirements

### Meta (Facebook & Instagram)
- Requires prior written permission from Meta
- Must target 18+ (or local legal age)
- Only allowed in jurisdictions where gambling is legal
- Must include responsible gambling messaging

### Google Ads
- Requires Google Gambling certification
- Must hold a valid gambling licence in the target jurisdiction
- Landing pages must display licence information
- No ads targeting minors or vulnerable groups

## Country-Specific Regulations

### United Kingdom
- Must comply with UK Gambling Commission rules
- All ads must include responsible gambling messaging
- Must display GambleAware branding (BeGambleAware.org)
- No targeting vulnerable groups or those self-excluded
- New rules from April 2023 restrict bonus offer ads

### Italy
- Complete ban on gambling advertising (Dignity Decree, 2019)

### Australia
- No live-odds advertising during sporting events
- Must include responsible gambling messaging

### United States
- Rules vary by state — many states prohibit online gambling ads entirely

## Required Elements

Every gambling ad should include:

- Age restriction notice (18+ or 21+)
- Responsible gambling helpline or website
- Gambling licence number (where required)
- Terms and conditions for any promotions`,
    examples: [
      {
        good: "Premier League betting odds now live. 18+. T&Cs apply. BeGambleAware.org",
        bad: "Win big! Free money when you sign up! Everyone's a winner! 💰💰💰",
        explanation:
          "Gambling ads must include age restrictions, T&Cs references, and responsible gambling resources. They should never guarantee wins, offer 'free money' without clear terms, or create unrealistic expectations of winning.",
      },
      {
        good: "New customer offer: Bet £10, Get £10 in free bets. 18+. Min deposit £10. T&Cs apply. GambleAware.org",
        bad: "RISK-FREE betting! You literally cannot lose! Sign up now before this offer disappears!",
        explanation:
          "Promotions must be clearly defined with terms and conditions. 'Risk-free' claims are misleading as users can still lose money. Urgency tactics ('before this disappears') are also flagged as misleading by regulators.",
      },
    ],
    videoUrl: "https://www.youtube.com/watch?v=jDLGsV7TjAs",
    videoTitle: "Gambling Advertising Compliance Guide",
    tags: [
      "gambling",
      "betting",
      "age-gate",
      "licensing",
      "responsible-gambling",
    ],
    sortOrder: 3,
  },
  {
    slug: "financial-services-advertising",
    title: "Financial Services Advertising Rules",
    summary:
      "Navigate the complex rules around advertising financial products including loans, credit cards, investments, and cryptocurrency across digital platforms.",
    content: `## Overview

Financial services advertising is subject to strict regulation by both advertising platforms and financial regulators (FCA in the UK, SEC in the US, etc.).

## Key Principles

- **Clear, fair and not misleading**: All financial ads must present information honestly
- **Risk warnings**: Investment and trading ads must include appropriate risk warnings
- **APR disclosure**: Credit and loan products must display representative APR
- **Authorisation**: Advertisers must be authorised by relevant financial regulators

## Platform-Specific Rules

### Meta
- Financial products require special ad categories
- Cryptocurrency ads require prior approval
- Housing and credit ads face additional targeting restrictions (US)

### Google Ads
- Requires financial services certification in many countries
- Loan ads must display APR, fees, and repayment terms
- Crypto exchange ads require Google certification
- No ads for binary options, CFDs (in some regions)

## Cryptocurrency Advertising

- Most platforms require pre-approval or certification
- Must include risk warnings about volatility
- No guaranteed returns or misleading income claims
- NFT and DeFi ads face varying restrictions

## Required Disclaimers

- "Your capital is at risk" for investment products
- "Your home may be repossessed if you do not keep up repayments" for mortgages
- Representative APR for all credit products
- FCA authorisation number where applicable`,
    examples: [
      {
        good: "Compare personal loans from 3.1% APR representative. Your rate may differ. Loans subject to status. XYZ Ltd is authorised by the FCA (123456).",
        bad: "GUARANTEED approval! Get £10,000 instantly! No credit checks! Bad credit? No problem!",
        explanation:
          "Financial ads must use representative APR, cannot guarantee approval, and cannot claim no credit checks if checks are actually performed. The FCA requires clear authorisation disclosure.",
      },
    ],
    videoUrl: "https://www.youtube.com/watch?v=b4_UhkZsGZA",
    videoTitle: "Financial Advertising Compliance",
    tags: [
      "financial-services",
      "loans",
      "credit",
      "investment",
      "cryptocurrency",
      "fca",
    ],
    sortOrder: 4,
  },
  {
    slug: "image-and-creative-guidelines",
    title: "Image & Creative Asset Guidelines",
    summary:
      "Technical requirements and content rules for ad images and videos across Facebook, Instagram, and Google Ads — dimensions, file sizes, text ratios, and prohibited content.",
    content: `## Technical Specifications

### Facebook Feed Ads
- Recommended: 1080 x 1080px (1:1) or 1200 x 628px (1.91:1)
- Minimum: 600 x 600px
- Max file size: 30MB
- Formats: JPG, PNG
- Text on image: Keep below 20% for best delivery

### Instagram Feed
- Square: 1080 x 1080px (1:1)
- Portrait: 1080 x 1350px (4:5) — recommended
- Landscape: 1080 x 566px (1.91:1)
- Stories: 1080 x 1920px (9:16)

### Google Ads (Display)
- Multiple sizes required: 300x250, 728x90, 160x600, 320x50 (minimum)
- Max file size: 150KB
- No animation longer than 30 seconds
- Must have a visible border if background matches page

## Content Rules

- **No misleading before/after images** without clear disclosure
- **No sexually explicit content** — nudity restrictions vary by platform
- **No excessive violence or gore**
- **No misleading play buttons** or fake UI elements
- **No personal attributes** — images should not imply personal characteristics

## Best Practices

- Use high-quality, professional imagery
- Ensure text is readable on all devices
- Test across placements (feed, stories, display)
- Include your brand identity clearly
- Avoid stock photos that look generic`,
    examples: [
      {
        good: "A clean product photo showing the item on a white background with brand logo visible.",
        bad: "A fake 'play button' overlay on an image to trick users into clicking, or a screenshot that mimics a notification alert.",
        explanation:
          "Platforms prohibit deceptive creative elements like fake play buttons, notification badges, or UI elements that mislead users about the ad's functionality. Ads should be clearly identifiable as advertising.",
      },
    ],
    tags: [
      "images",
      "creative",
      "dimensions",
      "technical-specs",
      "design",
    ],
    sortOrder: 5,
  },
];

async function main() {
  // Fetch platform and category IDs for linking
  const platforms = await db.platform.findMany({
    select: { id: true, name: true },
  });
  const categories = await db.category.findMany({
    select: { id: true, name: true, slug: true },
  });

  const findPlatform = (name: string) =>
    platforms.find((p) => p.name.toLowerCase().includes(name.toLowerCase()))?.id ?? null;
  const findCategory = (nameFragment: string) =>
    categories.find((c) => c.name.toLowerCase().includes(nameFragment.toLowerCase()))?.id ?? null;

  // Map articles to platforms/categories
  const mappings: Record<string, { platformId: string | null; categoryId: string | null }> = {
    "meta-alcohol-advertising-policy": {
      platformId: findPlatform("facebook") ?? findPlatform("instagram"),
      categoryId: findCategory("alcohol"),
    },
    "google-ads-healthcare-policy": {
      platformId: findPlatform("google"),
      categoryId: findCategory("health") ?? findCategory("pharma"),
    },
    "gambling-advertising-regulations": {
      platformId: null, // Multi-platform
      categoryId: findCategory("gambling") ?? findCategory("betting"),
    },
    "financial-services-advertising": {
      platformId: null,
      categoryId: findCategory("financial") ?? findCategory("finance"),
    },
    "image-and-creative-guidelines": {
      platformId: null,
      categoryId: null,
    },
  };

  for (const article of articles) {
    const mapping = mappings[article.slug] ?? { platformId: null, categoryId: null };

    await db.policyArticle.upsert({
      where: { slug: article.slug },
      update: {
        title: article.title,
        summary: article.summary,
        content: article.content,
        examples: article.examples ?? undefined,
        videoUrl: article.videoUrl ?? null,
        videoTitle: article.videoTitle ?? null,
        tags: article.tags,
        sortOrder: article.sortOrder,
        platformId: mapping.platformId,
        categoryId: mapping.categoryId,
      },
      create: {
        slug: article.slug,
        title: article.title,
        summary: article.summary,
        content: article.content,
        examples: article.examples ?? undefined,
        videoUrl: article.videoUrl ?? null,
        videoTitle: article.videoTitle ?? null,
        tags: article.tags,
        sortOrder: article.sortOrder,
        published: true,
        platformId: mapping.platformId,
        categoryId: mapping.categoryId,
      },
    });

    console.log(`Upserted: ${article.title}`);
  }

  console.log(`\nDone! ${articles.length} articles seeded.`);
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
