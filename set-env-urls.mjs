import { execSync } from "child_process";

const vars = {
  NEXTAUTH_URL: "https://augurcompliance.com",
  NEXT_PUBLIC_APP_URL: "https://augurcompliance.com",
};

for (const [key, value] of Object.entries(vars)) {
  try {
    console.log(`Setting ${key}=${value} ...`);
    execSync(
      `npx vercel env add ${key} production`,
      { input: value, stdio: ["pipe", "inherit", "inherit"], timeout: 30000 }
    );
    console.log(`  Done.`);
  } catch (e) {
    console.error(`  Failed: ${e.message}`);
  }
}
