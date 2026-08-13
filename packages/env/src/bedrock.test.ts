import { describe, expect, it } from "vitest";
import {
  PRODUCTION_BEDROCK_MODEL_ARN,
  PRODUCTION_BEDROCK_MODEL_ID,
  PRODUCTION_BEDROCK_REGION,
  resolveBedrockConfiguration,
} from "./bedrock";

const production = {
  modelArn: PRODUCTION_BEDROCK_MODEL_ARN,
  modelId: PRODUCTION_BEDROCK_MODEL_ID,
  region: PRODUCTION_BEDROCK_REGION,
  stage: "production",
};

describe("resolveBedrockConfiguration", () => {
  it("keeps Bedrock optional outside production", () => {
    expect(
      resolveBedrockConfiguration({ region: "us-east-1", stage: "offline" }),
    ).toEqual({ modelArn: undefined, modelId: undefined });
    expect(
      resolveBedrockConfiguration({
        ...production,
        modelArn: undefined,
        modelId: undefined,
        stage: "pr-42",
      }),
    ).toEqual({ modelArn: undefined, modelId: undefined });
  });

  it("accepts the approved Tokyo Nova Lite contract", () => {
    expect(resolveBedrockConfiguration(production)).toEqual({
      modelArn: PRODUCTION_BEDROCK_MODEL_ARN,
      modelId: PRODUCTION_BEDROCK_MODEL_ID,
    });
  });

  it("requires both protected production values", () => {
    expect(() =>
      resolveBedrockConfiguration({
        ...production,
        modelArn: undefined,
      }),
    ).toThrow("BEDROCK_MODEL_ID and BEDROCK_MODEL_ARN");
    expect(() =>
      resolveBedrockConfiguration({
        ...production,
        modelId: undefined,
      }),
    ).toThrow("BEDROCK_MODEL_ID and BEDROCK_MODEL_ARN");
  });

  it("rejects a model, ARN, or region outside the approved boundary", () => {
    expect(() =>
      resolveBedrockConfiguration({
        ...production,
        modelId: "amazon.nova-micro-v1:0",
      }),
    ).toThrow(`BEDROCK_MODEL_ID must be ${PRODUCTION_BEDROCK_MODEL_ID}`);
    expect(() =>
      resolveBedrockConfiguration({
        ...production,
        modelArn: "arn:aws:bedrock:us-east-1::foundation-model/other",
      }),
    ).toThrow(`BEDROCK_MODEL_ARN must be ${PRODUCTION_BEDROCK_MODEL_ARN}`);
    expect(() =>
      resolveBedrockConfiguration({
        ...production,
        region: "us-east-1",
      }),
    ).toThrow(`must run in ${PRODUCTION_BEDROCK_REGION}`);
  });
});
