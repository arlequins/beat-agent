import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  serverEnv: {
    OIDC_ALLOWED_ALGORITHMS: "RS256" as string | undefined,
    OIDC_AUDIENCE: "beat-api" as string | undefined,
    OIDC_ISSUER_URL: "https://id.beat.test" as string | undefined,
    OIDC_JWKS_URI: undefined as string | undefined,
    OIDC_PROVIDERS_JSON: undefined as string | undefined,
  },
}));

vi.mock("@arlequins/env/server-env", () => ({
  serverEnv: mocks.serverEnv,
}));

import { loadOidcConfig, loadOidcConfigs } from "./config";

describe("OIDC configuration", () => {
  beforeEach(() => {
    Object.assign(mocks.serverEnv, {
      OIDC_ALLOWED_ALGORITHMS: "RS256",
      OIDC_AUDIENCE: "beat-api",
      OIDC_ISSUER_URL: "https://id.beat.test",
      OIDC_JWKS_URI: undefined,
      OIDC_PROVIDERS_JSON: undefined,
    });
  });

  it("normalizes comma-separated audiences and algorithms", () => {
    Object.assign(mocks.serverEnv, {
      OIDC_ALLOWED_ALGORITHMS: "RS256, ES256, ",
      OIDC_AUDIENCE: " beat-api, beat-admin ",
      OIDC_JWKS_URI: "https://id.beat.test/jwks.json",
    });

    expect(loadOidcConfig()).toEqual({
      algorithms: ["RS256", "ES256"],
      audience: ["beat-api", "beat-admin"],
      id: "default",
      issuer: "https://id.beat.test",
      jwksUri: "https://id.beat.test/jwks.json",
    });
  });

  it("uses the secure default algorithm", () => {
    mocks.serverEnv.OIDC_ALLOWED_ALGORITHMS = undefined;

    expect(loadOidcConfig().algorithms).toEqual(["RS256"]);
  });

  it("loads and validates multiple named providers", () => {
    mocks.serverEnv.OIDC_PROVIDERS_JSON = JSON.stringify([
      {
        algorithms: ["ES256"],
        audience: ["beat-api"],
        id: "beat",
        issuer: "https://id.beat.test",
      },
      {
        algorithms: ["RS256"],
        audience: ["work-api"],
        id: "work",
        issuer: "https://login.work.test",
        jwksUri: "https://login.work.test/keys",
      },
    ]);

    expect(loadOidcConfigs()).toHaveLength(2);
    expect(loadOidcConfigs()[1]).toMatchObject({ id: "work" });
  });

  it("rejects malformed or empty provider configuration", () => {
    mocks.serverEnv.OIDC_PROVIDERS_JSON = "[]";
    expect(() => loadOidcConfigs()).toThrow();

    mocks.serverEnv.OIDC_PROVIDERS_JSON = "{";
    expect(() => loadOidcConfigs()).toThrow();
  });
});
