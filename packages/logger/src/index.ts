export const LogLevel = {
  DEBUG: "debug",
  INFO: "info",
  WARN: "warn",
  ERROR: "error",
} as const;

export type LogLevel = (typeof LogLevel)[keyof typeof LogLevel];
export type LogFields = Record<string, unknown>;

export type LogRecord = LogFields & {
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
};

export type LogSink = (record: LogRecord) => void;

export type Logger = {
  child(bindings: LogFields): Logger;
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
};

export type CreateLoggerOptions = {
  service: string;
  bindings?: LogFields;
  sink?: LogSink;
  now?: () => Date;
};

const sensitiveKey = /authorization|cookie|password|secret|token|api[-_]?key/i;
const redacted = "[REDACTED]";

function sanitize(
  value: unknown,
  key?: string,
  seen = new WeakSet<object>(),
): unknown {
  if (key && sensitiveKey.test(key)) return redacted;
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitize(item, undefined, seen));
  }
  if (value && typeof value === "object") {
    if (seen.has(value)) return "[Circular]";
    seen.add(value);
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        sanitize(entryValue, entryKey, seen),
      ]),
    );
  }
  return value;
}

function defaultSink(record: LogRecord): void {
  const line = JSON.stringify(record);
  if (record.level === LogLevel.ERROR) {
    console.error(line);
    return;
  }
  console.log(line);
}

export function createLogger(options: CreateLoggerOptions): Logger {
  const sink = options.sink ?? defaultSink;
  const now = options.now ?? (() => new Date());

  function build(bindings: LogFields): Logger {
    function write(level: LogLevel, message: string, fields: LogFields = {}) {
      sink(
        sanitize({
          ...bindings,
          ...fields,
          timestamp: now().toISOString(),
          level,
          service: options.service,
          message,
        }) as LogRecord,
      );
    }

    return {
      child(childBindings) {
        return build({ ...bindings, ...childBindings });
      },
      debug: (message, fields) => write(LogLevel.DEBUG, message, fields),
      info: (message, fields) => write(LogLevel.INFO, message, fields),
      warn: (message, fields) => write(LogLevel.WARN, message, fields),
      error: (message, fields) => write(LogLevel.ERROR, message, fields),
    };
  }

  return build(options.bindings ?? {});
}

export * from "./sdk";
export * from "./telemetry";
