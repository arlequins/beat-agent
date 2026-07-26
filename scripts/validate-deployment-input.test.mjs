import * as assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateDeploymentInput } from "./validate-deployment-input.mjs";

const validInput = {
  application: "api",
  operation: "deploy",
  roleArn: "arn:aws:iam::123456789012:role/github-production",
  secretName: "arn:aws:secretsmanager:us-east-1:123456789012:secret:app",
  stage: "production",
};

describe("deployment input validation", () => {
  it("accepts supported deployment values", () => {
    assert.deepEqual(validateDeploymentInput(validInput), validInput);
    assert.equal(
      validateDeploymentInput({ ...validInput, stage: "pr-46" }).stage,
      "pr-46",
    );
  });

  it("rejects command and stage injection", () => {
    assert.throws(
      () =>
        validateDeploymentInput({
          ...validInput,
          application: "api; echo unsafe",
        }),
      /application must be/,
    );
    assert.throws(
      () =>
        validateDeploymentInput({
          ...validInput,
          stage: "production --verbose",
        }),
      /stage must contain/,
    );
  });

  it("requires deployment infrastructure configuration", () => {
    assert.throws(
      () => validateDeploymentInput({ ...validInput, roleArn: "" }),
      /role ARN is required/,
    );
    assert.throws(
      () => validateDeploymentInput({ ...validInput, secretName: "" }),
      /deployment secret name is required/,
    );
  });
});
