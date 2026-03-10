"use client";

import { cn } from "@/lib/utils";

/**
 * Maps category name keywords to inline SVG path data.
 * Each icon is a simple 24x24 viewBox SVG drawn with stroke.
 */

interface CategoryIconProps {
  name: string;
  className?: string;
}

type IconDef = {
  paths: string[];
  fill?: boolean;
};

// keyword → SVG icon mapping (checked in order, first match wins)
const ICON_MAP: [string[], IconDef][] = [
  // ── Alcohol ──
  [["beer"], { paths: ["M17 11v6a2 2 0 01-2 2H9a2 2 0 01-2-2v-6h10zM7 8l1-4h8l1 4M19 11v4a1 1 0 01-1 1h-1"] }],
  [["wine"], { paths: ["M8 22h8M12 17v5M7.5 10.5A5.5 5.5 0 0012 16a5.5 5.5 0 004.5-5.5L15 2H9l-1.5 8.5"] }],
  [["spirits", "whiskey"], { paths: ["M9 2h6v4a3 3 0 01-3 3 3 3 0 01-3-3V2zM12 9v4M8 22h8M12 13a4 4 0 014 4v1a1 1 0 01-1 1H9a1 1 0 01-1-1v-1a4 4 0 014-4z"] }],
  [["alcohol"], { paths: ["M8 22h8M12 17v5M6 10l2-8h8l2 8M6 10a6 6 0 006 7 6 6 0 006-7"] }],

  // ── Tobacco / Nicotine ──
  [["cigarette", "tobacco"], { paths: ["M3 16h14v4H3zM17 16h1.5a1.5 1.5 0 000-3H17M8 16v-3M12 16v-5M3 16l1-10"] }],
  [["cigar", "pipe"], { paths: ["M6 15c0-2 2-3 4-3s4 1 4 3M4 18h16M10 12V6a2 2 0 114 0v6"] }],
  [["vaping", "e-cigarette"], { paths: ["M7 19h10a2 2 0 002-2v-2a2 2 0 00-2-2H7a2 2 0 00-2 2v2a2 2 0 002 2zM9 13V8a3 3 0 016 0v5M12 5V3"] }],
  [["nicotine"], { paths: ["M16 4a4 4 0 01-4 4 4 4 0 01-4-4M4 14h16M8 14v6M16 14v6M12 14v6"] }],

  // ── Pharma / Health ──
  [["prescription"], { paths: ["M9 3h6v4H9zM5 7h14v14H5zM9 14h6M12 11v6"] }],
  [["over-the-counter", "otc"], { paths: ["M10 2h4v5h-4zM6 7h12a1 1 0 011 1v12a1 1 0 01-1 1H6a1 1 0 01-1-1V8a1 1 0 011-1zM9 12h6M12 14v4"] }],
  [["medical device"], { paths: ["M12 4v4M8 6h8M7 12h10M5 8l2 12h10l2-12M10 14v4M14 14v4"] }],
  [["supplement", "dietary"], { paths: ["M9 2h6v3H9zM7 5h10v4H7zM8 9l-1 13h10l-1-13M12 12v6"] }],
  [["weight loss"], { paths: ["M12 2a10 10 0 110 20 10 10 0 010-20M12 6v6l4 2"] }],
  [["pharmacy", "pharmacies"], { paths: ["M3 7h18v14H3zM9 12h6M12 9v6M7 3h10v4H7z"] }],
  [["stem cell", "experimental"], { paths: ["M12 2a4 4 0 014 4c0 3-4 5-4 8-1-3-4-5-4-8a4 4 0 014-4zM8 18a4 4 0 008 0M12 14v4"] }],
  [["mental health"], { paths: ["M12 2a8 8 0 018 8c0 6-8 12-8 12S4 16 4 10a8 8 0 018-8zM9 10h6M12 7v6"] }],
  [["fertility"], { paths: ["M12 8a4 4 0 100-8 4 4 0 000 8zM8 12a4 4 0 014 4 4 4 0 014-4M12 16v6"] }],
  [["cosmetic surgery", "aesthetic"], { paths: ["M6 4l2 4M18 4l-2 4M8 8a8 8 0 008 0M6 14c2 4 10 4 12 0M12 14v8"] }],
  [["rehabilitation", "rehab"], { paths: ["M12 2v4M4 10a8 8 0 0016 0M8 14v4M16 14v4M12 10v8M8 22h8"] }],
  [["healthcare", "health service"], { paths: ["M9 3h6v5H9zM4 8h16v13H4zM9 14h6M12 11v6"] }],

  // ── Cannabis ──
  [["cbd"], { paths: ["M12 2c-3 4-8 6-8 12a8 8 0 0016 0c0-6-5-8-8-12M12 8v14M8 12l4 2 4-2"] }],
  [["cannabis", "thc"], { paths: ["M12 2c-3 4-8 6-8 12a8 8 0 0016 0c0-6-5-8-8-12M12 22V10M7 14h10"] }],

  // ── Gambling ──
  [["casino", "gambling"], { paths: ["M4 4h16v16H4zM8 8v.01M16 8v.01M12 12v.01M8 16v.01M16 16v.01"] }],
  [["sports betting", "betting"], { paths: ["M12 2L3 7v10l9 5 9-5V7l-9-5zM12 22V12M3 7l9 5 9-5"] }],
  [["lottery", "sweepstakes"], { paths: ["M6 3h12l-2 7H8L6 3zM4 14h16M8 10v12M16 10v12M12 10v12"] }],
  [["fantasy sport"], { paths: ["M12 2l3 6h6l-5 4 2 6-6-4-6 4 2-6-5-4h6z"] }],

  // ── Finance ──
  [["cryptocurrency", "nft", "crypto"], { paths: ["M9 8h4l2 4-2 4H9l-2-4 2-4zM12 2v4M12 18v4M4 12h4M16 12h4"] }],
  [["loan", "credit product", "payday", "lending"], { paths: ["M3 6h18v12H3zM7 12h4M15 10v4M7 15h10"] }],
  [["debt relief", "credit repair", "debt collection"], { paths: ["M3 3l18 18M8 4h8a4 4 0 010 8h-3M8 12H4a4 4 0 000 8h8"] }],
  [["investment", "trading"], { paths: ["M3 20l5-8 4 4 5-10 4 6M3 20h18"] }],
  [["insurance"], { paths: ["M12 2l8 4v6c0 5-3 10-8 12-5-2-8-7-8-12V6l8-4zM9 12l2 2 4-4"] }],
  [["financial service", "financial"], { paths: ["M3 21h18M5 21V7l7-4 7 4v14M9 10h6M9 14h6M9 18h6"] }],
  [["mortgage"], { paths: ["M3 21h18M5 21V10l7-7 7 7v11M10 21v-6h4v6"] }],

  // ── Legal ──
  [["immigration"], { paths: ["M4 4h16v2H4zM6 6v14h12V6M9 2v2M15 2v2M9 10h6M9 14h4"] }],
  [["personal injury"], { paths: ["M12 8a4 4 0 100-8 4 4 0 000 8zM16 14l4 8M8 14l-4 8M12 8v14"] }],
  [["legal service", "legal"], { paths: ["M12 3l9 4v2H3V7l9-4zM5 9v10M19 9v10M3 19h18v2H3zM9 9v10M15 9v10"] }],
  [["bail bond"], { paths: ["M12 2a8 8 0 018 8c0 3-2 6-4 8l-4 4-4-4c-2-2-4-5-4-8a8 8 0 018-8zM9 10h6"] }],

  // ── Tech / Privacy ──
  [["vpn", "privacy software"], { paths: ["M12 2a4 4 0 014 4v2H8V6a4 4 0 014-4zM5 10h14v10H5zM12 14v3"] }],
  [["surveillance", "tracking"], { paths: ["M12 5a7 7 0 017 7M12 1a11 11 0 0111 11M2 12a10 10 0 0110-10M12 12v.01"] }],
  [["cybersecurity", "hacking"], { paths: ["M4 6h16v12H4zM8 2v4M16 2v4M7 13l3 3 7-7"] }],
  [["software", "app"], { paths: ["M4 4h16v16H4zM4 8h16M8 4v4"] }],
  [["smart home", "iot"], { paths: ["M3 12l9-9 9 9M5 10v10h14V10M10 20v-6h4v6"] }],

  // ── Adult / Dating ──
  [["adult content", "pornography"], { paths: ["M12 2a10 10 0 110 20 10 10 0 010-20M4.93 4.93l14.14 14.14"] }],
  [["dating"], { paths: ["M12 4C8 0 2 4 2 9c0 6 10 13 10 13s10-7 10-13c0-5-6-9-10-5z"] }],

  // ── Weapons ──
  [["firearm", "ammunition"], { paths: ["M3 14l5-5h6l3-3v4l-3 3v6l-5 1-1-5-5-1z"] }],
  [["knife", "bladed"], { paths: ["M14.5 2L6 10.5V16h5.5L20 7.5 14.5 2zM3 20l3-3M10 14l-4 4"] }],
  [["explosive", "pyrotechnic", "firework"], { paths: ["M12 13a5 5 0 100-10 5 5 0 000 10zM12 13v9M7 3l2 3M17 3l-2 3M5 8l3 1M19 8l-3 1"] }],
  [["weapon", "hunting"], { paths: ["M4 20L20 4M17 4h3v3M9 15l-5 5M15 9l5-5"] }],

  // ── Political ──
  [["political"], { paths: ["M3 21h18M5 21V10h4v11M10 21V6h4v15M15 21V3h4v18"] }],
  [["electoral", "voter"], { paths: ["M9 11l3 3 8-8M4 4h16v16H4z"] }],
  [["social issue"], { paths: ["M17 21v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2M9 7a4 4 0 108 0 4 4 0 00-8 0M23 21v-2a4 4 0 00-3-4M16 3a4 4 0 010 8"] }],

  // ── HFSS ──
  [["sugary snack", "confectionery"], { paths: ["M8 2h8l1 5H7l1-5zM6 10a6 6 0 0012 0M7 7h10v3H7zM10 13v7M14 13v7M8 22h8"] }],
  [["fast food", "qsr"], { paths: ["M3 14h18M5 14l1-6h12l1 6M8 14v4M16 14v4M6 18h12v2H6zM10 4h4v4h-4z"] }],
  [["energy drink"], { paths: ["M8 2h4l-1 7h4L9 22l1-8H6l2-12z"] }],
  [["sugary soft drink", "soft drink"], { paths: ["M9 2h6v3H9zM8 5h8v3H8zM7 8h10l-1 14H8L7 8zM11 12v5M13 11v5"] }],
  [["infant formula", "baby food"], { paths: ["M9 2h6l1 4H8l1-4zM7 6h10v3H7zM8 9l-1 13h10L16 9M12 12v5"] }],
  [["hfss"], { paths: ["M3 3h18v18H3zM7 8h10M7 12h10M7 16h6"] }],

  // ── Real Estate ──
  [["real estate"], { paths: ["M3 21h18M5 21V10l7-7 7 7v11M10 21v-6h4v6M3 10h18"] }],

  // ── Food & Beverage ──
  [["restaurant", "dining"], { paths: ["M3 7h18M6 7V4M12 7V2M18 7V4M5 7l1 15h12l1-15"] }],
  [["grocery", "supermarket"], { paths: ["M6 2h12l2 6H4l2-6zM4 8h16v12H4zM9 12v4M15 12v4"] }],
  [["healthy food", "nutrition", "organic", "natural food"], { paths: ["M12 2a8 8 0 00-8 8c0 3 2 6 4 8l4 4 4-4c2-2 4-5 4-8a8 8 0 00-8-8zM12 6v8M8 10h8"] }],
  [["non-alcoholic", "coffee", "hot drink", "bakery"], { paths: ["M8 20h8M10 20v-4M14 20v-4M6 10h12M7 6h10l1 4v2a6 6 0 01-12 0v-2l1-4zM18 10h2a2 2 0 010 4h-2"] }],
  [["food", "beverage"], { paths: ["M3 11h18M5 11V8a7 7 0 0114 0v3M4 11l1 11h14l1-11M12 15v3"] }],

  // ── Fashion ──
  [["footwear", "shoe"], { paths: ["M4 16c0-3 2-6 5-8l3-2 3 2c3 2 5 5 5 8v2H4v-2zM8 16h8"] }],
  [["jewellery", "jewelry", "accessori"], { paths: ["M12 2l2 6h6l-5 4 2 6-5-4-5 4 2-6-5-4h6z"] }],
  [["watch", "luxury"], { paths: ["M12 6a6 6 0 100 12 6 6 0 000-12zM12 2v4M12 18v4M9 2h6M9 22h6M12 8v4l2 2"] }],
  [["sportswear", "activewear"], { paths: ["M12 2l-4 6h8l-4-6zM6 14h12M8 8l-4 6v8h16v-8l-4-6"] }],
  [["children's clothing"], { paths: ["M8 2h8l1 5H7l1-5zM7 7h10v15H7zM10 7v15M14 7v15M7 14h10"] }],
  [["sustainable", "ethical"], { paths: ["M12 2c-4 0-8 4-8 8 0 6 8 12 8 12s8-6 8-12c0-4-4-8-8-8zM9 12l2 2 4-4"] }],
  [["fashion", "clothing"], { paths: ["M6.5 2H10l2 3 2-3h3.5L20 8l-3 2v12H7V10L4 8l2.5-6z"] }],

  // ── Travel ──
  [["hotel", "accommodation"], { paths: ["M3 21h18M5 21V7l7-4 7 4v14M9 10h6v5H9zM12 21v-6"] }],
  [["airline", "flight"], { paths: ["M2 12l5-3 5 3 5-3 5 3M4 15l8-3 8 3M12 12v10"] }],
  [["package holiday", "tour"], { paths: ["M4 8h16v12H4zM8 4v4M16 4v4M4 12h16M9 16h6"] }],
  [["car hire", "vehicle rental"], { paths: ["M5 17h14M6 17l1-5h10l1 5M8 12l1-4h6l1 4M7 17v2M17 17v2M9 14h.01M15 14h.01"] }],
  [["cruise"], { paths: ["M3 17l2-2c2-2 5-2 7 0s5 2 7 0l2-2M4 13l1-6h14l1 6M8 7V4M16 7V4"] }],
  [["travel accessor", "luggage"], { paths: ["M7 4h10v16H7zM10 2h4v2h-4zM10 8h4M10 12h4M7 20v2M17 20v2"] }],
  [["travel", "holiday"], { paths: ["M12 2a10 10 0 110 20 10 10 0 010-20M2 12h20M12 2c3 3 5 7 5 10s-2 7-5 10M12 2c-3 3-5 7-5 10s2 7 5 10"] }],

  // ── Beauty ──
  [["skincare"], { paths: ["M9 2h6v4H9zM7 6h10v4H7zM8 10l-1 12h10l-1-12M12 13v5"] }],
  [["haircare", "hair colour"], { paths: ["M12 2c-4 0-6 3-6 6 0 2 1 4 3 5v9h6v-9c2-1 3-3 3-5 0-3-2-6-6-6z"] }],
  [["fragrance", "perfume"], { paths: ["M10 4h4v3h-4zM8 7h8l1 3H7l1-3zM7 10l-1 12h12l-1-12M10 2h4M12 10v8"] }],
  [["makeup", "cosmetic"], { paths: ["M8 2h2v8H8zM14 2h2v8h-2zM6 10h12v3H6zM7 13l-1 9h12l-1-9"] }],
  [["men's grooming", "grooming"], { paths: ["M8 3h8v5H8zM6 8h12l1 14H5l1-14zM10 12v5M14 12v5"] }],
  [["beauty", "personal care"], { paths: ["M12 2c-4 0-7 3-7 7 0 3 2 5 4 6v7h6v-7c2-1 4-3 4-6 0-4-3-7-7-7z"] }],

  // ── Home & Garden ──
  [["furniture", "home decor", "décor"], { paths: ["M4 12h16v8H4zM6 8h12v4H6zM8 20v2M16 20v2"] }],
  [["home improvement", "diy"], { paths: ["M14 2l8 8-10 10L4 12l10-10zM4 12l-2 10 10-2M14.5 5.5l4 4"] }],
  [["garden", "plant"], { paths: ["M12 22V12M12 8c-4 0-6-3-6-6 0 4 2 6 6 6zM12 8c4 0 6-3 6-6 0 4-2 6-6 6zM8 14c-3 0-5-2-5-5 3 0 5 2 5 5zM16 14c3 0 5-2 5-5-3 0-5 2-5 5z"] }],
  [["cleaning", "household"], { paths: ["M10 2h4v6h-4zM7 8h10l-1 14H8L7 8zM12 11v7"] }],
  [["kitchen", "cookware"], { paths: ["M3 14h18v2H3zM5 16v4a2 2 0 002 2h10a2 2 0 002-2v-4M8 10V6a4 4 0 018 0v4"] }],
  [["bedding", "textile"], { paths: ["M3 10h18v12H3zM3 10l3-6h12l3 6M8 10v12M16 10v12"] }],
  [["home", "garden"], { paths: ["M3 12l9-9 9 9M5 10v10h14V10M10 20v-6h4v6"] }],

  // ── Electronics ──
  [["mobile phone", "phone accessor"], { paths: ["M8 2h8a1 1 0 011 1v18a1 1 0 01-1 1H8a1 1 0 01-1-1V3a1 1 0 011-1zM12 18h.01"] }],
  [["computer", "laptop"], { paths: ["M4 4h16v12H4zM2 20h20M12 16v4"] }],
  [["gaming", "video game"], { paths: ["M6 11h4M8 9v4M15 12h.01M18 10h.01M4 15l1.5-8A2 2 0 017.5 5h9a2 2 0 012 1.7L20 15a3 3 0 01-6 0 3 3 0 01-4 0 3 3 0 01-6 0z"] }],
  [["camera", "photography equip"], { paths: ["M3 8h2l2-3h10l2 3h2v12H3V8zM12 11a3 3 0 100 6 3 3 0 000-6z"] }],
  [["consumer electronic", "electronic"], { paths: ["M4 3h16v14H4zM2 20h20M9 17l-1 3M15 17l1 3M9 20h6"] }],

  // ── Automotive ──
  [["car sale", "car leasing"], { paths: ["M5 17h14M6 17l1-5h10l1 5M8 12l1-5h6l1 5M7 17v2M17 17v2M9 14h.01M15 14h.01"] }],
  [["car accessor"], { paths: ["M5 16h14l1-5H4l1 5zM7 11l1-5h8l1 5M7 16v3M17 16v3M9 13h.01M15 13h.01"] }],
  [["electric vehicle"], { paths: ["M5 17h14M6 17l1-5h10l1 5M8 12l1-5h6l1 5M13 6l-2 4h4l-2 4"] }],
  [["motorbike", "scooter"], { paths: ["M5 18a3 3 0 100-6 3 3 0 000 6zM19 18a3 3 0 100-6 3 3 0 000 6zM8 15l3-7h4l2 3M14 8l3 4"] }],
  [["automotive", "car"], { paths: ["M5 17h14M6 17l1-5h10l1 5M8 12l1-4h6l1 4M7 17v2M17 17v2"] }],

  // ── Sports ──
  [["cycling", "bicycle"], { paths: ["M6 18a4 4 0 100-8 4 4 0 000 8zM18 18a4 4 0 100-8 4 4 0 000 8zM6 14l4-8h4l4 8M10 6l4 8"] }],
  [["water sport", "swimming"], { paths: ["M3 17c1-1 2-2 4-2s3 2 5 2 3-1 5-2 2-1 4 0M3 21c1-1 2-2 4-2s3 2 5 2 3-1 5-2 2-1 4 0M8 7a4 4 0 108 0"] }],
  [["team sport", "ball sport"], { paths: ["M12 2a10 10 0 110 20 10 10 0 010-20M12 2v20M2 12h20M4.5 5.5c2 2 5 3 7.5 3s5.5-1 7.5-3M4.5 18.5c2-2 5-3 7.5-3s5.5 1 7.5 3"] }],
  [["gym", "fitness class"], { paths: ["M3 12h3M18 12h3M6 8v8M18 8v8M6 12h12M9 6v12M15 6v12"] }],
  [["sport", "fitness equip", "outdoor", "adventure"], { paths: ["M4 20l4-8 4 4 4-8 4 8M12 8a3 3 0 100-6 3 3 0 000 6z"] }],

  // ── Entertainment ──
  [["streaming", "media service"], { paths: ["M4 4h16v12H4zM10 10l5 2-5 2V10zM2 20h20"] }],
  [["book", "publishing"], { paths: ["M4 4h6a2 2 0 012 2v14a1 1 0 00-1-1H4V4zM20 4h-6a2 2 0 00-2 2v14a1 1 0 011-1h7V4z"] }],
  [["music", "instrument"], { paths: ["M9 18V5l12-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zM21 16a3 3 0 11-6 0 3 3 0 016 0z"] }],
  [["film", "cinema"], { paths: ["M4 4h16v16H4zM4 8h16M4 12h16M4 16h16M8 4v16M16 4v16"] }],
  [["hobby", "craft"], { paths: ["M12 2L2 12h3v8h6v-5h2v5h6v-8h3L12 2z"] }],
  [["entertainment", "event"], { paths: ["M8 2l4 4 4-4M4 8h16v12H4zM8 14h8M8 18h4"] }],

  // ── Children ──
  [["toy", "children's game"], { paths: ["M12 2a4 4 0 014 4 4 4 0 01-4 4 4 4 0 01-4-4 4 4 0 014-4zM8 10l-4 12h16l-4-12M10 16h4"] }],
  [["baby", "infant product"], { paths: ["M12 2a5 5 0 015 5v2H7V7a5 5 0 015-5zM6 9h12v4a6 6 0 01-12 0V9zM12 17v5M8 22h8"] }],
  [["children's education", "learning"], { paths: ["M2 7l10-4 10 4M4 9v6l8 4 8-4V9M12 22v-9"] }],

  // ── Education ──
  [["online learning", "course"], { paths: ["M4 4h16v12H4zM2 20h20M9 8l3 2 3-2M12 10v4"] }],
  [["school", "university", "universities"], { paths: ["M2 7l10-4 10 4-10 4-10-4zM6 9v8l6 3 6-3V9M12 13v9"] }],

  // ── Pets ──
  [["pet food", "pet treat"], { paths: ["M9 2h6v3H9zM7 5h10l1 17H6l1-17zM10 10v5M14 10v5"] }],
  [["pet accessor", "pet toy"], { paths: ["M12 8a4 4 0 110-8 4 4 0 010 8zM8 7l-4 3v3l4 3M16 7l4 3v3l-4 3M12 8v14M8 22h8"] }],
  [["veterinary", "pet health"], { paths: ["M9 3h6v4H9zM4 7h16v14H4zM9 12h6M12 9v6"] }],
  [["pet"], { paths: ["M12 10a4 4 0 110-8 4 4 0 010 8zM6 8C3 8 2 10 2 12s2 4 4 4M18 8c3 0 4 2 4 4s-2 4-4 4M8 16c0 3 2 6 4 6s4-3 4-6"] }],

  // ── Services ──
  [["professional service"], { paths: ["M4 4h16v16H4zM8 8h8M8 12h8M8 16h4"] }],
  [["charity", "non-profit"], { paths: ["M12 4c-4-4-10 0-10 5 0 6 10 13 10 13s10-7 10-13c0-5-6-9-10-5z"] }],
  [["wedding", "event"], { paths: ["M12 2a4 4 0 014 4v2a4 4 0 01-8 0V6a4 4 0 014-4zM8 12h8l2 10H6l2-10"] }],
  [["cleaning service", "home service"], { paths: ["M12 2v8M6 8l6-2 6 2M8 10l-4 12h16l-4-12"] }],
  [["stationery", "office suppli"], { paths: ["M4 4h10v18H4zM14 4h6v18h-6zM7 8h4M7 12h4M7 16h2"] }],
  [["printing", "signage"], { paths: ["M6 2h12v6H6zM4 8h16v8H4zM6 16v6h12v-6M8 12h.01"] }],
  [["photography service", "videography"], { paths: ["M3 7h2l2-3h10l2 3h2v13H3V7zM12 10a3 3 0 100 6 3 3 0 000-6z"] }],

  // ── Misc regulated ──
  [["counterfeit", "replica"], { paths: ["M12 2a10 10 0 110 20 10 10 0 010-20M4.93 4.93l14.14 14.14M8 12h8M12 8v8"] }],
  [["mlm", "multi-level"], { paths: ["M12 2l-8 8h16l-8-8zM4 10v10h16V10M12 10v10M8 15h8"] }],
  [["business opportunity"], { paths: ["M12 2l8 10H4l8-10zM4 12v8h16v-8M8 16h8"] }],
  [["subscription trap", "negative option"], { paths: ["M12 2a10 10 0 110 20 10 10 0 010-20M12 6v6l4 2M12 16v.01"] }],
  [["funeral", "bereavement"], { paths: ["M12 2v6M9 4h6M6 10h12l-1 12H7l-1-12zM10 14v5M14 14v5"] }],
  [["psychic", "astrology", "occult"], { paths: ["M12 2l2 6h6l-5 4 2 6-5-4-5 4 2-6-5-4h6l2-6z"] }],
  [["hypnosis"], { paths: ["M12 2a10 10 0 110 20 10 10 0 010-20M12 7a5 5 0 110 10 5 5 0 010-10M12 10a2 2 0 110 4 2 2 0 010-4"] }],
  [["drug paraphernalia"], { paths: ["M12 2a10 10 0 110 20 10 10 0 010-20M4.93 4.93l14.14 14.14"] }],
  [["ringtone", "subscription media"], { paths: ["M8 2h8a1 1 0 011 1v18a1 1 0 01-1 1H8a1 1 0 01-1-1V3a1 1 0 011-1zM9 6h6M9 18h6"] }],
  [["telemarketing", "robo-call"], { paths: ["M5 4h4l2 5-3 2a11 11 0 005 5l2-3 5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"] }],
  [["penny auction"], { paths: ["M12 2a10 10 0 110 20 10 10 0 010-20M8 12h8M12 8v8"] }],
  [["online trading school", "trading school"], { paths: ["M4 4h16v12H4zM3 20h18M8 8l4 4 4-4M8 12h8"] }],
  [["cosmetic", "medical claim"], { paths: ["M12 2c-4 0-7 3-7 7 0 2 1 4 3 5v8h8v-8c2-1 3-3 3-5 0-4-3-7-7-7zM9 14h6"] }],
];

