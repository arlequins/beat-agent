/** User-facing copy (also sent as `shape.message` when applicable). */
export const TRPC_INFRASTRUCTURE_UNAVAILABLE_MESSAGE =
  "cannot connect to the server. please try again later.";

export const TRPC_UNAUTHORIZED_MESSAGE =
  "you must be signed in to perform this action.";

export const TRPC_GENERIC_CLIENT_MESSAGE =
  "cannot process your request. please try again later.";

/** Serialized on `data` for clients (TanStack Query / tRPC client). */
export type TrpcClientErrorFlags = {
  applicationError?: ReturnType<typeof toApplicationErrorContract>;
  infrastructureUnavailable: boolean;
  unauthorized: boolean;
};

function readTrpcErrorPayload(error: unknown): {
  data?: TrpcClientErrorFlags & Record<string, unknown>;
} {
  if (!error || typeof error !== "object") return {};
  return error as { data?: TrpcClientErrorFlags & Record<string, unknown> };
}

export function isTrpcInfrastructureUnavailableError(error: unknown): boolean {
  return readTrpcErrorPayload(error).data?.infrastructureUnavailable === true;
}

export function isTrpcUnauthorizedError(error: unknown): boolean {
  return readTrpcErrorPayload(error).data?.unauthorized === true;
}

/** Prefer server-provided `error.message` when we tagged the error; else generic. */
export function getTrpcUserFacingMessage(error: unknown): string {
  if (isTrpcInfrastructureUnavailableError(error)) {
    return TRPC_INFRASTRUCTURE_UNAVAILABLE_MESSAGE;
  }
  if (isTrpcUnauthorizedError(error)) {
    return TRPC_UNAUTHORIZED_MESSAGE;
  }
  if (error && typeof error === "object" && "message" in error) {
    const msg = (error as { message: unknown }).message;
    if (typeof msg === "string" && msg.length > 0) {
      return msg;
    }
  }
  return TRPC_GENERIC_CLIENT_MESSAGE;
}

/* ─── server: connection detection ─── */

const CONNECTION_LIKE_CODES = new Set([
  "ECONNREFUSED",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ECONNRESET",
]);

function visitErrorChain(node: unknown, depth: number): boolean {
  if (depth > 14 || node == null) return false;

  if (typeof node === "object") {
    const rec = node as Record<string, unknown>;
    const code = rec.code;
    if (typeof code === "string" && CONNECTION_LIKE_CODES.has(code)) {
      return true;
    }

    if (node instanceof AggregateError && Array.isArray(node.errors)) {
      for (const inner of node.errors) {
        if (visitErrorChain(inner, depth + 1)) return true;
      }
    }

    if ("cause" in rec && rec.cause !== undefined) {
      return visitErrorChain(rec.cause, depth + 1);
    }
  }

  return false;
}

export function isInfrastructureConnectionError(error: unknown): boolean {
  return visitErrorChain(error, 0);
}

function isUnauthorizedTrpcError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "UNAUTHORIZED"
  );
}

/**
 * Central place for tRPC `errorFormatter`: flags on `data`, safe `message`, preserve zod flatten.
 */
export function formatTrpcErrorShape<
  T extends { message: string; data: Record<string, unknown> },
>(opts: { shape: T; error: unknown; zodError: unknown }): T {
  const { shape, error, zodError } = opts;

  const infrastructureUnavailable =
    isInfrastructureConnectionError(error) ||
    isInfrastructureConnectionError(
      error && typeof error === "object" && "cause" in error
        ? (error as { cause: unknown }).cause
        : undefined,
    );

  const unauthorized = isUnauthorizedTrpcError(error);
  const applicationError = toApplicationErrorContract(
    error && typeof error === "object" && "cause" in error
      ? (error as { cause: unknown }).cause
      : error,
  );

  let message = shape.message;
  if (infrastructureUnavailable) {
    message = TRPC_INFRASTRUCTURE_UNAVAILABLE_MESSAGE;
  } else if (unauthorized) {
    message = TRPC_UNAUTHORIZED_MESSAGE;
  }

  return {
    ...shape,
    message,
    data: {
      ...shape.data,
      zodError,
      applicationError,
      infrastructureUnavailable,
      unauthorized,
    },
  };
}

import { toApplicationErrorContract } from "@arlequins/service";
