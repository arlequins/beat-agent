import type { JWTVerifyGetKey } from "jose";
import { createRemoteJWKSet, decodeJwt, errors, jwtVerify } from "jose";
import { z } from "zod/v4";
import type { OidcClaims } from "../../domain/session";
import type { OidcConfig } from "./config";
import { loadOidcConfigs, oidcConfigSchema } from "./config";

export type AccessTokenVerifier = (token: string) => Promise<OidcClaims>;

const discoveryDocumentSchema = z.object({
  issuer: z.url(),
  jwks_uri: z.url(),
});

function discoveryUrl(issuer: string): URL {
  const url = new URL(issuer);
  url.pathname = `${url.pathname.replace(/\/$/, "")}/.well-known/openid-configuration`;
  url.search = "";
  url.hash = "";
  return url;
}

async function discoverJwksUri(config: OidcConfig): Promise<string> {
  if (config.jwksUri) return config.jwksUri;
  const response = await fetch(discoveryUrl(config.issuer), {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok)
    throw new Error(`OIDC discovery failed with HTTP ${response.status}`);
  const metadata = discoveryDocumentSchema.parse(await response.json());
  if (metadata.issuer !== config.issuer)
    throw new Error("OIDC discovery issuer does not match configured issuer");
  return metadata.jwks_uri;
}

export function createJwtAccessTokenVerifier(
  config: OidcConfig,
  key: JWTVerifyGetKey,
): AccessTokenVerifier {
  const parsedConfig = oidcConfigSchema.parse(config);
  return async (token) => {
    const { payload } = await jwtVerify(token, key, {
      issuer: parsedConfig.issuer,
      audience: parsedConfig.audience,
      algorithms: parsedConfig.algorithms,
      clockTolerance: 5,
    });
    if (typeof payload.sub !== "string" || payload.sub.length === 0)
      throw new errors.JWTClaimValidationFailed(
        'required "sub" claim is missing',
        payload,
        "sub",
        "missing",
      );
    return payload as OidcClaims;
  };
}

async function createConfiguredVerifier(config: OidcConfig) {
  const jwksUri = await discoverJwksUri(config);
  const remoteJwks = createRemoteJWKSet(new URL(jwksUri), {
    cooldownDuration: 30_000,
    timeoutDuration: 5_000,
  });
  return createJwtAccessTokenVerifier(config, remoteJwks);
}

const configuredVerifiers = new Map<string, Promise<AccessTokenVerifier>>();

export async function verifyConfiguredAccessToken(token: string) {
  const issuer = decodeJwt(token).iss;
  const config = loadOidcConfigs().find(
    (candidate) => candidate.issuer === issuer,
  );
  if (!config)
    throw new errors.JWTClaimValidationFailed(
      "untrusted issuer",
      {},
      "iss",
      "check_failed",
    );
  let verifier = configuredVerifiers.get(config.id);
  verifier ??= createConfiguredVerifier(config).catch((error: unknown) => {
    configuredVerifiers.delete(config.id);
    throw error;
  });
  configuredVerifiers.set(config.id, verifier);
  return (await verifier)(token);
}
