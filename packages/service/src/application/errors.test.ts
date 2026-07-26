import { describe, expect, it } from "vitest";

import {
  ApplicationErrorCode,
  ApplicationInputError,
  ResourceConflictError,
  toApplicationErrorContract,
} from "./errors";

describe("application error contract", () => {
  it("serializes stable public data without exposing implementation fields", () => {
    expect(
      toApplicationErrorContract(
        new ResourceConflictError("Version is stale", { resourceId: "one" }),
      ),
    ).toEqual({
      code: ApplicationErrorCode.CONFLICT,
      message: "Version is stale",
      metadata: { resourceId: "one" },
    });
  });

  it("ignores unknown infrastructure errors", () => {
    expect(
      toApplicationErrorContract(new Error("database password")),
    ).toBeUndefined();
    expect(new ApplicationInputError("Invalid title").code).toBe(
      ApplicationErrorCode.INVALID_INPUT,
    );
  });
});
