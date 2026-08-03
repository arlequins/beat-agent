import type { AppRole } from "./authorization";

export type OidcClaims = Record<string, unknown> & {
  aud?: string | string[];
  exp?: number;
  iat?: number;
  iss?: string;
  sub: string;
  name?: string;
  preferred_username?: string;
  email?: string;
};

export type AuthSession = {
  user: {
    id: string;
    issuer: string;
    subject: string;
    name: string | null;
    email: string | null;
    roles: AppRole[];
  };
  claims: OidcClaims;
};
