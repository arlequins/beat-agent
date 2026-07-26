import type { EventBridgeClient } from "@aws-sdk/client-eventbridge";
import type { SchedulerClient } from "@aws-sdk/client-scheduler";
import type { SQSClient } from "@aws-sdk/client-sqs";
import { describe, expect, it, vi } from "vitest";
import {
  createEventBridgePublisher,
  createEventBridgeScheduler,
  createSqsJobQueue,
} from "./aws-async";

const message = {
  correlationId: "trace-1",
  id: "message-1",
  name: "content.created",
  occurredAt: "2026-07-22T00:00:00.000Z",
  payload: { contentId: "content-1" },
  version: 1,
};

describe("AWS async adapters", () => {
  it("maps events without leaking AWS types into the application port", async () => {
    const send = vi.fn().mockResolvedValue({ FailedEntryCount: 0 });
    const publisher = createEventBridgePublisher({
      client: { send } as unknown as EventBridgeClient,
      eventBusName: "app-events",
      source: "acme.api",
    });

    await publisher.publish(message);

    expect(send.mock.calls[0]?.[0].input).toMatchObject({
      Entries: [
        {
          Detail: JSON.stringify(message),
          DetailType: "content.created",
          EventBusName: "app-events",
          Source: "acme.api",
        },
      ],
    });
  });

  it("maps queue options and message metadata", async () => {
    const send = vi.fn().mockResolvedValue({});
    const queue = createSqsJobQueue({
      client: { send } as unknown as SQSClient,
      queueUrl: "https://sqs.example/jobs.fifo",
    });

    await queue.enqueue(message, {
      deduplicationId: "dedupe-1",
      groupId: "content",
    });

    expect(send.mock.calls[0]?.[0].input).toMatchObject({
      MessageBody: JSON.stringify(message),
      MessageDeduplicationId: "dedupe-1",
      MessageGroupId: "content",
      QueueUrl: "https://sqs.example/jobs.fifo",
    });
  });

  it("creates one-time UTC schedules and deletes them by id", async () => {
    const send = vi.fn().mockResolvedValue({});
    const scheduler = createEventBridgeScheduler({
      client: { send } as unknown as SchedulerClient,
      groupName: "application",
      roleArn: "arn:aws:iam::123456789012:role/scheduler",
      targetArn: "arn:aws:sqs:ap-northeast-1:123456789012:jobs",
    });

    await scheduler.schedule({
      message,
      runAt: new Date("2026-07-23T01:02:03.000Z"),
      scheduleId: "schedule-1",
    });
    await scheduler.cancel("schedule-1");

    expect(send.mock.calls[0]?.[0].input).toMatchObject({
      ActionAfterCompletion: "DELETE",
      Name: "schedule-1",
      ScheduleExpression: "at(2026-07-23T01:02:03)",
      ScheduleExpressionTimezone: "UTC",
    });
    expect(send.mock.calls[1]?.[0].input).toEqual({
      GroupName: "application",
      Name: "schedule-1",
    });
  });
});
