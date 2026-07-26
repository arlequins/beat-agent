/**
 * Browser-safe entry: HTTP constants + router types only.
 * Do not import `@arlequins/trpc` from Client Components — it pulls server code (`postgres`, etc.).
 */
export { TRPC_HTTP_PATH } from "./constants";
export {
  getTrpcUserFacingMessage,
  isTrpcDatabaseUnavailableError,
  isTrpcUnauthorizedError,
  TRPC_DATABASE_UNAVAILABLE_MESSAGE,
  TRPC_GENERIC_CLIENT_MESSAGE,
  TRPC_UNAUTHORIZED_MESSAGE,
} from "./errors";
export type { AppRouter, RouterInputs, RouterOutputs } from "./types";
