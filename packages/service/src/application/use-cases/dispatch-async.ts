import type {
  AsyncMessage,
  EventPublisherPort,
  JobQueuePort,
  SchedulerPort,
} from "../ports/async-messaging";

export function createAsyncDispatcher(deps: {
  events: EventPublisherPort;
  jobs: JobQueuePort;
  scheduler: SchedulerPort;
}) {
  return {
    cancelScheduled(scheduleId: string) {
      return deps.scheduler.cancel(scheduleId);
    },
    enqueueJob(
      message: AsyncMessage,
      options?: Parameters<JobQueuePort["enqueue"]>[1],
    ) {
      return deps.jobs.enqueue(message, options);
    },
    publishEvent(message: AsyncMessage) {
      return deps.events.publish(message);
    },
    scheduleJob(scheduleId: string, runAt: Date, message: AsyncMessage) {
      return deps.scheduler.schedule({ message, runAt, scheduleId });
    },
  };
}

export type AsyncDispatcher = ReturnType<typeof createAsyncDispatcher>;
