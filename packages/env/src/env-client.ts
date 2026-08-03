import { createEnv } from "@t3-oss/env-core";
import { z } from "zod/v4";

import {
  DEFAULT_LOCALHOST_API_URL,
  DEFAULT_LOCALHOST_SITE_URL,
} from "./public-defaults.js";
import { skipEnvValidation } from "./skip-validation.js";

/**
 * Next.js / Vite `NEXT_PUBLIC_*` (browser-inlined at build). Kept separate from {@link serverEnv}.
 * Use for SST `StaticSite.environment`, etc. — not for secrets.
 */
export const clientEnv = createEnv({
  server: {
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
  runtimeEnv: {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_OIDC_AUTHORITY: process.env.NEXT_PUBLIC_OIDC_AUTHORITY,
    NEXT_PUBLIC_OIDC_CLIENT_ID: process.env.NEXT_PUBLIC_OIDC_CLIENT_ID,
    NEXT_PUBLIC_OIDC_RESOURCE: process.env.NEXT_PUBLIC_OIDC_RESOURCE,
    NEXT_PUBLIC_OIDC_SCOPE: process.env.NEXT_PUBLIC_OIDC_SCOPE,
  },
  emptyStringAsUndefined: true,
  skipValidation: skipEnvValidation,
});
