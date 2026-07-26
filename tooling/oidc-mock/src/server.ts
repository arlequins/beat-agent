import * as oidc from "oidc-provider";

const port = Number(process.env.OIDC_MOCK_PORT ?? "5556");
const issuer = process.env.OIDC_MOCK_ISSUER ?? `http://localhost:${port}`;
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const apiResource =
  process.env.NEXT_PUBLIC_OIDC_RESOURCE ?? "http://localhost:5000";
const clientId = process.env.NEXT_PUBLIC_OIDC_CLIENT_ID ?? "local-web";

const provider = new oidc.Provider(issuer, {
  clients: [
    {
      client_id: clientId,
      client_name: "Local Web Application",
      redirect_uris: [`${siteUrl}/auth/callback/`],
      post_logout_redirect_uris: [`${siteUrl}/auth/logout-callback/`],
      response_types: ["code"],
      grant_types: ["authorization_code"],
      token_endpoint_auth_method: "none",
    },
  ],
  claims: {
    openid: ["sub"],
    profile: ["name", "preferred_username"],
    email: ["email", "email_verified"],
  },
  async findAccount(_context, accountId) {
    return {
      accountId,
      async claims() {
        return {
          sub: accountId,
          name: "Local Test User",
          preferred_username: accountId,
          email: `${accountId}@example.test`,
          email_verified: true,
        };
      },
    };
  },
  async extraTokenClaims(_context, token) {
    const accountId =
      "accountId" in token && token.accountId ? token.accountId : "local-user";
    return {
      name: "Local Test User",
      preferred_username: accountId,
      email: `${accountId}@example.test`,
    };
  },
  features: {
    devInteractions: { enabled: true },
    rpInitiatedLogout: {
      enabled: true,
      async logoutSource(context, form) {
        const autoSubmitForm = form.replace(
          "</form>",
          '<input type="hidden" name="logout" value="yes" /></form>',
        );
        context.type = "html";
        context.body = `${autoSubmitForm}<script>document.getElementById("op.logoutForm").submit();</script>`;
      },
    },
    resourceIndicators: {
      enabled: true,
      async defaultResource() {
        return apiResource;
      },
      async useGrantedResource() {
        return true;
      },
      async getResourceServerInfo(_context, resourceIndicator) {
        if (resourceIndicator !== apiResource) {
          throw new oidc.errors.InvalidTarget();
        }
        return {
          scope: "openid profile email",
          audience: apiResource,
          accessTokenFormat: "jwt",
          jwt: { sign: { alg: "RS256" } },
        };
      },
    },
  },
  pkce: {
    required() {
      return true;
    },
  },
});

const server = provider.listen(port, () => {
  console.log(`Local OIDC provider listening on ${issuer}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
