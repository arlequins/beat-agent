import {
  createHash,
  randomBytes,
  randomUUID,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";

import type { Database } from "@arlequins/db-backbone/client";
import {
  AppUser,
  AuthorizationCode,
  LocalIdentity,
  RefreshToken,
  UserRole,
} from "@arlequins/db-backbone/schema";
import { clientEnv, serverEnv } from "@arlequins/env";
import type { RateLimitPort } from "@arlequins/service";
import { and, eq, gt, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { exportJWK, importJWK, jwtVerify, SignJWT } from "jose";
import { createInMemoryRateLimitAdapter } from "./adaptors/in-memory-rate-limit";
import type { ApiBindings } from "./app";

const accessTokenLifetimeSeconds = 10 * 60;
const authorizationCodeLifetimeMs = 60_000;
const refreshTokenLifetimeDays = 30;

type AuthorizationRequest = {
  clientId: string;
  codeChallenge: string;
  nonce: string | null;
  redirectUri: string;
  scope: string;
  state: string | null;
};

type OidcUser = typeof AppUser.$inferSelect;

type InternalOidcOptions = { rateLimiter?: RateLimitPort };

function base64Url(value: Uint8Array) {
  return Buffer.from(value).toString("base64url");
}

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function required(value: string | undefined, name: string) {
  if (!value) throw new Error(`${name} is required for internal OIDC`);
  return value;
}

function configuration() {
  const issuer = new URL(
    required(serverEnv.OIDC_ISSUER_URL, "OIDC_ISSUER_URL"),
  );
  const siteUrl = new URL(clientEnv.NEXT_PUBLIC_SITE_URL);
  if (issuer.protocol !== "https:" || siteUrl.protocol !== "https:") {
    throw new Error("Internal OIDC accepts production HTTPS URLs only");
  }
  return {
    clientId: required(
      clientEnv.NEXT_PUBLIC_OIDC_CLIENT_ID,
      "NEXT_PUBLIC_OIDC_CLIENT_ID",
    ),
    issuer: issuer.toString().replace(/\/$/, ""),
    keyId: required(serverEnv.OIDC_SIGNING_KEY_ID, "OIDC_SIGNING_KEY_ID"),
    privateJwk: JSON.parse(
      required(serverEnv.OIDC_SIGNING_PRIVATE_JWK, "OIDC_SIGNING_PRIVATE_JWK"),
    ) as JsonWebKey,
    resource: required(serverEnv.OIDC_AUDIENCE, "OIDC_AUDIENCE"),
    siteUrl: siteUrl.toString().replace(/\/$/, ""),
    refreshTokenLifetimeDays:
      serverEnv.OIDC_REFRESH_TOKEN_TTL_DAYS ?? refreshTokenLifetimeDays,
  };
}

function parseAuthorizationRequest(
  input: URLSearchParams,
): AuthorizationRequest {
  const config = configuration();
  const clientId = input.get("client_id");
  const redirectUri = input.get("redirect_uri");
  const codeChallenge = input.get("code_challenge");
  const scope = input.get("scope") ?? "";
  if (input.get("response_type") !== "code") {
    throw new Error("response_type must be code");
  }
  if (clientId !== config.clientId) throw new Error("Unknown OIDC client");
  if (redirectUri !== `${config.siteUrl}/auth/callback/`) {
    throw new Error("Unregistered redirect_uri");
  }
  if (input.get("code_challenge_method") !== "S256" || !codeChallenge) {
    throw new Error("PKCE S256 is required");
  }
  if (!scope.split(/\s+/).includes("openid")) {
    throw new Error("openid scope is required");
  }
  return {
    clientId,
    codeChallenge,
    nonce: input.get("nonce"),
    redirectUri,
    scope,
    state: input.get("state"),
  };
}

function htmlEscape(value: string) {
  return value.replace(/[&<>'"]/g, (character) => {
    return {
      '"': "&quot;",
      "&": "&amp;",
      "'": "&#39;",
      "<": "&lt;",
      ">": "&gt;",
    }[character] as string;
  });
}

function loginPage(request: AuthorizationRequest, error?: string) {
  const hiddenFields = Object.entries({
    client_id: request.clientId,
    code_challenge: request.codeChallenge,
    code_challenge_method: "S256",
    nonce: request.nonce ?? "",
    redirect_uri: request.redirectUri,
    response_type: "code",
    scope: request.scope,
    state: request.state ?? "",
  })
    .map(
      ([name, value]) =>
        `<input name="${htmlEscape(name)}" type="hidden" value="${htmlEscape(value)}">`,
    )
    .join("");
  return `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Beat 로그인</title><body><main><h1>Beat 관리자 로그인</h1>${error ? `<p role="alert">${htmlEscape(error)}</p>` : ""}<form action="/oidc/authorize" method="post">${hiddenFields}<label>이메일 <input autocomplete="username" name="email" required type="email"></label><label>비밀번호 <input autocomplete="current-password" name="password" required type="password"></label><button type="submit">로그인</button></form></main></body></html>`;
}

function derivePasswordHash(password: string, salt: Uint8Array) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCallback(
      password,
      salt,
      64,
      { maxmem: 128 * 1024 * 1024 },
      (error, derivedKey) => {
        if (error) reject(error);
        else resolve(derivedKey);
      },
    );
  });
}

