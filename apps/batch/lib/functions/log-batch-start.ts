/**
 * Pipeline handler for `handlerKey` `log-batch-start` (RUNNING / audit / idempotency, etc.).
 * Registered in `config/handler.ts` (`HandlerMap`).
 */
import type { Handler } from "aws-lambda";

import type { HandlerInvokeEvent } from "..";
import { logStepPayload } from "../usecases/common/logging";

export const handler: Handler<
  HandlerInvokeEvent,
  { phase: "running"; received: unknown }
> = (event) => {
  logStepPayload("LogBatchStart", event.input);
  return Promise.resolve({
    phase: "running" as const,
    received: event.input,
  });
};
