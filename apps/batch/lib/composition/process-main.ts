import { db } from "@arlequins/db-backbone/client";
import { createDrizzlePostRepository } from "@arlequins/db-backbone/post-repository";
import { createLogger } from "@arlequins/logger";
import { createContentService } from "@arlequins/service";
import { createProcessMain } from "../usecases/process-main";

const logger = createLogger({
  service: "batch",
  bindings: { component: "process-main" },
});

export const processMain = createProcessMain({
  content: createContentService({
    logger: logger.child({ component: "content-service" }),
    repository: createDrizzlePostRepository(db),
  }),
  logger,
});
