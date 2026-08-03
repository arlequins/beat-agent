import { describe, expect, it, vi } from "vitest";
import { createAsyncDispatcher } from "./application/use-cases/dispatch-async";

const message = {
  id: "message-1",
  name: "content.created",
  occurredAt: "2026-07-22T00:00:00.000Z",
  payload: { contentId: "content-1" },
  version: 1,
};

describe("createAsyncDispatcher", () => {
  it("delegates events, jobs, and schedules through application ports", async () => {
    const publish = vi.fn();
    const enqueue = vi.fn();
    const schedule = vi.fn();
    const cancel = vi.fn();
    const dispatcher = createAsyncDispatcher({
      events: { publish },
      jobs: { enqueue },
      scheduler: { cancel, schedule },
    });
    const runAt = new Date("2026-07-23T00:00:00.000Z");

    await dispatcher.publishEvent(message);
    await dispatcher.enqueueJob(message, { delaySeconds: 5 });
    await dispatcher.scheduleJob("schedule-1", runAt, message);
    await dispatcher.cancelScheduled("schedule-1");

    expect(publish).toHaveBeenCalledWith(message);
    expect(enqueue).toHaveBeenCalledWith(message, { delaySeconds: 5 });
    expect(schedule).toHaveBeenCalledWith({
      message,
      runAt,
      scheduleId: "schedule-1",
    });
    expect(cancel).toHaveBeenCalledWith("schedule-1");
  });
});
