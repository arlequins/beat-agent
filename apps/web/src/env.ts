import {
  DEFAULT_LOCALHOST_API_URL,
  DEFAULT_LOCALHOST_SITE_URL,
} from "@arlequins/env/public-defaults";
import { skipEnvValidation } from "@arlequins/env/skip-validation";
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod/v4";

/**
 * Public env for the Next.js client bundle. Do **not** import `serverEnv` here — it runs in the browser
 * and must only use `NEXT_PUBLIC_*` via `process.env` (inlined at build) plus shared defaults from `@arlequins/env/public-defaults`.
 *
 * `serverEnv` in `@arlequins/env` stays aligned with the same default URLs for SST / tooling.
 */
export const env = createEnv({
  shared: {
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
  },
  server: {},
  client: {
    NEXT_PUBLIC_SITE_URL: z.preprocess(
      (v) =>
        typeof v === "string" && v.trim().length > 0
          ? v
          : DEFAULT_LOCALHOST_SITE_URL,
      z.url(),
    ),
    NEXT_PUBLIC_API_URL: z.preprocess(
      (v) =>
        typeof v === "string" && v.trim().length > 0
          ? v
          : DEFAULT_LOCALHOST_API_URL,
      z.url(),
    ),
    NEXT_PUBLIC_OIDC_AUTHORITY: z.url(),
    NEXT_PUBLIC_OIDC_CLIENT_ID: z.string().min(1),
    NEXT_PUBLIC_OIDC_RESOURCE: z.url().optional(),
    NEXT_PUBLIC_OIDC_SCOPE: z
      .string()
      .min(1)
      .refine((scope) => scope.split(/\s+/).includes("openid"), {
        message: "OIDC scope must include openid",
      }),
  },
  experimental__runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_OIDC_AUTHORITY: process.env.NEXT_PUBLIC_OIDC_AUTHORITY,
    NEXT_PUBLIC_OIDC_CLIENT_ID: process.env.NEXT_PUBLIC_OIDC_CLIENT_ID,
    NEXT_PUBLIC_OIDC_RESOURCE: process.env.NEXT_PUBLIC_OIDC_RESOURCE,
    NEXT_PUBLIC_OIDC_SCOPE: process.env.NEXT_PUBLIC_OIDC_SCOPE,
  },
  skipValidation: skipEnvValidation,
});
