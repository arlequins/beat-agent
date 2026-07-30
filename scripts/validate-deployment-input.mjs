import { fileURLToPath } from "node:url";

const APPLICATIONS = new Set(["api", "web"]);
const OPERATIONS = new Set(["deploy", "remove"]);
const STAGE_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;
const ROLE_ARN_PATTERN =
  /^arn:(?:aws|aws-cn|aws-us-gov):iam::\d{12}:role\/[A-Za-z0-9+=,.@_/-]+$/;
const AWS_REGION_PATTERN = /^[a-z]{2}(?:-gov)?-[a-z]+-\d+$/;

function required(value, label) {
  if (!value?.trim()) throw new Error(`${label} is required`);
  return value.trim();
}

export function validateDeploymentInput(input) {
  const application = required(input.application, "application");
  const operation = required(input.operation, "operation");
  const stage = required(input.stage, "stage");
  const region = required(input.region, "AWS region");
  const roleArn = required(input.roleArn, "role ARN");

  if (!APPLICATIONS.has(application)) {
    throw new Error("application must be api or web");
  }
  if (!OPERATIONS.has(operation)) {
    throw new Error("operation must be deploy or remove");
  }
  if (!STAGE_PATTERN.test(stage)) {
    throw new Error(
      "stage must contain lowercase letters, numbers, or internal hyphens",
    );
  }
  if (!ROLE_ARN_PATTERN.test(roleArn)) {
    throw new Error("role ARN must identify an AWS IAM role");
  }
  if (!AWS_REGION_PATTERN.test(region)) {
    throw new Error("AWS region must be a valid AWS region identifier");
  }
  return { application, operation, region, roleArn, stage };
}

function main() {
  validateDeploymentInput({
    application: process.env.DEPLOY_APPLICATION,
    operation: process.env.DEPLOY_OPERATION,
    region: process.env.DEPLOY_AWS_REGION,
    roleArn: process.env.DEPLOY_ROLE_ARN,
    stage: process.env.DEPLOY_STAGE,
  });
  console.log("Deployment inputs are valid.");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(
      "Invalid deployment configuration:",
      error instanceof Error ? error.message : "unknown error",
    );
    process.exit(1);
  }
}
