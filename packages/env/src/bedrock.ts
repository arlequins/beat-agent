/**
 * The first production model is deliberately fixed to a Tokyo foundation
 * model. Keeping the contract here prevents a deployment from silently
 * falling back to a different model or region while the runtime permission
 * remains scoped to one ARN.
 */
export const PRODUCTION_BEDROCK_MODEL_ID = "amazon.nova-lite-v1:0" as const;
export const PRODUCTION_BEDROCK_REGION = "ap-northeast-1" as const;
export const PRODUCTION_BEDROCK_MODEL_ARN =
  `arn:aws:bedrock:${PRODUCTION_BEDROCK_REGION}::foundation-model/${PRODUCTION_BEDROCK_MODEL_ID}` as const;

export type BedrockConfiguration = {
  modelArn?: string;
  modelId?: string;
};

type BedrockConfigurationInput = {
  modelArn?: string;
  modelId?: string;
  region: string;
  stage: string;
};

/**
 * Resolve the optional local/sandbox model and the mandatory production one.
 * Production values are injected by the protected deployment environment; no
 * secret or credential is represented by this configuration.
 */
export function resolveBedrockConfiguration(
  input: BedrockConfigurationInput,
): BedrockConfiguration {
  const modelId = input.modelId?.trim() || undefined;
  const modelArn = input.modelArn?.trim() || undefined;

  if (input.stage !== "production") {
    return { modelArn, modelId };
  }

  if (!modelId || !modelArn) {
    throw new Error(
      "Production requires BEDROCK_MODEL_ID and BEDROCK_MODEL_ARN in the protected deployment environment",
    );
  }
  if (input.region !== PRODUCTION_BEDROCK_REGION) {
    throw new Error(
      `Production Bedrock must run in ${PRODUCTION_BEDROCK_REGION}`,
    );
  }
  if (modelId !== PRODUCTION_BEDROCK_MODEL_ID) {
    throw new Error(
      `Production BEDROCK_MODEL_ID must be ${PRODUCTION_BEDROCK_MODEL_ID}`,
    );
  }
  if (modelArn !== PRODUCTION_BEDROCK_MODEL_ARN) {
    throw new Error(
      `Production BEDROCK_MODEL_ARN must be ${PRODUCTION_BEDROCK_MODEL_ARN}`,
    );
  }

  return { modelArn, modelId };
}
