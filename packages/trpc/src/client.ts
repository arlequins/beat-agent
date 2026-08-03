/**
 * Browser-safe entry: HTTP constants + router types only.
 * Do not import `@arlequins/trpc` from Client Components — it pulls server-only adapters.
 */
export { TRPC_HTTP_PATH } from "./constants";
export {
  getTrpcUserFacingMessage,
  isTrpcInfrastructureUnavailableError,
  isTrpcUnauthorizedError,
  TRPC_GENERIC_CLIENT_MESSAGE,
  TRPC_INFRASTRUCTURE_UNAVAILABLE_MESSAGE,
  TRPC_UNAUTHORIZED_MESSAGE,
} from "./errors";
export type { AppRouter, RouterInputs, RouterOutputs } from "./types";
