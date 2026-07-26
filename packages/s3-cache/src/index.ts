import { createHash } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";

import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { parse, stringify } from "superjson";

export const CacheNamespace = { API: "api", DATABASE: "db" } as const;

export type CacheSetOptions = {
  staleWhileRevalidateSeconds?: number;
  ttlSeconds?: number;
};

export type CacheMetric = {
  durationMs: number;
  operation: "clear" | "delete" | "get" | "refresh" | "set";
  outcome: "error" | "hit" | "miss" | "stale" | "success";
};

export type Cache = {
  clear(): Promise<number>;
  delete(key: string): Promise<void>;
  get<T>(key: string): Promise<T | undefined>;
  getOrSet<T>(
    key: string,
    loader: () => Promise<T>,
    options?: CacheSetOptions,
  ): Promise<T>;
  namespace(name: string): Cache;
  set<T>(key: string, value: T, options?: CacheSetOptions): Promise<void>;
};

export type S3CacheOptions = {
  bucket: string;
  client?: S3Client;
  compressionThresholdBytes?: number;
  defaultStaleWhileRevalidateSeconds?: number;
  defaultTtlSeconds?: number;
  errorMode?: "bypass" | "throw";
  maxObjectBytes?: number;
  now?: () => number;
  onError?: (error: unknown, operation: string) => void;
  onMetric?: (metric: CacheMetric) => void;
  prefix?: string;
  random?: () => number;
  ttlJitterRatio?: number;
};

type CacheEnvelopeV1 = { expiresAt: number; value: unknown; version: 1 };
type CacheEnvelopeV2 = {
  encoding: "gzip-base64" | "identity";
  expiresAt: number;
  payload: string;
  staleUntil: number;
  version: 2;
};

type CacheState = Required<
  Pick<
    S3CacheOptions,
    | "bucket"
    | "compressionThresholdBytes"
    | "defaultStaleWhileRevalidateSeconds"
    | "defaultTtlSeconds"
    | "errorMode"
    | "maxObjectBytes"
    | "now"
    | "random"
    | "ttlJitterRatio"
  >
> & {
  client: S3Client;
  inFlight: Map<string, Promise<unknown>>;
  onError?: S3CacheOptions["onError"];
  onMetric?: S3CacheOptions["onMetric"];
  rootPrefix: string;
};

type ReadResult<T> = { status: "hit" | "stale"; value: T } | { status: "miss" };

function normalizeSegment(value: string, label: string): string {
  const trimmed = value.trim();
  let start = 0;
  let end = trimmed.length;
  while (start < end && trimmed[start] === "/") start += 1;
  while (end > start && trimmed[end - 1] === "/") end -= 1;
  const normalized = trimmed.slice(start, end);
  if (!normalized || !/^[a-zA-Z0-9._/-]+$/.test(normalized))
    throw new Error(
      `${label} must contain only letters, numbers, ., _, -, or /`,
    );
  return normalized;
}

function normalizeBucket(value: string): string {
  const bucket = normalizeSegment(value, "S3 bucket");
  if (bucket.includes("/")) throw new Error("S3 bucket must be a bucket name");
  return bucket;
}

function decodeEnvelope(source: string): {
  expiresAt: number;
  staleUntil: number;
  value: unknown;
} {
  const envelope: unknown = parse(source);
  if (!envelope || typeof envelope !== "object" || !("version" in envelope))
    throw new Error("Invalid S3 cache envelope");
  if (
    envelope.version === 1 &&
    "expiresAt" in envelope &&
    typeof envelope.expiresAt === "number" &&
    "value" in envelope
  ) {
    const legacy = envelope as CacheEnvelopeV1;
    return {
      expiresAt: legacy.expiresAt,
      staleUntil: legacy.expiresAt,
      value: legacy.value,
    };
  }
  if (
    envelope.version !== 2 ||
    !("expiresAt" in envelope) ||
    typeof envelope.expiresAt !== "number" ||
    !("staleUntil" in envelope) ||
    typeof envelope.staleUntil !== "number" ||
    !("payload" in envelope) ||
    typeof envelope.payload !== "string" ||
    !("encoding" in envelope) ||
    (envelope.encoding !== "identity" && envelope.encoding !== "gzip-base64")
  )
    throw new Error("Invalid S3 cache envelope");
  const current = envelope as CacheEnvelopeV2;
  const serialized =
    current.encoding === "gzip-base64"
      ? gunzipSync(Buffer.from(current.payload, "base64")).toString("utf8")
      : current.payload;
  return {
    expiresAt: current.expiresAt,
    staleUntil: current.staleUntil,
    value: parse(serialized),
  };
}