function getIconDef(name: string): IconDef | null {
  const lower = name.toLowerCase();
  for (const [keywords, def] of ICON_MAP) {
    if (keywords.some((k) => lower.includes(k))) {
      return def;
    }
  }
  return null;
}

export function CategoryIcon({ name, className }: CategoryIconProps) {
  const def = getIconDef(name);

  if (!def) {
    // Fallback: generic tag icon
    return (
      <svg
        className={cn("h-4 w-4 shrink-0", className)}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
        <circle cx="7" cy="7" r="1" />
      </svg>
    );
  }

  return (
    <svg
      className={cn("h-4 w-4 shrink-0", className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {def.paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

/**
 * Returns a Tailwind text color class based on category name keywords.
 * Used to tint the icon for visual distinction between groups.
 */
export function getCategoryColor(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("alcohol")) return "text-amber-600";
  if (lower.includes("tobacco") || lower.includes("nicotine") || lower.includes("vaping") || lower.includes("cigarette")) return "text-stone-500";
  if (lower.includes("pharma") || lower.includes("prescription") || lower.includes("medication") || lower.includes("medical") || lower.includes("health")) return "text-red-500";
  if (lower.includes("cannabis") || lower.includes("cbd") || lower.includes("thc")) return "text-green-600";
  if (lower.includes("gambling") || lower.includes("casino") || lower.includes("betting") || lower.includes("lottery") || lower.includes("fantasy")) return "text-purple-500";
  if (lower.includes("financial") || lower.includes("loan") || lower.includes("credit") || lower.includes("investment") || lower.includes("insurance") || lower.includes("mortgage") || lower.includes("debt") || lower.includes("crypto")) return "text-emerald-600";
  if (lower.includes("legal") || lower.includes("immigration") || lower.includes("injury") || lower.includes("bail")) return "text-indigo-500";
  if (lower.includes("weapon") || lower.includes("firearm") || lower.includes("knife") || lower.includes("explosive") || lower.includes("hunting") || lower.includes("firework")) return "text-red-700";
  if (lower.includes("political") || lower.includes("electoral") || lower.includes("social issue")) return "text-blue-700";
  if (lower.includes("adult") || lower.includes("dating") || lower.includes("pornography")) return "text-pink-500";
  if (lower.includes("hfss") || lower.includes("sugary") || lower.includes("fast food") || lower.includes("energy drink") || lower.includes("infant formula") || lower.includes("baby food")) return "text-orange-500";
  if (lower.includes("food") || lower.includes("restaurant") || lower.includes("grocery") || lower.includes("nutrition") || lower.includes("beverage") || lower.includes("coffee") || lower.includes("bakery")) return "text-orange-600";
  if (lower.includes("fashion") || lower.includes("clothing") || lower.includes("footwear") || lower.includes("jewel") || lower.includes("watch") || lower.includes("luxury") || lower.includes("sportswear")) return "text-pink-600";
  if (lower.includes("travel") || lower.includes("hotel") || lower.includes("airline") || lower.includes("cruise") || lower.includes("holiday") || lower.includes("tour") || lower.includes("luggage")) return "text-sky-500";
  if (lower.includes("beauty") || lower.includes("skincare") || lower.includes("haircare") || lower.includes("fragrance") || lower.includes("makeup") || lower.includes("cosmetic") || lower.includes("grooming")) return "text-rose-500";
  if (lower.includes("home") || lower.includes("furniture") || lower.includes("garden") || lower.includes("kitchen") || lower.includes("cleaning") || lower.includes("bedding") || lower.includes("diy")) return "text-teal-500";
  if (lower.includes("electronic") || lower.includes("phone") || lower.includes("computer") || lower.includes("laptop") || lower.includes("gaming") || lower.includes("camera") || lower.includes("software") || lower.includes("smart home")) return "text-slate-600";
  if (lower.includes("automotive") || lower.includes("car") || lower.includes("vehicle") || lower.includes("motorbike") || lower.includes("scooter")) return "text-zinc-600";
  if (lower.includes("sport") || lower.includes("fitness") || lower.includes("cycling") || lower.includes("swimming") || lower.includes("gym") || lower.includes("outdoor") || lower.includes("adventure")) return "text-lime-600";
  if (lower.includes("entertainment") || lower.includes("streaming") || lower.includes("music") || lower.includes("film") || lower.includes("book") || lower.includes("hobby")) return "text-violet-500";
  if (lower.includes("pet") || lower.includes("veterinary")) return "text-amber-500";
  if (lower.includes("child") || lower.includes("baby") || lower.includes("toy") || lower.includes("infant")) return "text-cyan-500";
  if (lower.includes("education") || lower.includes("school") || lower.includes("university") || lower.includes("learning") || lower.includes("course")) return "text-blue-500";
  if (lower.includes("charity") || lower.includes("non-profit")) return "text-green-500";
  if (lower.includes("real estate")) return "text-stone-600";
  if (lower.includes("vpn") || lower.includes("privacy") || lower.includes("surveillance") || lower.includes("cybersecurity")) return "text-gray-600";
  return "text-slate-500";
}
