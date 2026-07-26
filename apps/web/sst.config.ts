/// <reference path="./sst-globals.d.ts" />

/**
 * Static Next.js (`next build` + `output: "export"`) → S3 + CloudFront via SST `StaticSite`.
 *
 * SST disallows top-level imports — `@arlequins/env` is loaded via dynamic `import()` in `app` / `run`.
 * `app()` uses validated {@link serverEnv}, {@link sstAwsRegion}, {@link Stage} for the AWS provider.
 *
 * Run all SST commands from this package (cwd = `apps/web`).
 * Deploy: set `NEXT_PUBLIC_*` then `pnpm sst:deploy -- --stage production`
 */
export default $config({
  async app(input) {
    const { serverEnv, sstAwsRegion, Stage } = await import("@arlequins/env");
    const localAwsProfile = serverEnv.SST_AWS_PROFILE?.trim();
    const region = sstAwsRegion();

    return {
      name: "beat-agent-web",
      removal: input?.stage === Stage.PRODUCTION ? "retain" : "remove",
      protect: input?.stage === Stage.PRODUCTION,
      home: "aws",
      providers: {
        aws: {
          region,
          ...(localAwsProfile ? { profile: localAwsProfile } : {}),
        },
      },
    };
  },
  async run() {
    const { clientEnv } = await import("@arlequins/env");

    new sst.aws.StaticSite("Web", {
      path: ".",
      errorPage: "/404.html",
      environment: {
        NEXT_PUBLIC_SITE_URL: clientEnv.NEXT_PUBLIC_SITE_URL,
        NEXT_PUBLIC_API_URL: clientEnv.NEXT_PUBLIC_API_URL,
        NEXT_PUBLIC_OIDC_AUTHORITY: clientEnv.NEXT_PUBLIC_OIDC_AUTHORITY,
        NEXT_PUBLIC_OIDC_CLIENT_ID: clientEnv.NEXT_PUBLIC_OIDC_CLIENT_ID,
        ...(clientEnv.NEXT_PUBLIC_OIDC_RESOURCE
          ? { NEXT_PUBLIC_OIDC_RESOURCE: clientEnv.NEXT_PUBLIC_OIDC_RESOURCE }
          : {}),
        NEXT_PUBLIC_OIDC_SCOPE: clientEnv.NEXT_PUBLIC_OIDC_SCOPE,
      },
      build: {
        command: "pnpm run build",
        output: "out",
      },
      dev: {
        command: "pnpm run dev",
        directory: ".",
        title: "web",
      },
    });
  },
});
