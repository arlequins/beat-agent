import {
  ApplicationErrorCode,
  toApplicationErrorContract,
} from "@arlequins/service";
import type { TRPC_ERROR_CODE_KEY } from "@trpc/server/rpc";

const TrpcCodeByApplicationCode: Record<
  (typeof ApplicationErrorCode)[keyof typeof ApplicationErrorCode],
  TRPC_ERROR_CODE_KEY
> = {
  [ApplicationErrorCode.CONFLICT]: "CONFLICT",
  [ApplicationErrorCode.FORBIDDEN]: "FORBIDDEN",
  [ApplicationErrorCode.INVALID_INPUT]: "BAD_REQUEST",
  [ApplicationErrorCode.NOT_FOUND]: "NOT_FOUND",
  [ApplicationErrorCode.UNAUTHORIZED]: "UNAUTHORIZED",
};

export function mapApplicationErrorToTrpc(error: unknown) {
  const contract = toApplicationErrorContract(error);
  if (!contract) return undefined;
  return { code: TrpcCodeByApplicationCode[contract.code], contract };
}
