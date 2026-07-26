import {
  ApplicationErrorCode,
  toApplicationErrorContract,
} from "@arlequins/service";

const HttpStatusByApplicationCode = {
  [ApplicationErrorCode.CONFLICT]: 409,
  [ApplicationErrorCode.FORBIDDEN]: 403,
  [ApplicationErrorCode.INVALID_INPUT]: 400,
  [ApplicationErrorCode.NOT_FOUND]: 404,
  [ApplicationErrorCode.UNAUTHORIZED]: 401,
} as const;

export function mapApplicationErrorToHttp(error: unknown) {
  const contract = toApplicationErrorContract(error);
  if (!contract) return undefined;
  return {
    body: { error: contract },
    status: HttpStatusByApplicationCode[contract.code],
  };
}
