import { serverEnv } from "@arlequins/env/server-env";
import { z } from "zod/v4";

export const supportedAlgorithms = [
  "RS256",
  "RS384",
  "RS512",
  "PS256",
  "PS384",
  "PS512",
  "ES256",
  "ES384",
  "ES512",
  "EdDSA",
] as const;

export const oidcConfigSchema = z.object({
  id: z.string().min(1).default("default"),
  issuer: z.url(),
  audience: z.array(z.string().min(1)).min(1),
  jwksUri: z.url().optional(),
  algorithms: z.array(z.enum(supportedAlgorithms)).min(1),
});

export type OidcConfig = z.infer<typeof oidcConfigSchema>;

function commaSeparatedValues(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function loadOidcConfig(): OidcConfig {
  return oidcConfigSchema.parse({
    id: "default",
    issuer: serverEnv.OIDC_ISSUER_URL,
    audience: commaSeparatedValues(serverEnv.OIDC_AUDIENCE ?? ""),
    jwksUri: serverEnv.OIDC_JWKS_URI,
    algorithms: commaSeparatedValues(
      serverEnv.OIDC_ALLOWED_ALGORITHMS ?? "RS256",
    ),
  });
}

export function loadOidcConfigs(): OidcConfig[] {
  if (!serverEnv.OIDC_PROVIDERS_JSON) return [loadOidcConfig()];
  return z
    .array(oidcConfigSchema)
    .min(1)
    .parse(JSON.parse(serverEnv.OIDC_PROVIDERS_JSON));
}
