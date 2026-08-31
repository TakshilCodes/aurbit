import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import { withSentryConfig } from "@sentry/nextjs";
import { fileURLToPath } from "node:url";

initOpenNextCloudflareForDev();

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: fileURLToPath(new URL("../../", import.meta.url)),
  outputFileTracingIncludes: {
    // Node tracing selects pg-cloudflare's empty stub; OpenNext needs the workerd files.
    "/*": [
      "../../node_modules/.pnpm/pg-cloudflare@*/node_modules/pg-cloudflare/dist/**/*.js",
      "../../node_modules/.pnpm/pg-cloudflare@*/node_modules/pg-cloudflare/esm/**/*.mjs",
    ],
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  silent: true,
  telemetry: false,
});
