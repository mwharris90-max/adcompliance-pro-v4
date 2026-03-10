import type { NextConfig } from "next";
import { execSync } from "child_process";
import { withSentryConfig } from "@sentry/nextjs";

// Capture build-time version info and expose to the client
let NEXT_PUBLIC_GIT_HASH = "dev";
let NEXT_PUBLIC_BUILD_TIME = new Date().toISOString();
try {
  NEXT_PUBLIC_GIT_HASH = execSync("git rev-parse --short HEAD").toString().trim();
  // Use the commit timestamp rather than the build clock so it matches the git log
  NEXT_PUBLIC_BUILD_TIME = execSync('git log -1 --format=%cI').toString().trim();
} catch {
  // Not a git repo or git not available — fall back to build clock
}

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_GIT_HASH,
    NEXT_PUBLIC_BUILD_TIME,
  },
  serverExternalPackages: ["@react-pdf/renderer", "puppeteer-core"],
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true, // suppress CLI output in CI
  disableLogger: true,
  automaticVercelMonitors: false,
});
