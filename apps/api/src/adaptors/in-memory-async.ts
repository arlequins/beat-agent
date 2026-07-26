import type {
  AsyncMessage,
  EventPublisherPort,
  JobQueuePort,
  ScheduleRequest,
  SchedulerPort,
} from "@arlequins/service";

export type InMemoryAsyncState = {
  events: AsyncMessage[];
  jobs: Array<{
    message: AsyncMessage;
    options?: Parameters<JobQueuePort["enqueue"]>[1];
  }>;
  schedules: Map<string, ScheduleRequest>;
};

export function createInMemoryAsyncAdapters(
  state: InMemoryAsyncState = {
    events: [],
    jobs: [],
    schedules: new Map(),
  },
): {
  events: EventPublisherPort;
  jobs: JobQueuePort;
  scheduler: SchedulerPort;
  state: InMemoryAsyncState;
} {
  return {
    events: {
      async publish(message) {
        state.events.push(structuredClone(message));
      },
    },
    jobs: {
      async enqueue(message, options) {
        state.jobs.push({
          message: structuredClone(message),
          ...(options ? { options: structuredClone(options) } : {}),
        });
      },
    },
    scheduler: {
      async cancel(scheduleId) {
        state.schedules.delete(scheduleId);
      },
      async schedule(request) {
        state.schedules.set(request.scheduleId, structuredClone(request));
      },
    },
    state,
  };
}
