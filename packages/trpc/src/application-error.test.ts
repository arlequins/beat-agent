import { ResourceConflictError } from "@arlequins/service";
import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";

import { mapApplicationErrorToTrpc } from "./application-error";
import { formatTrpcErrorShape } from "./errors";

describe("tRPC application error adapter", () => {
  it("maps application conflicts without adding transport concerns to the error", () => {
    expect(
      mapApplicationErrorToTrpc(new ResourceConflictError("Stale version")),
    ).toEqual({
      code: "CONFLICT",
      contract: { code: "CONFLICT", message: "Stale version" },
    });
  });

  it("serializes the stable application code for clients", () => {
    const cause = new ResourceConflictError("Stale version");
    const error = new TRPCError({ cause, code: "CONFLICT" });
    const shape = formatTrpcErrorShape({
      error,
      shape: {
        data: {} as Record<string, unknown>,
        message: error.message,
      },
      zodError: null,
    });
    expect(shape.data.applicationError).toEqual({
      code: "CONFLICT",
      message: "Stale version",
    });
  });
});
