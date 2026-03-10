import { execSync } from "child_process";
import { readFileSync } from "fs";

const envText = readFileSync(".env.local", "utf8");

// Parse .env.local, stripping quotes
const vars = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.+)$/);
  if (!m) continue;
  let val = m[2].trim();
  // Strip surrounding quotes
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  vars[m[1]] = val;
}

// Skip seed-only vars
const skip = new Set(["SEED_ADMIN_USERNAME", "SEED_ADMIN_PASSWORD"]);

// Override NEXTAUTH_URL and NEXT_PUBLIC_APP_URL to production domain
vars["NEXTAUTH_URL"] = "https://augurcompliance.com";
vars["NEXT_PUBLIC_APP_URL"] = "https://augurcompliance.com";

for (const [key, value] of Object.entries(vars)) {
  if (skip.has(key)) continue;

  // Remove existing
  try {
    console.log(`Removing ${key}...`);
    execSync(`npx vercel env rm ${key} production -y`, {
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 30000,
    });
  } catch {
    // may not exist
  }

  // Add clean value
  try {
    console.log(`Setting ${key} (${value.length} chars)...`);
    execSync(`npx vercel env add ${key} production`, {
      input: value,
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 30000,
    });
    console.log(`  OK`);
  } catch (e) {
    console.error(`  FAILED: ${e.message}`);
  }
}

console.log("\nDone. Run: npx vercel --prod");