async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await derivePasswordHash(password, salt);
  return `scrypt$${base64Url(salt)}$${base64Url(hash)}`;
}

async function verifyPassword(password: string, encoded: string) {
  const [algorithm, salt, expected] = encoded.split("$");
  if (algorithm !== "scrypt" || !salt || !expected) return false;
  const actual = await derivePasswordHash(
    password,
    Buffer.from(salt, "base64url"),
  );
  const expectedBuffer = Buffer.from(expected, "base64url");
  return (
    actual.length === expectedBuffer.length &&
    timingSafeEqual(actual, expectedBuffer)
  );
}

async function ensureInitialAdministrator(database: Database) {
  const config = configuration();
  const [existingIdentity] = await database
    .select({ userId: LocalIdentity.userId })
    .from(LocalIdentity)
    .limit(1);
  if (existingIdentity) return;
  const email = required(
    serverEnv.AUTH_INITIAL_ADMIN_EMAIL,
    "AUTH_INITIAL_ADMIN_EMAIL",
  ).toLowerCase();
  const password = required(
    serverEnv.AUTH_INITIAL_ADMIN_PASSWORD,
    "AUTH_INITIAL_ADMIN_PASSWORD",
  );
  await database.transaction(async (tx) => {
    const [identity] = await tx
      .select({ userId: LocalIdentity.userId })
      .from(LocalIdentity)
      .where(eq(LocalIdentity.email, email));
    if (identity) return;
    const [user] = await tx
      .insert(AppUser)
      .values({
        email,
        issuer: config.issuer,
        name: "Arlequin",
        subject: randomUUID(),
      })
      .returning();
    if (!user) throw new Error("Could not provision the Beat administrator");
    await tx.insert(LocalIdentity).values({
      email,
      passwordHash: await hashPassword(password),
      userId: user.id,
    });
    await tx.insert(UserRole).values({ role: "admin", userId: user.id });
  });
}

async function issueTokens(
  database: Database,
  user: OidcUser,
  options: { nonce?: string | null; scope: string },
) {
  const config = configuration();
  const key = await importJWK(config.privateJwk, "ES256");
  const claims = {
    email: user.email ?? undefined,
    name: user.name ?? undefined,
    preferred_username: user.email ?? undefined,
  };
  const accessToken = await new SignJWT({ ...claims, scope: options.scope })
    .setProtectedHeader({ alg: "ES256", kid: config.keyId, typ: "at+jwt" })
    .setAudience(config.resource)
    .setExpirationTime(`${accessTokenLifetimeSeconds}s`)
    .setIssuedAt()
    .setIssuer(config.issuer)
    .setSubject(user.subject)
    .sign(key);
  const idToken = await new SignJWT({
    ...claims,
    ...(options.nonce ? { nonce: options.nonce } : {}),
  })
    .setProtectedHeader({ alg: "ES256", kid: config.keyId, typ: "JWT" })
    .setAudience(config.clientId)
    .setExpirationTime(`${accessTokenLifetimeSeconds}s`)
    .setIssuedAt()
    .setIssuer(config.issuer)
    .setSubject(user.subject)
    .sign(key);
  const refreshToken = base64Url(randomBytes(48));
  await database.insert(RefreshToken).values({
    clientId: config.clientId,
    expiresAt: new Date(
      Date.now() + config.refreshTokenLifetimeDays * 24 * 60 * 60 * 1_000,
    ),
    scope: options.scope,
    tokenHash: digest(refreshToken),
    userId: user.id,
  });
  return { accessToken, idToken, refreshToken };
}

