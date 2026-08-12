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
    const dataBucket = new aws.s3.BucketV2("AgentData", {
      bucket: `${$app.name}-${$app.stage}-data`,
      tags: {
        Application: "beat-agent",
        DataClassification: "sensitive-personal",
        Stage: $app.stage,
      },
    });
    new aws.s3.BucketPublicAccessBlock("AgentDataPublicAccess", {
      bucket: dataBucket.id,
      blockPublicAcls: true,
      blockPublicPolicy: true,
      ignorePublicAcls: true,
      restrictPublicBuckets: true,
    });
    new aws.s3.BucketOwnershipControls("AgentDataOwnership", {
      bucket: dataBucket.id,
      rule: { objectOwnership: "BucketOwnerEnforced" },
    });
    new aws.s3.BucketVersioningV2("AgentDataVersioning", {
      bucket: dataBucket.id,
      versioningConfiguration: { status: "Enabled" },
    });
    new aws.s3.BucketServerSideEncryptionConfigurationV2(
      "AgentDataEncryption",
      {
        bucket: dataBucket.id,
        rules: [
          {
            applyServerSideEncryptionByDefault: { sseAlgorithm: "AES256" },
          },
        ],
      },
    );
    new aws.s3.BucketLifecycleConfigurationV2("AgentDataLifecycle", {
      bucket: dataBucket.id,
      rules: [
        {
          abortIncompleteMultipartUpload: { daysAfterInitiation: 7 },
          filter: { prefix: "" },
          id: "control-version-cost",
          noncurrentVersionExpiration: {
            newerNoncurrentVersions: 3,
            noncurrentDays: 90,
          },
          status: "Enabled",
        },
      ],
    });
    const dataPolicy = aws.iam.getPolicyDocumentOutput({
      statements: [
        {
          actions: ["s3:*"],
          conditions: [
            {
              test: "Bool",
              values: ["false"],
              variable: "aws:SecureTransport",
            },
          ],
          effect: "Deny",
          principals: [{ identifiers: ["*"], type: "*" }],
          resources: [dataBucket.arn, $interpolate`${dataBucket.arn}/*`],
          sid: "DenyInsecureTransport",
        },
        {
          actions: ["s3:PutObject"],
          conditions: [
            {
              test: "Null",
              values: ["true"],
              variable: "s3:if-match",
            },
            {
              test: "Null",
              values: ["true"],
              variable: "s3:if-none-match",
            },
          ],
          effect: "Deny",
          principals: [{ identifiers: ["*"], type: "*" }],
          resources: [$interpolate`${dataBucket.arn}/*`],
          sid: "RequireConditionalWrites",
        },
      ],
    });
    new aws.s3.BucketPolicy("AgentDataPolicy", {
      bucket: dataBucket.id,
      policy: dataPolicy.json,
    });

    const deadLetterQueue = new aws.sqs.Queue("AgentJobsDeadLetter", {
      messageRetentionSeconds: 1_209_600,
      name: `${$app.name}-${$app.stage}-jobs-dlq.fifo`,
      fifoQueue: true,
    });
    const jobsQueue = new aws.sqs.Queue("AgentJobs", {
      contentBasedDeduplication: true,
      fifoQueue: true,
      messageRetentionSeconds: 345_600,
      name: `${$app.name}-${$app.stage}-jobs.fifo`,
      redrivePolicy: $jsonStringify({
        deadLetterTargetArn: deadLetterQueue.arn,
        maxReceiveCount: 3,
      }),
      visibilityTimeoutSeconds: 900,
    });
    const handler = {
      handler: "src/lambda.handler",
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
        AGENT_JOBS_QUEUE_URL: jobsQueue.url,
        S3_AGENT_BUCKET: dataBucket.bucket,
        S3_AGENT_PREFIX: $app.stage,
        SST_STAGE: $app.stage,
      },
      permissions: [
        {
          actions: ["s3:ListBucket"],
          resources: [dataBucket.arn],
        },
        {
          actions: ["s3:GetObject", "s3:GetObjectVersion", "s3:PutObject"],
          resources: [$interpolate`${dataBucket.arn}/*`],
        },
        {
          actions: ["sqs:SendMessage"],
          resources: [jobsQueue.arn],
        },
        ...(serverEnv.BEDROCK_MODEL_ARN
          ? [
              {
                actions: ["bedrock:InvokeModelWithResponseStream"],
                resources: [serverEnv.BEDROCK_MODEL_ARN],
              },
            ]
          : []),
      ],
    };
    const alarmActions = serverEnv.ALERT_TOPIC_ARN
      ? [serverEnv.ALERT_TOPIC_ARN]
      : [];
    const metric = (name: string) => ({
      namespace: "Beat/Api",
      metricName: name,
      dimensions: { stage: $app.stage },
      period: 300,
      statistic: "Sum",
    });
    if (alarmActions.length > 0) {
      new aws.cloudwatch.MetricAlarm("ApiServerErrors", {
        ...metric("ServerErrorCount"),
        alarmName: `${$app.name}-${$app.stage}-server-errors`,
        evaluationPeriods: 1,
        threshold: 1,
        comparisonOperator: "GreaterThanOrEqualToThreshold",
        alarmActions,
      });
      new aws.cloudwatch.MetricAlarm("ApiLatency", {
        ...metric("RequestDuration"),
        alarmName: `${$app.name}-${$app.stage}-latency`,
        statistic: "Average",
        evaluationPeriods: 2,
        threshold: 2_000,
        comparisonOperator: "GreaterThanThreshold",
        alarmActions,
      });
    }
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
                ["Beat/Api", "RequestCount", "stage", $app.stage],
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
