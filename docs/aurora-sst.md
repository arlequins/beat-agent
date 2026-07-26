# Optional Aurora PostgreSQL with SST

`apps/database/sst.config.ts` provisions a private Aurora PostgreSQL Serverless v2
cluster and one serverless writer instance. It is disabled unless
`AURORA_ENABLED=true`; this is intentional because Aurora is not a guaranteed
free-tier service.

## Before deployment

1. Create or select a VPC with private subnets in at least two Availability Zones.
2. Create a database security group that allows PostgreSQL only from the API and
   batch Lambda security groups.
3. Put the master password in a local untracked `.env` or inject it from Secrets
   Manager in CI. Never commit it.
4. Review current regional prices. Do not add a NAT Gateway merely for this
   template; it creates a standing charge.

Example `.env` values:

```dotenv
SST_STAGE=develop
SST_AWS_REGION=ap-northeast-1
AURORA_ENABLED=true
AURORA_SUBNET_IDS=subnet-private-a,subnet-private-c
AURORA_SECURITY_GROUP_IDS=sg-agent-aurora
AURORA_DATABASE_NAME=agent
AURORA_MASTER_USERNAME=agent_admin
AURORA_MASTER_PASSWORD=use-a-secret-manager-value-here
AURORA_MIN_ACU=0.5
AURORA_MAX_ACU=1
```

Deploy with `pnpm database:deploy -- --stage develop`. SST prints the host,
port, database, and username. Copy those non-secret values into the API and
batch environment; inject the same password through Secrets Manager. Attach API
and batch Lambdas to the VPC using the existing `SUBNET_IDS` and
`SECURITY_GROUP_IDS` configuration.

## Cost profiles

- **Local and free-tier-first:** keep Aurora disabled; use Docker PostgreSQL and
  a local model. This is the default.
- **Personal AWS proof of concept:** use low-request services first. Do not
  assume Bedrock model inference or Aurora capacity is free.
- **Enterprise knowledge base:** enable Aurora when relational history,
  permissions, audit records, and complex retrieval justify it.

The later `beat-agent` project should start with the first profile. Aurora is a
supported upgrade path, not its default dependency.
