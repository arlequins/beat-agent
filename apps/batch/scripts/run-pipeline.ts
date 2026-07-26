import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { RegisteredManifests } from "../config";
import { HandlerMap } from "../config/handler";

type HandlerFn = (
  event: unknown,
  context?: unknown,
  callback?: unknown,
) => unknown;

const PASSTHROUGH_INPUT = "{% $states.input %}";

function parseArgs(argv: string[]): {
  batchId?: string;
  input: unknown;
} {
  let batchId: string | undefined;
  let input: unknown = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--batch") {
      batchId = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--input") {
      const raw = argv[i + 1] ?? "{}";
      try {
        input = JSON.parse(raw);
      } catch {
        throw new Error(`--input must be valid JSON, received: ${raw}`);
      }
      i += 1;
    }
  }

  return { batchId, input };
}

function resolveStepInput(
  stepInput: unknown,
  previousOutput: unknown,
): unknown {
  if (stepInput === undefined || stepInput === PASSTHROUGH_INPUT) {
    return previousOutput;
  }
  return stepInput;
}

async function loadHandler(handlerPath: string): Promise<HandlerFn> {
  const absolute = resolve(process.cwd(), handlerPath);
  const mod = (await import(pathToFileURL(absolute).href)) as {
    handler?: HandlerFn;
  };
  if (typeof mod.handler !== "function") {
    throw new Error(`No exported handler function in: ${handlerPath}`);
  }
  return mod.handler;
}

async function main(): Promise<void> {
  const { batchId, input } = parseArgs(process.argv.slice(2));
  const manifest = batchId
    ? RegisteredManifests.find((m) => m.id === batchId)
    : RegisteredManifests[0];

  if (!manifest) {
    const ids = RegisteredManifests.map((m) => m.id).join(", ");
    throw new Error(`Batch not found. Available batch ids: ${ids}`);
  }

  let current: unknown = input;

  console.info(`[LocalPipeline] batch=${manifest.id}`);
  console.info(`[LocalPipeline] initialInput=${JSON.stringify(current)}`);

  for (const step of manifest.steps) {
    const handlerPath = HandlerMap[step.handlerKey].handler;
    const handlerInput = resolveStepInput(step.input, current);
    const handlerEvent = {
      batchId: manifest.id,
      stateName: step.stateName,
      input: handlerInput,
    };

    const handler = await loadHandler(handlerPath);
    console.info(`\n[LocalPipeline] -> ${step.stateName} (${step.handlerKey})`);
    console.info(`[LocalPipeline]    event=${JSON.stringify(handlerEvent)}`);

    current = await Promise.resolve(handler(handlerEvent, {}));
    console.info(`[LocalPipeline] <- output=${JSON.stringify(current)}`);
  }

  console.info(`\n[LocalPipeline] done finalOutput=${JSON.stringify(current)}`);
}

main().catch((error: unknown) => {
  console.error("[LocalPipeline] failed", error);
  process.exitCode = 1;
});
