import type {
  EventPublisherPort,
  JobQueuePort,
  SchedulerPort,
} from "@arlequins/service";
import {
  EventBridgeClient,
  PutEventsCommand,
} from "@aws-sdk/client-eventbridge";
import {
  CreateScheduleCommand,
  DeleteScheduleCommand,
  SchedulerClient,
} from "@aws-sdk/client-scheduler";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";

export function createEventBridgePublisher(options: {
  client?: EventBridgeClient;
  eventBusName?: string;
  source: string;
}): EventPublisherPort {
  const client = options.client ?? new EventBridgeClient({});
  return {
    async publish(message) {
      const response = await client.send(
        new PutEventsCommand({
          Entries: [
            {
              Detail: JSON.stringify(message),
              DetailType: message.name,
              EventBusName: options.eventBusName,
              Source: options.source,
              Time: new Date(message.occurredAt),
              TraceHeader: message.correlationId,
            },
          ],
        }),
      );
      if (response.FailedEntryCount) {
        throw new Error(
          `EventBridge rejected ${response.FailedEntryCount} event(s)`,
        );
      }
    },
  };
}

export function createSqsJobQueue(options: {
  client?: SQSClient;
  queueUrl: string;
}): JobQueuePort {
  const client = options.client ?? new SQSClient({});
  return {
    async enqueue(message, enqueueOptions) {
      await client.send(
        new SendMessageCommand({
          DelaySeconds: enqueueOptions?.delaySeconds,
          MessageBody: JSON.stringify(message),
          MessageDeduplicationId: enqueueOptions?.deduplicationId,
          MessageGroupId: enqueueOptions?.groupId,
          MessageAttributes: {
            messageName: {
              DataType: "String",
              StringValue: message.name,
            },
            messageVersion: {
              DataType: "Number",
              StringValue: String(message.version),
            },
          },
          QueueUrl: options.queueUrl,
        }),
      );
    },
  };
}

function toScheduleExpression(runAt: Date) {
  return `at(${runAt.toISOString().replace(/\.\d{3}Z$/, "")})`;
}

export function createEventBridgeScheduler(options: {
  client?: SchedulerClient;
  groupName?: string;
  roleArn: string;
  targetArn: string;
}): SchedulerPort {
  const client = options.client ?? new SchedulerClient({});
  return {
    async cancel(scheduleId) {
      await client.send(
        new DeleteScheduleCommand({
          GroupName: options.groupName,
          Name: scheduleId,
        }),
      );
    },
    async schedule(request) {
      await client.send(
        new CreateScheduleCommand({
          ActionAfterCompletion: "DELETE",
          FlexibleTimeWindow: { Mode: "OFF" },
          GroupName: options.groupName,
          Name: request.scheduleId,
          ScheduleExpression: toScheduleExpression(request.runAt),
          ScheduleExpressionTimezone: "UTC",
          Target: {
            Arn: options.targetArn,
            Input: JSON.stringify(request.message),
            RoleArn: options.roleArn,
          },
        }),
      );
    },
  };
}
