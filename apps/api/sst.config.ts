/// <reference path="./sst-globals.d.ts" />

/** Hono API deployed through the endpoint selected by `API_DEPLOYMENT_PRESET`. */
export default $config({
  async app(input) {
    const { serverEnv, sstAwsRegion, Stage } = await import("@arlequins/env");
    const localAwsProfile = serverEnv.SST_AWS_PROFILE?.trim();
    const region = sstAwsRegion();

    return {
      name: "beat-agent-api",
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
    const {
      ApiDeploymentPreset,
      LambdaEnvironment,
      resolveApiDeploymentConfig,
      serverEnv,
      sstAwsRegion,
      vpcFromEnv,
    } = await import("@arlequins/env");

    const region = sstAwsRegion();
    const vpc = vpcFromEnv();
    const deployment = resolveApiDeploymentConfig({
      customDomain: serverEnv.API_CUSTOM_DOMAIN,
      preset: serverEnv.API_DEPLOYMENT_PRESET,
      throttleBurstLimit: serverEnv.API_THROTTLE_BURST_LIMIT,
      throttleRateLimit: serverEnv.API_THROTTLE_RATE_LIMIT,
      wafEnabled: serverEnv.API_WAF_ENABLED,
    });
    const cacheBucket = new sst.aws.Bucket("Cache");
    const uploadOrigins = (
      serverEnv.API_CORS_ORIGINS ?? "http://localhost:3000"
    )
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);
    const uploadBucket = new sst.aws.Bucket("Uploads", {
      cors: {
        allowHeaders: ["content-type"],
        allowMethods: ["PUT"],
        allowOrigins: uploadOrigins,
      },
    });
    const handler = {
      handler: "src/lambda.handler",
      link: [cacheBucket, uploadBucket],
      ...(vpc
        ? {
            vpc: {
              subnets: vpc.subnetIds,
              securityGroups: vpc.securityGroups,
            },
          }
        : {}),
      environment: {
        ...LambdaEnvironment,
        S3_CACHE_BUCKET: cacheBucket.name,
        S3_CACHE_PREFIX: `${$app.name}/${$app.stage}`,
        S3_UPLOAD_BUCKET: uploadBucket.name,
        S3_UPLOAD_PREFIX: `${$app.name}/${$app.stage}`,
        SST_STAGE: $app.stage,
      },
    };
    const alarmActions = serverEnv.ALERT_TOPIC_ARN
      ? [serverEnv.ALERT_TOPIC_ARN]
      : [];
    const metric = (name: string) => ({
      namespace: "Template/Api",
      metricName: name,
      dimensions: { stage: $app.stage },
      period: 300,
      statistic: "Sum",
    });
    new aws.cloudwatch.MetricAlarm("ApiServerErrors", {
      ...metric("ServerErrorCount"),
      evaluationPeriods: 1,
      threshold: 1,
      comparisonOperator: "GreaterThanOrEqualToThreshold",
      alarmActions,
    });
    new aws.cloudwatch.MetricAlarm("ApiLatency", {
      ...metric("RequestDuration"),
      statistic: "Average",
      evaluationPeriods: 2,
      threshold: 2_000,
      comparisonOperator: "GreaterThanThreshold",
      alarmActions,
    });
    new aws.cloudwatch.Dashboard("ApiDashboard", {
      dashboardName: `${$app.name}-${$app.stage}`,
      dashboardBody: JSON.stringify({
        widgets: [
          {
            type: "metric",
            width: 12,
            height: 6,
            properties: {
              region,
              title: "API requests, errors, latency, and cold starts",
              metrics: [
                ["Template/Api", "RequestCount", "stage", $app.stage],
                [".", "ServerErrorCount", ".", "."],
                [".", "RequestDuration", ".", ".", { stat: "Average" }],
                [".", "ColdStart", ".", "."],
              ],
            },
          },
        ],
      }),
    });

    if (deployment.preset === ApiDeploymentPreset.API_GATEWAY) {
      const api = new sst.aws.ApiGatewayV2("Api", {
        cors: false,
        ...(deployment.customDomain ? { domain: deployment.customDomain } : {}),
        transform: {
          stage: (args) => {
            args.defaultRouteSettings = {
              throttlingBurstLimit: deployment.throttleBurstLimit,
              throttlingRateLimit: deployment.throttleRateLimit,
            };
          },
        },
      });

      api.route("$default", handler);

      return { apiUrl: api.url };
    }

    const router = deployment.useEdgeRouter
      ? new sst.aws.Router("ApiRouter", {
          ...(deployment.customDomain
            ? { domain: deployment.customDomain }
            : {}),
          waf: deployment.wafEnabled,
        })
      : undefined;

    const api = new sst.aws.Function("Api", {
      ...handler,
      url: router ? { router: { instance: router } } : true,
    });

    return { apiUrl: router?.url ?? api.url };
  },
});
