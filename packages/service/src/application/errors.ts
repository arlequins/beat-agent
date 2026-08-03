export const ApplicationErrorCode = {
  CONFLICT: "CONFLICT",
  FORBIDDEN: "FORBIDDEN",
  INVALID_INPUT: "INVALID_INPUT",
  NOT_FOUND: "NOT_FOUND",
  UNAUTHORIZED: "UNAUTHORIZED",
} as const;
export type ApplicationErrorCode =
  (typeof ApplicationErrorCode)[keyof typeof ApplicationErrorCode];

export type ApplicationErrorContract = {
  code: ApplicationErrorCode;
  message: string;
  metadata?: Readonly<Record<string, unknown>>;
};

export class ApplicationError extends Error {
  override readonly name: string = "ApplicationError";
  readonly code: ApplicationErrorCode;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly publicMessage: string;

  constructor(options: {
    cause?: unknown;
    code: ApplicationErrorCode;
    message: string;
    metadata?: Readonly<Record<string, unknown>>;
    publicMessage?: string;
  }) {
    super(options.message, { cause: options.cause });
    this.code = options.code;
    this.metadata = options.metadata;
    this.publicMessage = options.publicMessage ?? options.message;
  }
}

export class ApplicationInputError extends ApplicationError {
  override readonly name = "ApplicationInputError";
  constructor(message: string, metadata?: Readonly<Record<string, unknown>>) {
    super({ code: ApplicationErrorCode.INVALID_INPUT, message, metadata });
  }
}

export class ResourceNotFoundError extends ApplicationError {
  override readonly name = "ResourceNotFoundError";
  constructor(message: string, metadata?: Readonly<Record<string, unknown>>) {
    super({ code: ApplicationErrorCode.NOT_FOUND, message, metadata });
  }
}

export class ResourceConflictError extends ApplicationError {
  override readonly name = "ResourceConflictError";
  constructor(message: string, metadata?: Readonly<Record<string, unknown>>) {
    super({ code: ApplicationErrorCode.CONFLICT, message, metadata });
  }
}

export function toApplicationErrorContract(
  error: unknown,
): ApplicationErrorContract | undefined {
  if (!(error instanceof ApplicationError)) return undefined;
  return {
    code: error.code,
    message: error.publicMessage,
    ...(error.metadata ? { metadata: error.metadata } : {}),
  };
}
