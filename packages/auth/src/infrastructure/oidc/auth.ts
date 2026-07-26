import { errors } from "jose";
import type { AuthSession, OidcClaims } from "../../domain/session";
import type { AccessTokenVerifier } from "./verifier";
import { verifyConfiguredAccessToken } from "./verifier";

export type TRPCAuth = {
  getSession: (opts: { headers: Headers }) => Promise<AuthSession | null>;
};

export function parseBearerToken(headers: Headers): string | null {
  const authorization = headers.get("authorization");
  if (!authorization) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(authorization.trim());
  return match?.[1] ?? null;
}

function isRejectedToken(error: unknown): boolean {
  if (!(error instanceof errors.JOSEError)) return false;
  return new Set([
    "ERR_JWT_EXPIRED",
    "ERR_JWT_CLAIM_VALIDATION_FAILED",
    "ERR_JWT_INVALID",
    "ERR_JWS_INVALID",
    "ERR_JWS_SIGNATURE_VERIFICATION_FAILED",
    "ERR_JWKS_NO_MATCHING_KEY",
    "ERR_JOSE_ALG_NOT_ALLOWED",
  ]).has(error.code);
}

function stringClaim(claims: OidcClaims, name: string): string | null {
  const value = claims[name];
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function createOidcAuth(
  verifyAccessToken: AccessTokenVerifier = verifyConfiguredAccessToken,
): TRPCAuth {
  return {
    async getSession({ headers }) {
      const token = parseBearerToken(headers);
      if (!token) return null;
      let claims: OidcClaims;
      try {
        claims = await verifyAccessToken(token);
      } catch (error: unknown) {
        if (isRejectedToken(error)) return null;
        throw error;
      }
      if (typeof claims.sub !== "string" || claims.sub.length === 0)
        return null;
      return {
        user: {
          id: claims.sub,
          issuer: claims.iss ?? "",
          subject: claims.sub,
          name:
            stringClaim(claims, "name") ??
            stringClaim(claims, "preferred_username"),
          email: stringClaim(claims, "email"),
          roles: [],
        },
        claims,
      };
    },
  };
}

export const authApi = createOidcAuth();