function isNotFound(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    name?: string;
    $metadata?: { httpStatusCode?: number };
  };
  return (
    candidate.name === "NoSuchKey" ||
    candidate.$metadata?.httpStatusCode === 404
  );
}

function objectHash(key: string): string {
  if (!key.trim()) throw new Error("Cache key must not be empty");
  return createHash("sha256").update(key).digest("hex");
}

function positive(value: number, label: string, allowZero = false) {
  if (!Number.isFinite(value) || (allowZero ? value < 0 : value <= 0))
    throw new Error(
      `${label} must be ${allowZero ? "a non-negative" : "a positive"} number`,
    );
}

function buildCache(state: CacheState, namespaceParts: string[]): Cache {
  const namespacePrefix = [state.rootPrefix, ...namespaceParts].join("/");
  const objectKey = (key: string) =>
    `${namespacePrefix}/${objectHash(key)}.json`;
  const metric = (
    operation: CacheMetric["operation"],
    outcome: CacheMetric["outcome"],
    startedAt: number,
  ) =>
    state.onMetric?.({
      durationMs: Math.max(0, state.now() - startedAt),
      operation,
      outcome,
    });

  async function recover<T>(
    operation: CacheMetric["operation"],
    fallback: T,
    action: () => Promise<T>,
  ): Promise<T> {
    const startedAt = state.now();
    try {
      const value = await action();
      if (operation !== "get") metric(operation, "success", startedAt);
      return value;
    } catch (error) {
      if (isNotFound(error)) return fallback;
      state.onError?.(error, operation);
      metric(operation, "error", startedAt);
      if (state.errorMode === "throw") throw error;
      return fallback;
    }
  }

  async function read<T>(key: string): Promise<ReadResult<T>> {
    const startedAt = state.now();
    const result = await recover<ReadResult<T>>(
      "get",
      { status: "miss" },
      async () => {
        const response = await state.client.send(
          new GetObjectCommand({ Bucket: state.bucket, Key: objectKey(key) }),
        );
        if (!response.Body) return { status: "miss" };
        const envelope = decodeEnvelope(
          await response.Body.transformToString(),
        );
        if (envelope.staleUntil <= state.now()) {
          await cache.delete(key);
          return { status: "miss" };
        }
        return {
          status: envelope.expiresAt <= state.now() ? "stale" : "hit",
          value: envelope.value as T,
        };
      },
    );
    metric("get", result.status, startedAt);
    return result;
  }

  async function loadOnce<T>(
    key: string,
    loader: () => Promise<T>,
    options: CacheSetOptions,
  ): Promise<T> {
    const keyPath = objectKey(key);
    const existing = state.inFlight.get(keyPath) as Promise<T> | undefined;
    if (existing) return existing;
    const pending = loader().then(async (value) => {
      if (value !== undefined) await cache.set(key, value, options);
      return value;
    });
    state.inFlight.set(keyPath, pending);
    try {
      return await pending;
    } finally {
      state.inFlight.delete(keyPath);
    }
  }

  const cache: Cache = {
    async get<T>(key: string) {
      const result = await read<T>(key);
      return result.status === "hit" ? result.value : undefined;
    },
    async set<T>(key: string, value: T, options: CacheSetOptions = {}) {
      if (value === undefined)
        throw new Error("Cache value must not be undefined");
      const ttlSeconds = options.ttlSeconds ?? state.defaultTtlSeconds;
      const staleSeconds =
        options.staleWhileRevalidateSeconds ??
        state.defaultStaleWhileRevalidateSeconds;
      positive(ttlSeconds, "Cache TTL");
      positive(staleSeconds, "Cache stale window", true);
      const jitter = 1 + (state.random() * 2 - 1) * state.ttlJitterRatio;
      const effectiveTtlMs = Math.max(1, ttlSeconds * jitter * 1_000);
      const serialized = stringify(value);
      const compressed =
        Buffer.byteLength(serialized) >= state.compressionThresholdBytes;
      const envelope: CacheEnvelopeV2 = {
        encoding: compressed ? "gzip-base64" : "identity",
        expiresAt: state.now() + effectiveTtlMs,
        payload: compressed
          ? gzipSync(serialized).toString("base64")
          : serialized,
        staleUntil: state.now() + effectiveTtlMs + staleSeconds * 1_000,
        version: 2,
      };
      const body = stringify(envelope);
      if (Buffer.byteLength(body) > state.maxObjectBytes)
        throw new Error(`Cache object exceeds ${state.maxObjectBytes} bytes`);
      await recover("set", undefined, async () => {
        await state.client.send(
          new PutObjectCommand({
            Body: body,
            Bucket: state.bucket,
            CacheControl: `private, max-age=${Math.floor(ttlSeconds)}`,
            ContentType: "application/json",
            Key: objectKey(key),
          }),
        );
      });
    },
    async delete(key) {
      await recover("delete", undefined, async () => {
        await state.client.send(
          new DeleteObjectCommand({
            Bucket: state.bucket,
            Key: objectKey(key),
          }),
        );
      });
    },
    async clear() {
      return recover("clear", 0, async () => {
        let deleted = 0;
        let continuationToken: string | undefined;
        do {
          const response = await state.client.send(
            new ListObjectsV2Command({
              Bucket: state.bucket,
              ContinuationToken: continuationToken,
              Prefix: `${namespacePrefix}/`,
            }),
          );
          const objects = (response.Contents ?? []).flatMap(({ Key }) =>
            Key ? [{ Key }] : [],
          );
          if (objects.length > 0) {
            await state.client.send(
              new DeleteObjectsCommand({
                Bucket: state.bucket,
                Delete: { Objects: objects, Quiet: true },
              }),
            );
            deleted += objects.length;
          }
          continuationToken = response.IsTruncated
            ? response.NextContinuationToken
            : undefined;
        } while (continuationToken);
        return deleted;
      });
    },
    async getOrSet<T>(
      key: string,
      loader: () => Promise<T>,
      options: CacheSetOptions = {},
    ) {
      const result = await read<T>(key);
      if (result.status === "hit") return result.value;
      if (result.status === "stale") {
        const startedAt = state.now();
        void loadOnce(key, loader, options)
          .then(() => metric("refresh", "success", startedAt))
          .catch((error) => {
            state.onError?.(error, "refresh");
            metric("refresh", "error", startedAt);
          });
        return result.value;
      }
      return loadOnce(key, loader, options);
    },
    namespace(name) {
      return buildCache(state, [
        ...namespaceParts,
        normalizeSegment(name, "Cache namespace"),
      ]);
    },
  };
  return cache;
}

