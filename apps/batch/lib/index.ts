/** Passed from Step Functions `lambdaInvoke.payload` for every pipeline handler Lambda. */
export type HandlerInvokeEvent<T = unknown> = {
  batchId: string;
  /** This batch’s `stateName` for the current step. */
  stateName: string;
  /** Previous step output or `StartExecution` input. */
  input: T;
};
