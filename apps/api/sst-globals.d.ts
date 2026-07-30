/**
 * SST loads real globals from `.sst/platform/config.d.ts` after `pnpm sst:install`.
 * This file keeps `sst.config.ts` typechecking in a fresh clone before that step.
 */

/** Available inside `$config` `run()` — app id from `app()` and active stage (e.g. `pnpm sst deploy --stage`). */
declare const $app: {
  name: string;
  stage: string;
};

type SstAppConfig = {
  name: string;
  removal: string;
  protect: boolean;
  home: string;
  providers?: {
    aws?: { profile?: string; region?: string } | string | boolean;
  };
};

declare const $config: (config: {
  app: (input?: { stage?: string }) => SstAppConfig | Promise<SstAppConfig>;
  run: () => Record<string, unknown> | Promise<Record<string, unknown>>;
}) => unknown;

declare const sst: {
  aws: {
    ApiGatewayV2: new (
      name: string,
      args: {
        cors?: boolean;
        domain?: string;
        transform?: {
          stage?: (args: {
            defaultRouteSettings?: {
              throttlingBurstLimit?: number;
              throttlingRateLimit?: number;
            };
          }) => void;
        };
      },
    ) => {
      route: (
        route: string,
        handler: {
          handler: string;
          environment?: Record<string, string>;
          link?: unknown[];
          vpc?: { subnets: string[]; securityGroups: string[] };
        },
      ) => unknown;
      url: string;
    };
    Bucket: new (
      name: string,
      args?: {
        cors?: {
          allowHeaders?: string[];
          allowMethods?: ("DELETE" | "GET" | "HEAD" | "POST" | "PUT")[];
          allowOrigins?: string[];
        };
      },
    ) => { name: string };
    Function: new (
      name: string,
      args: {
        handler: string;
        environment?: Record<string, string>;
        url?:
          | boolean
          | { router: { instance: { url: string }; path?: string } };
        vpc?: {
          subnets: string[];
          securityGroups: string[];
        };
        link?: unknown[];
      } & Record<string, unknown>,
    ) => { url: string };
    Router: new (
      name: string,
      args: {
        domain?: string;
        waf?: boolean;
      },
    ) => { url: string };
  };
};

declare const aws: {
  iam: {
    getPolicyDocumentOutput: (args: Record<string, unknown>) => {
      json: string;
    };
  };
  s3: {
    BucketV2: new (
      name: string,
      args: Record<string, unknown>,
    ) => { arn: string; bucket: string; id: string };
    BucketLifecycleConfigurationV2: new (
      name: string,
      args: Record<string, unknown>,
    ) => unknown;
    BucketOwnershipControls: new (
      name: string,
      args: Record<string, unknown>,
    ) => unknown;
    BucketPolicy: new (name: string, args: Record<string, unknown>) => unknown;
    BucketPublicAccessBlock: new (
      name: string,
      args: Record<string, unknown>,
    ) => unknown;
    BucketServerSideEncryptionConfigurationV2: new (
      name: string,
      args: Record<string, unknown>,
    ) => unknown;
    BucketVersioningV2: new (
      name: string,
      args: Record<string, unknown>,
    ) => unknown;
  };
  sqs: {
    Queue: new (
      name: string,
      args: Record<string, unknown>,
    ) => { arn: string; url: string };
  };
  cloudwatch: {
    MetricAlarm: new (name: string, args: Record<string, unknown>) => unknown;
    Dashboard: new (name: string, args: Record<string, unknown>) => unknown;
  };
};

declare const $interpolate: (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => string;
declare const $jsonStringify: (value: unknown) => string;
