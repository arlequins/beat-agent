import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const PRODUCTION_BEDROCK_REGION = "ap-northeast-1";
export const PRODUCTION_BEDROCK_MODEL_ID = "amazon.nova-lite-v1:0";
export const PRODUCTION_BEDROCK_MODEL_ARN = `arn:aws:bedrock:${PRODUCTION_BEDROCK_REGION}::foundation-model/${PRODUCTION_BEDROCK_MODEL_ID}`;
export const PRODUCTION_BEDROCK_EMBEDDING_MODEL_ID =
  "amazon.titan-embed-text-v2:0";
export const PRODUCTION_BEDROCK_EMBEDDING_MODEL_ARN = `arn:aws:bedrock:${PRODUCTION_BEDROCK_REGION}::foundation-model/${PRODUCTION_BEDROCK_EMBEDDING_MODEL_ID}`;

function required(value, label) {
  if (!value?.trim()) throw new Error(`${label} is required`);
  return value.trim();
}

export function validateBedrockContract(input) {
  const region = required(input.region, "AWS region");
  const modelId = required(input.modelId, "BEDROCK_MODEL_ID");
  const modelArn = required(input.modelArn, "BEDROCK_MODEL_ARN");
  const embeddingModelId = required(
    input.embeddingModelId,
    "BEDROCK_EMBEDDING_MODEL_ID",
  );

  if (region !== PRODUCTION_BEDROCK_REGION)
    throw new Error(
      `Production Bedrock must run in ${PRODUCTION_BEDROCK_REGION}`,
    );
  if (modelId !== PRODUCTION_BEDROCK_MODEL_ID)
    throw new Error(`BEDROCK_MODEL_ID must be ${PRODUCTION_BEDROCK_MODEL_ID}`);
  if (modelArn !== PRODUCTION_BEDROCK_MODEL_ARN)
    throw new Error(
      `BEDROCK_MODEL_ARN must be ${PRODUCTION_BEDROCK_MODEL_ARN}`,
    );
  if (embeddingModelId !== PRODUCTION_BEDROCK_EMBEDDING_MODEL_ID)
    throw new Error(
      `BEDROCK_EMBEDDING_MODEL_ID must be ${PRODUCTION_BEDROCK_EMBEDDING_MODEL_ID}`,
    );

  return {
    embeddingModelArn: PRODUCTION_BEDROCK_EMBEDDING_MODEL_ARN,
    embeddingModelId,
    modelArn,
    modelId,
    region,
  };
}

function readModelDetails(modelId, region, execFile = execFileSync) {
  let output;
  try {
    output = execFile(
      "aws",
      [
        "bedrock",
        "get-foundation-model",
        "--model-identifier",
        modelId,
        "--region",
        region,
        "--output",
        "json",
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
  } catch (error) {
    const details = error instanceof Error ? error.message : "unknown error";
    throw new Error(
      `Unable to verify Bedrock model access for ${modelId}: ${details}`,
    );
  }

  try {
    return JSON.parse(output);
  } catch {
    throw new Error(`AWS returned invalid Bedrock metadata for ${modelId}`);
  }
}

function assertActiveModel(details, expectedArn, modelId) {
  const modelDetails = details?.modelDetails;
  if (!modelDetails || modelDetails.modelArn !== expectedArn)
    throw new Error(`Bedrock returned an unexpected ARN for ${modelId}`);
  if (modelDetails.modelLifecycle?.status !== "ACTIVE")
    throw new Error(
      `Bedrock model ${modelId} is not active (${modelDetails.modelLifecycle?.status ?? "unknown"})`,
    );
}

export function verifyBedrockAccess(input, execFile = execFileSync) {
  const contract = validateBedrockContract(input);
  const model = readModelDetails(contract.modelId, contract.region, execFile);
  const embedding = readModelDetails(
    contract.embeddingModelId,
    contract.region,
    execFile,
  );
  assertActiveModel(model, contract.modelArn, contract.modelId);
  assertActiveModel(
    embedding,
    contract.embeddingModelArn,
    contract.embeddingModelId,
  );
  return {
    embeddingStatus: embedding.modelDetails.modelLifecycle.status,
    modelStatus: model.modelDetails.modelLifecycle.status,
    ...contract,
  };
}

function main() {
  const result = verifyBedrockAccess({
    embeddingModelId: process.env.BEDROCK_EMBEDDING_MODEL_ID,
    modelArn: process.env.BEDROCK_MODEL_ARN,
    modelId: process.env.BEDROCK_MODEL_ID,
    region: process.env.AWS_REGION,
  });
  console.log(
    `Bedrock production contract passed: ${result.modelId} (${result.modelStatus}), ${PRODUCTION_BEDROCK_EMBEDDING_MODEL_ID} (${result.embeddingStatus}) in ${result.region}.`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(
      "Bedrock production contract failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    process.exit(1);
  }
}