function clientIp(context: {
  req: { header: (name: string) => string | undefined };
}) {
  return (
    context.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
  );
}

async function revokeAllRefreshTokens(database: Database, userId: string) {
  await database
    .update(RefreshToken)
    .set({ revokedAt: new Date() })
    .where(
      and(eq(RefreshToken.userId, userId), isNull(RefreshToken.revokedAt)),
    );
}

async function requireAdministrator(
  context: { req: { header: (name: string) => string | undefined } },
  database: Database,
) {
  const authorization = context.req.header("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : undefined;
  if (!token) return undefined;
  const config = configuration();
  try {
    const verified = await jwtVerify(
      token,
      await importJWK(config.privateJwk, "ES256"),
      { audience: config.resource, issuer: config.issuer },
    );
    if (verified.protectedHeader.typ !== "at+jwt" || !verified.payload.sub) {
      return undefined;
    }
    const [user] = await database
      .select({ id: AppUser.id, email: AppUser.email, name: AppUser.name })
      .from(AppUser)
      .innerJoin(UserRole, eq(UserRole.userId, AppUser.id))
      .where(
        and(
          eq(AppUser.issuer, config.issuer),
          eq(AppUser.subject, verified.payload.sub),
          eq(UserRole.role, "admin"),
        ),
      );
    return user;
  } catch {
    return undefined;
  }
}

export function createInternalOidcRouter(
  database: Database,
  options: InternalOidcOptions = {},
) {
  const app = new Hono<ApiBindings>();
  const loginRateLimiter =
    options.rateLimiter ??
    createInMemoryRateLimitAdapter({ maxEntries: 20_000 });

  app.get("/.well-known/openid-configuration", (context) => {
    const config = configuration();
    return context.json({
      authorization_endpoint: `${config.issuer}/authorize`,
      code_challenge_methods_supported: ["S256"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      id_token_signing_alg_values_supported: ["ES256"],
      issuer: config.issuer,
      jwks_uri: `${config.issuer}/jwks`,
      response_types_supported: ["code"],
      revocation_endpoint: `${config.issuer}/revoke`,
      scopes_supported: ["openid", "profile", "email", "offline_access"],
      subject_types_supported: ["public"],
      token_endpoint: `${config.issuer}/token`,
      token_endpoint_auth_methods_supported: ["none"],
    });
  });

  app.get("/jwks", async (context) => {
    const config = configuration();
    const publicJwk = await exportJWK(
      await importJWK(config.privateJwk, "ES256"),
    );
    delete publicJwk.d;
    return context.json({
      keys: [{ ...publicJwk, kid: config.keyId, use: "sig" }],
    });
  });

  app.get("/authorize", (context) => {
    try {
      const params = new URL(context.req.url).searchParams;
      return context.html(loginPage(parseAuthorizationRequest(params)));
    } catch (error) {
      return context.text(
        error instanceof Error
          ? error.message
          : "Invalid authorization request",
        400,
      );
    }
  });

  app.post("/authorize", async (context) => {
    const form = new URLSearchParams(await context.req.text());
    try {
      const request = parseAuthorizationRequest(form);
      const email = form.get("email")?.trim().toLowerCase() ?? "";
      const now = new Date();
      const limit = serverEnv.OIDC_LOGIN_RATE_LIMIT_REQUESTS ?? 5;
      const windowMs =
        (serverEnv.OIDC_LOGIN_RATE_LIMIT_WINDOW_SECONDS ?? 15 * 60) * 1_000;
      const [byIp, byIdentity] = await Promise.all([
        loginRateLimiter.consume({
          key: `oidc-login:ip:${clientIp(context)}`,
          limit,
          now,
          windowMs,
        }),
        loginRateLimiter.consume({
          key: `oidc-login:identity:${digest(email)}`,
          limit,
          now,
          windowMs,
        }),
      ]);
      if (!byIp.allowed || !byIdentity.allowed) {
        const resetAt = Math.max(
          byIp.resetAt.getTime(),
          byIdentity.resetAt.getTime(),
        );
        context.header(
          "Retry-After",
          String(Math.max(1, Math.ceil((resetAt - Date.now()) / 1_000))),
        );
        context
          .get("logger")
          .warn("oidc.login.rate_limited", { identityHash: digest(email) });
        return context.html(
          loginPage(
            request,
            "로그인 시도가 너무 많습니다. 잠시 후 다시 시도하세요.",
          ),
          429,
        );
      }
      await ensureInitialAdministrator(database);
      const password = form.get("password") ?? "";
      const [identity] = await database
        .select({ passwordHash: LocalIdentity.passwordHash, user: AppUser })
        .from(LocalIdentity)
        .innerJoin(AppUser, eq(LocalIdentity.userId, AppUser.id))
        .where(eq(LocalIdentity.email, email));
      if (
        !identity ||
        !(await verifyPassword(password, identity.passwordHash))
      ) {
        context
          .get("logger")
          .warn("oidc.login.failed", { identityHash: digest(email) });
        return context.html(
          loginPage(request, "이메일 또는 비밀번호가 올바르지 않습니다."),
          401,
        );
      }
      const code = base64Url(randomBytes(32));
      await database.insert(AuthorizationCode).values({
        clientId: request.clientId,
        codeChallenge: request.codeChallenge,
        codeHash: digest(code),
        expiresAt: new Date(Date.now() + authorizationCodeLifetimeMs),
        nonce: request.nonce,
        redirectUri: request.redirectUri,
        scope: request.scope,
        userId: identity.user.id,
      });
      const redirect = new URL(request.redirectUri);
      redirect.searchParams.set("code", code);
      if (request.state) redirect.searchParams.set("state", request.state);
      context
        .get("logger")
        .info("oidc.login.succeeded", { userId: identity.user.id });
      return context.redirect(redirect.toString(), 302);
    } catch (error) {
      return context.text(
        error instanceof Error ? error.message : "Authorization failed",
        400,
      );
    }
  });

  app.post("/token", async (context) => {
    try {
      const config = configuration();
      const form = new URLSearchParams(await context.req.text());
      const grantType = form.get("grant_type");
      if (form.get("client_id") !== config.clientId) {
        return context.json({ error: "invalid_client" }, 401);
      }
      if (grantType === "authorization_code") {
        const code = form.get("code");
        const verifier = form.get("code_verifier");
        if (!code || !verifier)
          return context.json({ error: "invalid_request" }, 400);
        const codeChallenge = base64Url(
          createHash("sha256").update(verifier).digest(),
        );
        const [grant] = await database
          .update(AuthorizationCode)
          .set({ consumedAt: new Date() })
          .where(
            and(
              eq(AuthorizationCode.codeHash, digest(code)),
              eq(AuthorizationCode.clientId, config.clientId),
              eq(AuthorizationCode.redirectUri, form.get("redirect_uri") ?? ""),
              eq(AuthorizationCode.codeChallenge, codeChallenge),
              gt(AuthorizationCode.expiresAt, new Date()),
              isNull(AuthorizationCode.consumedAt),
            ),
          )
          .returning();
        if (!grant) return context.json({ error: "invalid_grant" }, 400);
        const [user] = await database
          .select()
          .from(AppUser)
          .where(eq(AppUser.id, grant.userId));
        if (!user) return context.json({ error: "invalid_grant" }, 400);
        const tokens = await issueTokens(database, user, {
          nonce: grant.nonce,
          scope: grant.scope,
        });
        return context.json({
          access_token: tokens.accessToken,
          expires_in: accessTokenLifetimeSeconds,
          id_token: tokens.idToken,
          refresh_token: tokens.refreshToken,
          scope: grant.scope,
          token_type: "Bearer",
        });
      }
      if (grantType === "refresh_token") {
        const refreshToken = form.get("refresh_token");
        if (!refreshToken)
          return context.json({ error: "invalid_request" }, 400);
        const [grant] = await database
          .update(RefreshToken)
          .set({ revokedAt: new Date() })
          .where(
            and(
              eq(RefreshToken.tokenHash, digest(refreshToken)),
              eq(RefreshToken.clientId, config.clientId),
              gt(RefreshToken.expiresAt, new Date()),
              isNull(RefreshToken.revokedAt),
            ),
          )
          .returning();
        if (!grant) {
          const [replayed] = await database
            .select({
              revokedAt: RefreshToken.revokedAt,
              userId: RefreshToken.userId,
            })
            .from(RefreshToken)
            .where(
              and(
                eq(RefreshToken.tokenHash, digest(refreshToken)),
                eq(RefreshToken.clientId, config.clientId),
              ),
            );
          if (replayed?.revokedAt) {
            await revokeAllRefreshTokens(database, replayed.userId);
            context.get("logger").warn("oidc.refresh_token.reuse_detected", {
              userId: replayed.userId,
            });
          }
          return context.json({ error: "invalid_grant" }, 400);
        }
        const [user] = await database
          .select()
          .from(AppUser)
          .where(eq(AppUser.id, grant.userId));
        if (!user) return context.json({ error: "invalid_grant" }, 400);
        const tokens = await issueTokens(database, user, {
          scope: grant.scope,
        });
        return context.json({
          access_token: tokens.accessToken,
          expires_in: accessTokenLifetimeSeconds,
          id_token: tokens.idToken,
          refresh_token: tokens.refreshToken,
          scope: grant.scope,
          token_type: "Bearer",
        });
      }
      return context.json({ error: "unsupported_grant_type" }, 400);
    } catch (error) {
      return context.json(
        {
          error: "server_error",
          error_description: error instanceof Error ? error.message : undefined,
        },
        500,
      );
    }
  });

  app.post("/revoke", async (context) => {
    const config = configuration();
    const form = new URLSearchParams(await context.req.text());
    const token = form.get("token");
    if (token && form.get("client_id") === config.clientId) {
      await database
        .update(RefreshToken)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(RefreshToken.tokenHash, digest(token)),
            eq(RefreshToken.clientId, config.clientId),
            isNull(RefreshToken.revokedAt),
          ),
        );
    }
    return new Response(null, { status: 200 });
  });

  app.get("/sessions", async (context) => {
    const administrator = await requireAdministrator(context, database);
    if (!administrator) return context.json({ error: "Unauthorized" }, 401);
    const activeTokens = await database
      .select({
        createdAt: RefreshToken.createdAt,
        expiresAt: RefreshToken.expiresAt,
      })
      .from(RefreshToken)
      .where(
        and(
          eq(RefreshToken.userId, administrator.id),
          gt(RefreshToken.expiresAt, new Date()),
          isNull(RefreshToken.revokedAt),
        ),
      );
    return context.json({
      activePersistentLogins: activeTokens.length,
      sessions: activeTokens.map((session) => ({
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
      })),
    });
  });

  app.post("/sessions/revoke", async (context) => {
    const administrator = await requireAdministrator(context, database);
    if (!administrator) return context.json({ error: "Unauthorized" }, 401);
    await revokeAllRefreshTokens(database, administrator.id);
    context.get("logger").warn("oidc.sessions.revoked_by_administrator", {
      userId: administrator.id,
    });
    return context.json({ revoked: true });
  });

  return app;
}
