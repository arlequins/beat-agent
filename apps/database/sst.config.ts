/// <reference path="./sst-globals.d.ts" />

function parseIds(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function required(name: string, value: string | undefined): string {
  if (!value?.trim())
    throw new Error(`${name} is required when AURORA_ENABLED=true`);
  return value;
}

/**
 * Optional Aurora Serverless v2 infrastructure.
 *
 * It is deliberately disabled by default: Aurora is appropriate for the
 * relational enterprise path, but it is not an always-free service. The
 * low-cost personal profile should use the local database or its later
 * DynamoDB adapter until relational querying is actually required.
 */
export default $config({
  async app(input) {
    const { serverEnv, sstAwsRegion, Stage } = await import("@arlequins/env");
    const profile = serverEnv.SST_AWS_PROFILE?.trim();

    return {
      name: "beat-agent-database",
      removal: input?.stage === Stage.PRODUCTION ? "retain" : "remove",
      protect: input?.stage === Stage.PRODUCTION,
      home: "aws",
      providers: {
        aws: {
          region: sstAwsRegion(),
          ...(profile ? { profile } : {}),
        },
      },
    };
  },
  async run() {
    const { serverEnv, Stage } = await import("@arlequins/env");
    if (!serverEnv.AURORA_ENABLED) return {};

    const subnetIds = parseIds(serverEnv.AURORA_SUBNET_IDS);
    const securityGroupIds = parseIds(serverEnv.AURORA_SECURITY_GROUP_IDS);
    if (subnetIds.length < 2) {
      throw new Error(
        "AURORA_SUBNET_IDS must contain private subnets in at least two Availability Zones",
      );
    }
    if (securityGroupIds.length === 0) {
      throw new Error(
        "AURORA_SECURITY_GROUP_IDS must include the database security group",
      );
    }

    const databaseName = serverEnv.AURORA_DATABASE_NAME ?? "agent";
    const username = serverEnv.AURORA_MASTER_USERNAME ?? "agent_admin";
    const subnetGroup = new aws.rds.SubnetGroup("AuroraSubnets", {
      subnetIds,
      tags: { Application: $app.name, Stage: $app.stage },
    });
    const cluster = new aws.rds.Cluster("AuroraCluster", {
      backupRetentionPeriod: $app.stage === Stage.PRODUCTION ? 7 : 1,
      clusterIdentifier: `${$app.name}-${$app.stage}`,
      databaseName,
      dbClusterParameterGroupName: "default.aurora-postgresql16",
      dbSubnetGroupName: subnetGroup.name,
      deletionProtection: $app.stage === Stage.PRODUCTION,
      enableHttpEndpoint: true,
      engine: "aurora-postgresql",
      engineMode: "provisioned",
      masterPassword: required(
        "AURORA_MASTER_PASSWORD",
        serverEnv.AURORA_MASTER_PASSWORD,
      ),
      masterUsername: username,
      serverlessv2ScalingConfiguration: {
        maxCapacity: serverEnv.AURORA_MAX_ACU,
        minCapacity: serverEnv.AURORA_MIN_ACU,
      },
      skipFinalSnapshot: $app.stage !== Stage.PRODUCTION,
      storageEncrypted: true,
      vpcSecurityGroupIds: securityGroupIds,
      tags: { Application: $app.name, Stage: $app.stage },
    });

    new aws.rds.ClusterInstance("AuroraWriter", {
      clusterIdentifier: cluster.id,
      engine: cluster.engine,
      instanceClass: "db.serverless",
      publiclyAccessible: false,
      tags: { Application: $app.name, Stage: $app.stage },
    });

    return {
      databaseHost: cluster.endpoint,
      databaseName,
      databasePort: cluster.port,
      databaseUser: username,
    };
  },
});
