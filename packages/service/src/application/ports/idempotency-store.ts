export type IdempotencyRequest = {
  expiresAt: Date;
  fingerprint: string;
  key: string;
  scope: string;
};

export type IdempotencyClaim =
  | { status: "acquired" }
  | { status: "conflict" }
  | { status: "replay"; value: unknown };

export type IdempotencyStorePort = {
  abandon(request: Omit<IdempotencyRequest, "expiresAt">): Promise<void>;
  begin(request: IdempotencyRequest): Promise<IdempotencyClaim>;
  complete(
    request: Omit<IdempotencyRequest, "expiresAt">,
    value: unknown,
  ): Promise<void>;
};
