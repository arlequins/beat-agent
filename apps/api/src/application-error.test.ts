import {
  ApplicationInputError,
  ResourceNotFoundError,
} from "@arlequins/service";
import { describe, expect, it } from "vitest";

import { mapApplicationErrorToHttp } from "./application-error";

describe("HTTP application error adapter", () => {
  it.each([
    [new ApplicationInputError("Invalid input"), 400, "INVALID_INPUT"],
    [new ResourceNotFoundError("Missing"), 404, "NOT_FOUND"],
  ])("maps application errors", (error, status, code) => {
    expect(mapApplicationErrorToHttp(error)).toMatchObject({
      body: { error: { code } },
      status,
    });
  });

  it("does not expose unknown errors", () => {
    expect(mapApplicationErrorToHttp(new Error("secret"))).toBeUndefined();
  });
});
