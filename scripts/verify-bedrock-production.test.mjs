import * as assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PRODUCTION_BEDROCK_EMBEDDING_MODEL_ARN,
  PRODUCTION_BEDROCK_EMBEDDING_MODEL_ID,
  PRODUCTION_BEDROCK_MODEL_ARN,
  PRODUCTION_BEDROCK_MODEL_ID,
  PRODUCTION_BEDROCK_REGION,
  validateBedrockContract,
  verifyBedrockAccess,
} from "./verify-bedrock-production.mjs";

const validInput = {
  embeddingModelId: PRODUCTION_BEDROCK_EMBEDDING_MODEL_ID,
  modelArn: PRODUCTION_BEDROCK_MODEL_ARN,
  modelId: PRODUCTION_BEDROCK_MODEL_ID,
  region: PRODUCTION_BEDROCK_REGION,
};

function modelMetadata(modelArn) {
  return JSON.stringify({
    modelDetails: {
      modelArn,
      modelLifecycle: { status: "ACTIVE" },
    },
  });
}

describe("Bedrock production contract", () => {
  it("accepts the fixed Tokyo Nova and Titan contract", () => {
    assert.deepEqual(validateBedrockContract(validInput), {
      embeddingModelArn: PRODUCTION_BEDROCK_EMBEDDING_MODEL_ARN,
      embeddingModelId: PRODUCTION_BEDROCK_EMBEDDING_MODEL_ID,
      modelArn: PRODUCTION_BEDROCK_MODEL_ARN,
      modelId: PRODUCTION_BEDROCK_MODEL_ID,
      region: PRODUCTION_BEDROCK_REGION,
    });
  });

  it("rejects region, model, and ARN drift", () => {
    assert.throws(
      () => validateBedrockContract({ ...validInput, region: "us-east-1" }),
      /must run in ap-northeast-1/,
    );
    assert.throws(
      () => validateBedrockContract({ ...validInput, modelId: "other" }),
      /BEDROCK_MODEL_ID must be/,
    );
    assert.throws(
      () =>
        validateBedrockContract({
          ...validInput,
          modelArn: "arn:aws:bedrock:ap-northeast-1::foundation-model/other",
        }),
      /BEDROCK_MODEL_ARN must be/,
    );
    assert.throws(
      () =>
        validateBedrockContract({ ...validInput, embeddingModelId: "other" }),
      /BEDROCK_EMBEDDING_MODEL_ID must be/,
    );
  });

  it("checks both model metadata endpoints without exposing credentials", () => {
    const calls = [];
    const execFile = (command, args) => {
      calls.push({ command, args });
      return args.includes(PRODUCTION_BEDROCK_MODEL_ID)
        ? modelMetadata(PRODUCTION_BEDROCK_MODEL_ARN)
        : modelMetadata(PRODUCTION_BEDROCK_EMBEDDING_MODEL_ARN);
    };
    const result = verifyBedrockAccess(validInput, execFile);
    assert.equal(result.modelStatus, "ACTIVE");
    assert.equal(result.embeddingStatus, "ACTIVE");
    assert.deepEqual(
      calls.map(({ command, args }) => [command, args.slice(0, 4)]),
      [
        [
          "aws",
          [
            "bedrock",
            "get-foundation-model",
            "--model-identifier",
            PRODUCTION_BEDROCK_MODEL_ID,
          ],
        ],
        [
          "aws",
          [
            "bedrock",
            "get-foundation-model",
            "--model-identifier",
            PRODUCTION_BEDROCK_EMBEDDING_MODEL_ID,
          ],
        ],
      ],
    );
  });

  it("rejects inactive or mismatched AWS metadata", () => {
    assert.throws(
      () =>
        verifyBedrockAccess(validInput, (_command, args) =>
          modelMetadata(
            args.includes(PRODUCTION_BEDROCK_MODEL_ID)
              ? PRODUCTION_BEDROCK_MODEL_ARN
              : "arn:aws:bedrock:ap-northeast-1::foundation-model/other",
          ),
        ),
      /unexpected ARN/,
    );
  });
});
