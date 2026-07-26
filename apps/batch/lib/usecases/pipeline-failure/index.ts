/**
 * Called from `lib/functions/common/pipeline-failure.ts` when any pipeline step fails (after retries).
 * Wire Slack, SNS, PagerDuty, etc. here.
 */
export type PipelineFailurePayload = {
  /** From `lambdaInvoke.payload.batchId` in `sst.config.ts` (one shared failure Lambda). */
  batchId: string;
  /** Step Functions passes error context; shape varies by runtime. */
  errorEvent: unknown;
};

export function notifyPipelineFailureAlert(
  payload: PipelineFailurePayload,
): void {
  console.warn(
    "[PipelineFailure]",
    JSON.stringify({
      batchId: payload.batchId,
      errorEvent: payload.errorEvent,
    }),
  );
  // TODO: integrate alerting (e.g. Slack webhook, SNS topic).
}
