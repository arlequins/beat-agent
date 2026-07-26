import { describe, expect, it } from "vitest";
import { createInMemoryAsyncAdapters } from "./in-memory-async";

const message = {
  id: "message-1",
  name: "content.created",
  occurredAt: "2026-07-22T00:00:00.000Z",
  payload: { contentId: "content-1" },
  version: 1,
};

describe("createInMemoryAsyncAdapters", () => {
  it("provides inspectable local event, queue, and schedule adapters", async () => {
    const adapters = createInMemoryAsyncAdapters();
    await adapters.events.publish(message);
    await adapters.jobs.enqueue(message, { delaySeconds: 3 });
    await adapters.scheduler.schedule({
      message,
      runAt: new Date("2026-07-23T00:00:00.000Z"),
      scheduleId: "schedule-1",
    });

    expect(adapters.state.events).toEqual([message]);
    expect(adapters.state.jobs).toEqual([
      { message, options: { delaySeconds: 3 } },
    ]);
    expect(adapters.state.schedules.has("schedule-1")).toBe(true);

    await adapters.scheduler.cancel("schedule-1");
    expect(adapters.state.schedules.has("schedule-1")).toBe(false);
  });
});
