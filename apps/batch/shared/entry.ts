/**
 * Default cron starter (`manifest.starterHandler`): `StartExecution` using `STATE_MACHINE_ARN`
 * from `sst.config.ts` CronV2 `environment`.
 */

import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";
import type { Handler } from "aws-lambda";

const client = new SFNClient({});

function requireStateMachineArn(): string {
  const arn = process.env.STATE_MACHINE_ARN?.trim();
  if (!arn) {
    throw new Error(
      "STATE_MACHINE_ARN is required (set by CronV2 in sst.config.ts)",
    );
  }
  return arn;
}

export const handler: Handler = async () => {
  await client.send(
    new StartExecutionCommand({
      stateMachineArn: requireStateMachineArn(),
      name: `cron-${Date.now()}`,
    }),
  );
};
