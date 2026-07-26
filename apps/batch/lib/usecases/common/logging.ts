/** Structured log line for step debugging / audit (safe to call from pipeline handlers). */
export function logStepPayload(scope: string, event: unknown): void {
  console.log(`[${scope}]`, JSON.stringify({ event }));
}
