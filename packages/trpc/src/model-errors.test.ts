import { describe, expect, it } from "vitest";
import {
  modelNotConfiguredMessage,
  modelRequestFailureMessage,
} from "./model-errors";

describe("model error messages", () => {
  it("identifies the configured provider in request failures", () => {
    expect(modelRequestFailureMessage("bedrock")).toBe(
      "Bedrock model request failed",
    );
    expect(modelRequestFailureMessage("ollama")).toBe(
      "Ollama model request failed",
    );
    expect(modelRequestFailureMessage("test")).toBe(
      "Test model request failed",
    );
    expect(modelRequestFailureMessage("none")).toBe("Model request failed");
  });

  it("identifies the configured provider when no model is available", () => {
    expect(modelNotConfiguredMessage("bedrock")).toBe(
      "Bedrock model completion is not configured",
    );
    expect(modelNotConfiguredMessage("ollama")).toBe(
      "Ollama model completion is not configured",
    );
    expect(modelNotConfiguredMessage("none")).toBe(
      "Model completion is not configured",
    );
  });
});
