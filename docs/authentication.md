# OpenID Connect Authentication

The template uses OpenID Connect for user authentication and OAuth 2.0 bearer access tokens for API authorization.

```text
Browser (public client)
  -> Authorization Code + PKCE
  -> OIDC provider
  -> JWT access token
  -> Hono / tRPC API
  -> discovery + JWKS signature and claim validation
```

The browser implementation uses [`oidc-client-ts`](https://authts.github.io/oidc-client-ts/) and does not use a client secret. The API uses [`jose`](https://github.com/panva/jose) to verify JWT signatures and claims.

## Provider Registration

Register a public SPA client with Authorization Code and PKCE enabled. Do not issue a client secret to the browser application.

For local development, allow these exact redirect URIs:

```text
http://localhost:3000/auth/callback/
http://localhost:3000/auth/logout-callback/
```

Register equivalent HTTPS URIs for each deployed environment. The provider must expose an [OpenID Provider Configuration document](https://openid.net/specs/openid-connect-discovery-1_0.html) and issue signed JWT access tokens for the configured API audience.

## Environment

```dotenv
# API resource server
OIDC_ISSUER_URL=https://idp.beat.localhost
OIDC_AUDIENCE=example-api
OIDC_ALLOWED_ALGORITHMS=RS256
# OIDC_JWKS_URI=https://idp.beat.localhost/.well-known/jwks.json

# Static browser client
NEXT_PUBLIC_OIDC_AUTHORITY=https://idp.beat.localhost
NEXT_PUBLIC_OIDC_CLIENT_ID=example-spa
NEXT_PUBLIC_OIDC_RESOURCE=https://api.beat.localhost
NEXT_PUBLIC_OIDC_SCOPE=openid profile email
```

`OIDC_AUDIENCE` and `OIDC_ALLOWED_ALGORITHMS` accept comma-separated values. The JWKS URI is discovered from the provider by default; set `OIDC_JWKS_URI` only when an explicit override is required.

`NEXT_PUBLIC_OIDC_RESOURCE` is optional. Set it when the provider uses OAuth 2.0 Resource Indicators to select the API audience.

## Local Provider

`pnpm dev:local` starts the development-only `@arlequins/oidc-mock` provider with PostgreSQL, the API, and the web app. It uses in-memory accounts and signing keys and must never be deployed as a production identity provider.

The complete local configuration is in `.env.localhost.example`. The Playwright suite uses `.env.e2e` and an isolated database to verify PKCE sign-in, JWT validation through discovery and JWKS, protected tRPC CRUD, and sign-out.

The API accepts only asymmetric signing algorithms: RS256/384/512, PS256/384/512, ES256/384/512, and EdDSA. Keep the allowlist as narrow as the provider permits.

## Validation

For every bearer token, the API validates:

- compact JWT structure and cryptographic signature;
- configured signing algorithm;
- exact issuer;
- API audience;
- expiration and time-based claims, with five seconds of clock tolerance;
- required `sub` claim.

Missing, expired, malformed, incorrectly signed, or incorrectly scoped tokens produce an unauthenticated session. Discovery and JWKS availability errors are not treated as bad credentials and surface as service errors.

## Browser Session

The browser stores the OIDC user and interaction state in `sessionStorage`, so credentials are not shared between browser tabs or persisted after the browser session. The tRPC client reads the current non-expired access token immediately before each HTTP batch request.

Automatic silent renewal is disabled by default because refresh-token and iframe behavior differs across providers. Applications that enable renewal must document provider requirements, token rotation, and failure handling explicitly.

## Application Usage

- Use `publicProcedure` for endpoints that do not require identity.
- Use `protectedProcedure` for endpoints that require a validated access token.
- Read the stable user ID from `ctx.session.user.id`, which maps to the OIDC `sub` claim.
- Read provider-specific authorization claims from `ctx.session.claims` only through a documented authorization policy.
- Never send an ID token to the API as an access token.
## Application Users and Authorization

After token verification, the API provisions an application user by the stable `(issuer, subject)` pair. Profile claims are synchronized on login, while authorization roles remain application-owned in `auth.user_role`. New users receive the `member` role. Never grant roles directly from untrusted token claims unless a project adds an explicit, provider-specific mapping policy.

Use `permissionProcedure(Permission.X)` for protected tRPC operations. The default policy provides `viewer`, `member`, and `admin` roles through a dependency-injected provisioning port. Authentication success and authorization denial are emitted as structured audit events without tokens.

For multiple identity providers, set `OIDC_PROVIDERS_JSON` to a JSON array of named configurations. The unverified issuer is used only to select a configuration; signature, issuer, audience, expiry, algorithm, and subject are then verified against that configuration.
