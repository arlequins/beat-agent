export type AsyncMessage<TPayload = unknown> = {
  causationId?: string;
  correlationId?: string;
  id: string;
  name: string;
  occurredAt: string;
  payload: TPayload;
  version: number;
};

export type EventPublisherPort = {
  publish(message: AsyncMessage): Promise<void>;
};

export type JobQueuePort = {
  enqueue(
    message: AsyncMessage,
    options?: {
      delaySeconds?: number;
      deduplicationId?: string;
      groupId?: string;
    },
  ): Promise<void>;
};

export type ScheduleRequest = {
  message: AsyncMessage;
  runAt: Date;
  scheduleId: string;
};

export type SchedulerPort = {
  cancel(scheduleId: string): Promise<void>;
  schedule(request: ScheduleRequest): Promise<void>;
};
