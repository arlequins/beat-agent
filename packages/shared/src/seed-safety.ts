const sampleSeedStages = new Set(["offline", "test"]);

export function isSampleSeedAllowed(
  stage: string | undefined,
  explicitlyEnabled = false,
): boolean {
  if (explicitlyEnabled) return true;
  return sampleSeedStages.has(stage?.trim().toLowerCase() ?? "");
}

export function assertSampleSeedAllowed(
  stage: string | undefined,
  explicitlyEnabled = false,
): void {
  if (isSampleSeedAllowed(stage, explicitlyEnabled)) return;

  throw new Error(
    `Sample seed data is disabled for SST_STAGE="${stage ?? "unset"}". Set SEED_SAMPLE_DATA=true to opt in explicitly.`,
  );
}
