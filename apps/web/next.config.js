import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);

// Import env files to validate at build time. Use jiti so we can load .ts files in here.
await jiti.import("./src/env");

/** @type {import("next").NextConfig} */
const config = {
  /** Static HTML export for S3 + CloudFront (no OpenNext / Node server in AWS for this app) */
  output: "export",

  poweredByHeader: false,

  transpilePackages: ["@arlequins/trpc", "@arlequins/ui"],

  trailingSlash: true,

  images: {
    unoptimized: true,
  },

  /**
   * Let `next build` fail on TypeScript errors (in addition to `pnpm typecheck` in CI).
   * Set to `true` only if you need to unblock a build while fixing types separately.
   */
  typescript: { ignoreBuildErrors: false },
};

export default config;
