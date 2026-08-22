import { serverEnv } from "@arlequins/env";
import { createAgentWorkerServices } from "@arlequins/trpc";
import { createAgentJob } from "@arlequins/trpc/agent-jobs";

import { createSqsJobQueue } from "./adaptors/aws-async";

export async function handler() {
  if (!serverEnv.AGENT_JOBS_QUEUE_URL)
    throw new Error("AGENT_JOBS_QUEUE_URL is required");
  const services = createAgentWorkerServices();
  const queue = createSqsJobQueue({ queueUrl: serverEnv.AGENT_JOBS_QUEUE_URL });
  const owners = await services.agent.listWorkspaceOwners();
  let queued = 0;
  const seenWorkspaces = new Set<string>();
  for (const owner of owners) {
    if (seenWorkspaces.has(owner.workspaceId)) continue;
    seenWorkspaces.add(owner.workspaceId);
    const cases = await services.agent.listEvaluationCases(owner);
    if (!cases.length) continue;
    const run = await services.agent.createEvaluationRun(owner, "weekly");
    const job = createAgentJob(
      "evaluate.retrieval",
      {
        evaluationRunId: run.id,
        userId: owner.userId,
        workspaceId: owner.workspaceId,
      },
      run.id,
    );
    await queue.enqueue(job, {
      deduplicationId: job.id,
      groupId: owner.userId,
    });
    queued += 1;
  }
  return { queued };
}
