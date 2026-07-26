import type { ProcessMainEvent } from "../../functions/process-main";

export type ProcessMainDeps = {
  content: {
    listContent(): Promise<{ total: number }>;
  };
  logger: {
    child(bindings: Record<string, unknown>): {
      info(message: string, attributes?: Record<string, unknown>): void;
    };
  };
};

export function createProcessMain(deps: {
  content: ProcessMainDeps["content"];
  logger: ProcessMainDeps["logger"];
}) {
  return async (payload: ProcessMainEvent): Promise<void> => {
    const runLogger = deps.logger.child({ batchId: payload.batchId });
    runLogger.info("batch.process.started", { inputType: payload.input.type });

    if (payload.input.type === "raw") {
      runLogger.info("batch.process.completed", { inputType: "raw" });
      return;
    }

    const result = await deps.content.listContent();
    runLogger.info("batch.process.completed", {
      inputType: "db",
      resultCount: result.total,
    });
  };
}
