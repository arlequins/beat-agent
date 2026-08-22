import { createAgentWorkerServices } from "@arlequins/trpc";
import {
  failAgentJob,
  parseAgentJob,
  processAgentJob,
} from "@arlequins/trpc/agent-jobs";

type SqsRecord = {
  attributes?: { ApproximateReceiveCount?: string };
  body: string;
  messageId: string;
};

export async function handler(event: { Records?: SqsRecord[] }) {
  const services = createAgentWorkerServices();
  const batchItemFailures: Array<{ itemIdentifier: string }> = [];
  for (const record of event.Records ?? []) {
    try {
      const job = parseAgentJob(JSON.parse(record.body) as unknown);
      await processAgentJob(services, job);
    } catch (error) {
      const receiveCount = Number(
        record.attributes?.ApproximateReceiveCount ?? "1",
      );
      if (receiveCount >= 3) {
        try {
          const job = parseAgentJob(JSON.parse(record.body) as unknown);
          await failAgentJob(services, job, error);
        } catch {
          // Preserve the original failure and let SQS move the record to the DLQ.
        }
      }
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }
  return { batchItemFailures };
}