export function createS3Cache(options: S3CacheOptions): Cache {
  const state: CacheState = {
    bucket: normalizeBucket(options.bucket),
    client: options.client ?? new S3Client({}),
    compressionThresholdBytes: options.compressionThresholdBytes ?? 1_024,
    defaultStaleWhileRevalidateSeconds:
      options.defaultStaleWhileRevalidateSeconds ?? 0,
    defaultTtlSeconds: options.defaultTtlSeconds ?? 300,
    errorMode: options.errorMode ?? "bypass",
    inFlight: new Map(),
    maxObjectBytes: options.maxObjectBytes ?? 1_000_000,
    now: options.now ?? Date.now,
    onError: options.onError,
    onMetric: options.onMetric,
    random: options.random ?? Math.random,
    rootPrefix: normalizeSegment(options.prefix ?? "cache", "Cache prefix"),
    ttlJitterRatio: options.ttlJitterRatio ?? 0.1,
  };
  positive(state.defaultTtlSeconds, "Default cache TTL");
  positive(
    state.defaultStaleWhileRevalidateSeconds,
    "Default stale window",
    true,
  );
  positive(state.compressionThresholdBytes, "Compression threshold");
  positive(state.maxObjectBytes, "Maximum object size");
  if (state.ttlJitterRatio < 0 || state.ttlJitterRatio > 1)
    throw new Error("TTL jitter ratio must be between 0 and 1");
  return buildCache(state, []);
}

export function createApplicationCaches(cache: Cache) {
  return {
    api: cache.namespace(CacheNamespace.API),
    database: cache.namespace(CacheNamespace.DATABASE),
  };
}
