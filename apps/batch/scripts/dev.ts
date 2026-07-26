import { resolve } from "node:path";
import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";
import { pathToFileURL } from "node:url";

import { closeDatabasePool } from "@arlequins/db-backbone/client";

import { RegisteredManifests } from "../config";
import { HandlerMap } from "../config/handler";

type HandlerFn = (
  event: unknown,
  context?: unknown,
  callback?: unknown,
) => unknown;

const PASSTHROUGH_INPUT = "{% $states.input %}";

/** Respect https://no-color.org/ and dumb terminals */
const color =
  output.isTTY &&
  process.env.NO_COLOR === undefined &&
  process.env.TERM !== "dumb";

function paint(open: string, text: string): string {
  if (!color) return text;
  return `\u001B[${open}m${text}\u001B[0m`;
}

const t = {
  bold: (s: string) => paint("1", s),
  dim: (s: string) => paint("2", s),
  cyan: (s: string) => paint("36", s),
  green: (s: string) => paint("32", s),
  yellow: (s: string) => paint("33", s),
  magenta: (s: string) => paint("35", s),
  blue: (s: string) => paint("34", s),
  red: (s: string) => paint("31", s),
  gray: (s: string) => paint("90", s),
};

function printBanner(title: string, subtitle: string): void {
  const inner = Math.max(title.length, subtitle.length);
  const pad = (s: string) => s + " ".repeat(inner - s.length);
  const rule = "─".repeat(inner + 4);
  console.info("");
  console.info(`${t.cyan("╭")}${t.cyan(rule)}${t.cyan("╮")}`);
  console.info(`${t.cyan("│")}  ${t.bold(t.cyan(pad(title)))}  ${t.cyan("│")}`);
  console.info(`${t.cyan("│")}  ${t.dim(pad(subtitle))}  ${t.cyan("│")}`);
  console.info(`${t.cyan("╰")}${t.cyan(rule)}${t.cyan("╯")}`);
  console.info("");
}

type StepCandidate = {
  batchId: string;
  stateName: string;
  handlerKey: keyof typeof HandlerMap;
  configuredInput: unknown;
};

function parseArgs(argv: string[]): { batchId?: string; stepId?: string } {
  let batchId: string | undefined;
  let stepId: string | undefined;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--batch") {
      batchId = argv[i + 1];
      i += 1;
      continue;
    }
    if (argv[i] === "--step") {
      stepId = argv[i + 1];
      i += 1;
    }
  }
  return { batchId, stepId };
}

function stepCandidates(batchId?: string): StepCandidate[] {
  return RegisteredManifests.flatMap((manifest) =>
    batchId && manifest.id !== batchId
      ? []
      : manifest.steps.map((step) => ({
          batchId: manifest.id,
          stateName: step.stateName,
          handlerKey: step.handlerKey,
          configuredInput: step.input,
        })),
  );
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

function previewInput(value: unknown): string {
  if (value === undefined || value === PASSTHROUGH_INPUT) {
    return "passthrough ($states.input)";
  }
  return JSON.stringify(value);
}

function printStepList(steps: StepCandidate[], filteredByBatch?: string): void {
  if (filteredByBatch) {
    console.info(
      `${t.bold("Registered steps")} ${t.dim("·")} ${t.dim("filtered")} ${t.yellow(filteredByBatch)}`,
    );
  } else {
    console.info(t.bold("Registered steps"));
  }
  console.info(t.dim("─".repeat(48)));
  steps.forEach((step, index) => {
    const n = t.bold(t.magenta(String(index + 1)));
    const batch = t.green(step.batchId);
    const state = t.bold(step.stateName);
    const handler = t.dim(String(step.handlerKey));
    const inp = t.gray(previewInput(step.configuredInput));
    console.info(`  ${n}  ${batch} ${t.dim("·")} ${state}`);
    console.info(
      `      ${t.dim("handler")} ${handler}  ${t.dim("input")} ${inp}`,
    );
  });
  console.info("");
}

async function main(): Promise<void> {
  const { batchId, stepId } = parseArgs(process.argv.slice(2));
  const steps = stepCandidates(batchId);
  if (steps.length === 0) {
    const ids = RegisteredManifests.map((m) => m.id).join(", ");
    throw new Error(
      batchId
        ? `No steps found for batch "${batchId}". Available batches: ${ids}`
        : "No steps found in RegisteredManifests.",
    );
  }

  printBanner(
    "Batch · local runner",
    "@arlequins/batch — pick a Step Functions step",
  );
  printStepList(steps, batchId);

  const rl = createInterface({ input, output });
  try {
    let step: StepCandidate | undefined;
    if (stepId) {
      step = steps.find((candidate) => candidate.stateName === stepId);
      if (!step) {
        const available = steps
          .map((candidate) => candidate.stateName)
          .join(", ");
        throw new Error(
          `Step "${stepId}" not found. Available step ids: ${available}`,
        );
      }
      console.info(
        `${t.cyan("➜")} ${t.dim("Using")} ${t.bold(step.stateName)} ${t.dim(`(${step.batchId})`)}`,
      );
      console.info("");
    } else {
      const prompt = `${t.cyan("?")} ${t.bold("Which step?")} ${t.dim(`(1–${steps.length})`)} `;
      const selectedRaw = await rl.question(prompt);
      const selected = Number.parseInt(selectedRaw, 10);
      if (Number.isNaN(selected) || selected < 1 || selected > steps.length) {
        throw new Error(`Invalid selection: ${selectedRaw}`);
      }
      step = steps[selected - 1];
      if (!step) {
        throw new Error(`Step not found for selection: ${selected}`);
      }
    }

    const promptOverride = `${t.green("?")} ${t.bold("Override event.input as JSON?")} ${t.dim("(Enter = use manifest / passthrough)")}\n${t.cyan("›")} `;
    const overrideRaw = await rl.question(promptOverride);

    let stepInput: unknown;
    if (overrideRaw.trim() !== "") {
      stepInput = JSON.parse(overrideRaw);
    } else if (
      step.configuredInput === undefined ||
      step.configuredInput === PASSTHROUGH_INPUT
    ) {
      stepInput = {};
    } else {
      stepInput = step.configuredInput;
    }

    const event = {
      batchId: step.batchId,
      stateName: step.stateName,
      input: stepInput,
    };

    const handlerPath = HandlerMap[step.handlerKey].handler;
    const handler = await loadHandler(handlerPath);

    console.info("");
    console.info(
      `${t.cyan("━━")} ${t.bold("Invoke")} ${t.dim("━".repeat(32))}`,
    );
    console.info(`  ${t.dim("batch")}   ${t.green(event.batchId)}`);
    console.info(`  ${t.dim("state")}   ${t.bold(event.stateName)}`);
    console.info(`  ${t.dim("handler")} ${t.yellow(String(step.handlerKey))}`);
    console.info(`  ${t.dim("event")}   ${t.gray(JSON.stringify(event))}`);
    console.info(`${t.cyan("━━")}${"━".repeat(40)}`);
    console.info("");

    const result = await Promise.resolve(handler(event, {}));

    console.info(`${t.green("✓")} ${t.bold("Done")}`);
    console.info(t.dim(JSON.stringify(result, undefined, 2)));
    console.info("");
  } finally {
    // close db connection
    await closeDatabasePool();
    rl.close();
  }
}

main().catch((error: unknown) => {
  console.error(`${t.red("✗")} ${t.bold("LocalStep failed")}`);
  console.error(error);
  process.exitCode = 1;
});
