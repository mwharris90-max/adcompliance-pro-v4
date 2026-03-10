import { execSync } from "child_process";
import { readFileSync } from "fs";

const envContent = readFileSync(".env.local", "utf8");
const lines = envContent.split("\n").filter(l => l.trim() && !l.startsWith("#"));

for (const line of lines) {
  const eqIdx = line.indexOf("=");
  if (eqIdx === -1) continue;
  const key = line.slice(0, eqIdx).trim();
  const value = line.slice(eqIdx + 1).trim();
  
  // Skip NEXTAUTH_URL as it should be the production URL
  if (key === "NEXTAUTH_URL") continue;
  // Skip seed credentials
  if (key.startsWith("SEED_")) continue;
  
  console.log(`Setting ${key}...`);
  try {
    execSync(`echo "${value}" | npx vercel env add ${key} production`, {
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 15000,
    });
    console.log(`  OK`);
  } catch (e) {
    // Try removing first then re-adding
    try {
      execSync(`npx vercel env rm ${key} production -y`, { stdio: "pipe", timeout: 10000 });
      execSync(`echo "${value}" | npx vercel env add ${key} production`, { stdio: "pipe", timeout: 15000 });
      console.log(`  OK (replaced)`);
    } catch (e2) {
      console.log(`  FAILED: ${e2.message?.slice(0, 80)}`);
    }
  }
}

// Set NEXTAUTH_URL to production URL
console.log("Setting NEXTAUTH_URL...");
try {
  execSync(`echo "https://adcompliancepro.com" | npx vercel env add NEXTAUTH_URL production`, { stdio: "pipe", timeout: 15000 });
  console.log("  OK");
} catch (e) {
  try {
    execSync(`npx vercel env rm NEXTAUTH_URL production -y`, { stdio: "pipe", timeout: 10000 });
    execSync(`echo "https://adcompliancepro.com" | npx vercel env add NEXTAUTH_URL production`, { stdio: "pipe", timeout: 15000 });
    console.log("  OK (replaced)");
  } catch (e2) {
    console.log(`  FAILED`);
  }
}

// Set NEXT_PUBLIC_APP_URL
console.log("Setting NEXT_PUBLIC_APP_URL...");
try {
  execSync(`npx vercel env rm NEXT_PUBLIC_APP_URL production -y`, { stdio: "pipe", timeout: 10000 });
} catch {}
try {
  execSync(`echo "https://adcompliancepro.com" | npx vercel env add NEXT_PUBLIC_APP_URL production`, { stdio: "pipe", timeout: 15000 });
  console.log("  OK");
} catch {
  console.log("  FAILED");
}

console.log("\nDone!");
