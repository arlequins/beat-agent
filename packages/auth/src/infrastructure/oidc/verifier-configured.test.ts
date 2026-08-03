import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createRemoteJWKSet: vi.fn(() => vi.fn()),
  decodeJwt: vi.fn(),
  jwtVerify: vi.fn(),
  loadOidcConfigs: vi.fn(),
}));

vi.mock("jose", async (importOriginal) => {
  const actual = await importOriginal<typeof import("jose")>();
  return {
    ...actual,
    createRemoteJWKSet: mocks.createRemoteJWKSet,
    decodeJwt: mocks.decodeJwt,
    jwtVerify: mocks.jwtVerify,
  };
});

vi.mock("./config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./config")>();
  return {
    ...actual,
    loadOidcConfigs: mocks.loadOidcConfigs,
  };
});

import { verifyConfiguredAccessToken } from "./verifier";

const provider = {
  algorithms: ["RS256"] as const,
  audience: ["beat-api"],
  id: "configured-provider",
  issuer: "https://id.beat.test",
  jwksUri: "https://id.beat.test/keys",
};

describe("configured OIDC token verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.decodeJwt.mockReturnValue({ iss: provider.issuer });
    mocks.loadOidcConfigs.mockReturnValue([provider]);
    mocks.jwtVerify.mockResolvedValue({
      payload: { iss: provider.issuer, sub: "user-1" },
    });
  });

  it("rejects an issuer that is not explicitly trusted", async () => {
    mocks.decodeJwt.mockReturnValue({ iss: "https://attacker.test" });

    await expect(verifyConfiguredAccessToken("token")).rejects.toThrow(
      "untrusted issuer",
    );
    expect(mocks.createRemoteJWKSet).not.toHaveBeenCalled();
  });

  it("creates and reuses a remote JWKS verifier", async () => {
    await expect(verifyConfiguredAccessToken("token-1")).resolves.toMatchObject(
      {
        sub: "user-1",
      },
    );
    await expect(verifyConfiguredAccessToken("token-2")).resolves.toMatchObject(
      {
        sub: "user-1",
      },
    );

    expect(mocks.createRemoteJWKSet).toHaveBeenCalledOnce();
    expect(mocks.createRemoteJWKSet).toHaveBeenCalledWith(
      new URL(provider.jwksUri),
      { cooldownDuration: 30_000, timeoutDuration: 5_000 },
    );
    expect(mocks.jwtVerify).toHaveBeenCalledTimes(2);
  });

  it("discovers JWKS and checks the discovery issuer", async () => {
    const discoveredProvider = {
      ...provider,
      id: "discovered-provider",
      issuer: "https://id.beat.test/tenant/",
      jwksUri: undefined,
    };
    mocks.decodeJwt.mockReturnValue({ iss: discoveredProvider.issuer });
    mocks.loadOidcConfigs.mockReturnValue([discoveredProvider]);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          issuer: discoveredProvider.issuer,
          jwks_uri: "https://id.beat.test/discovered-keys",
        }),
      ),
    );

    await verifyConfiguredAccessToken("token");

    expect(fetchMock).toHaveBeenCalledWith(
      new URL("https://id.beat.test/tenant/.well-known/openid-configuration"),
      expect.objectContaining({
        headers: { Accept: "application/json" },
      }),
    );
  });

  it("drops a failed discovery so a later request can retry", async () => {
    const retryProvider = {
      ...provider,
      id: "retry-provider",
      jwksUri: undefined,
    };
    mocks.loadOidcConfigs.mockReturnValue([retryProvider]);
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            issuer: retryProvider.issuer,
            jwks_uri: "https://id.beat.test/recovered-keys",
          }),
        ),
      );

    await expect(verifyConfiguredAccessToken("token")).rejects.toThrow(
      "HTTP 503",
    );
    await expect(verifyConfiguredAccessToken("token")).resolves.toMatchObject({
      sub: "user-1",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects discovery metadata for a different issuer", async () => {
    const mismatchProvider = {
      ...provider,
      id: "mismatch-provider",
      jwksUri: undefined,
    };
    mocks.loadOidcConfigs.mockReturnValue([mismatchProvider]);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          issuer: "https://attacker.test",
          jwks_uri: "https://attacker.test/keys",
        }),
      ),
    );

    await expect(verifyConfiguredAccessToken("token")).rejects.toThrow(
      "does not match",
    );
  });
});
