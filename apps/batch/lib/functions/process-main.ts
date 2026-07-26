/**
 * Pipeline handler for `handlerKey` `process-main` (ETL, API call, …).
 * Registered in `config/handler.ts` (`HandlerMap`).
 */
import type { Handler } from "aws-lambda";

import type { HandlerInvokeEvent } from "..";
import { processMain } from "../composition/process-main";
import { logStepPayload } from "../usecases/common/logging";

export type ProcessMainEvent = HandlerInvokeEvent<{ type: "raw" | "db-query" }>;

export const handler: Handler<
  ProcessMainEvent,
  { ok: true; detail?: string }
> = async (event) => {
  logStepPayload("ProcessMain", event.input);

  await processMain(event);

  return Promise.resolve({
    ok: true as const,
  });
};
