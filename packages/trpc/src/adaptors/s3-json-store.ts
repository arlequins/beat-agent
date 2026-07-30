import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

export type StoredJson<T> = {
  etag?: string;
  value: T;
  versionId?: string;
};

export type JsonObjectStore = {
  create<T>(key: string, value: T): Promise<StoredJson<T>>;
  delete(key: string, etag?: string): Promise<void>;
  get<T>(key: string): Promise<StoredJson<T> | undefined>;
  list<T>(prefix: string): Promise<Array<{ key: string; value: T }>>;
  replace<T>(key: string, value: T, etag: string): Promise<StoredJson<T>>;
};

export class ObjectAlreadyExistsError extends Error {
  constructor(key: string) {
    super(`Object already exists: ${key}`);
    this.name = "ObjectAlreadyExistsError";
  }
}

export class ObjectConflictError extends Error {
  constructor(key: string) {
    super(`Object changed concurrently: ${key}`);
    this.name = "ObjectConflictError";
  }
}

function normalizePrefix(value: string): string {
  return value
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .replace(/\/{2,}/g, "/");
}

function keyWithin(prefix: string, key: string): string {
  const normalizedKey = normalizePrefix(key);
  if (!normalizedKey || normalizedKey.includes(".."))
    throw new Error("S3 object key must be a non-empty safe path");
  return prefix ? `${prefix}/${normalizedKey}` : normalizedKey;
}

function isNotFound(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    name?: string;
    $metadata?: { httpStatusCode?: number };
  };
  return (
    candidate.name === "NoSuchKey" ||
    candidate.name === "NotFound" ||
    candidate.$metadata?.httpStatusCode === 404
  );
}

function isPreconditionFailure(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  return (
    (error as { name?: string }).name === "PreconditionFailed" ||
    (error as { $metadata?: { httpStatusCode?: number } }).$metadata
      ?.httpStatusCode === 412
  );
}

export function createS3JsonObjectStore(input: {
  bucket: string;
  client?: S3Client;
  endpoint?: string;
  forcePathStyle?: boolean;
  prefix?: string;
}): JsonObjectStore {
  const bucket = input.bucket.trim();
  if (!bucket) throw new Error("S3 agent bucket is required");
  const prefix = normalizePrefix(input.prefix ?? "");
  const client =
    input.client ??
    new S3Client({
      ...(input.endpoint ? { endpoint: input.endpoint } : {}),
      forcePathStyle: input.forcePathStyle,
    });
  const objectKey = (key: string) => keyWithin(prefix, key);

  async function read<T>(key: string): Promise<StoredJson<T> | undefined> {
    try {
      const response = await client.send(
        new GetObjectCommand({ Bucket: bucket, Key: objectKey(key) }),
      );
      if (!response.Body) return undefined;
      return {
        etag: response.ETag,
        value: JSON.parse(await response.Body.transformToString()) as T,
        versionId: response.VersionId,
      };
    } catch (error) {
      if (isNotFound(error)) return undefined;
      throw error;
    }
  }

  return {
    async create<T>(key: string, value: T) {
      try {
        const response = await client.send(
          new PutObjectCommand({
            Body: JSON.stringify(value),
            Bucket: bucket,
            ContentType: "application/json",
            IfNoneMatch: "*",
            Key: objectKey(key),
          }),
        );
        return {
          etag: response.ETag,
          value,
          versionId: response.VersionId,
        };
      } catch (error) {
        if (isPreconditionFailure(error))
          throw new ObjectAlreadyExistsError(key);
        throw error;
      }
    },
    async delete(key: string, etag?: string) {
      try {
        await client.send(
          new DeleteObjectCommand({
            Bucket: bucket,
            IfMatch: etag,
            Key: objectKey(key),
          }),
        );
      } catch (error) {
        if (isPreconditionFailure(error)) throw new ObjectConflictError(key);
        throw error;
      }
    },
    get: read,
    async list<T>(keyPrefix: string) {
      const normalizedListPrefix = normalizePrefix(keyPrefix);
      const relativePrefix = keyPrefix.trim().endsWith("/")
        ? `${normalizedListPrefix}/`
        : normalizedListPrefix;
      const fullPrefix = prefix
        ? `${prefix}/${relativePrefix}`
        : relativePrefix;
      const output: Array<{ key: string; value: T }> = [];
      let continuationToken: string | undefined;
      do {
        const page = await client.send(
          new ListObjectsV2Command({
            Bucket: bucket,
            ContinuationToken: continuationToken,
            Prefix: fullPrefix,
          }),
        );
        const rows = await Promise.all(
          (page.Contents ?? []).flatMap(({ Key }) => {
            if (!Key) return [];
            const relativeKey = prefix ? Key.slice(prefix.length + 1) : Key;
            return [
              read<T>(relativeKey).then((record) =>
                record ? { key: relativeKey, value: record.value } : undefined,
              ),
            ];
          }),
        );
        output.push(
          ...rows.filter(
            (row): row is { key: string; value: T } => row !== undefined,
          ),
        );
        continuationToken = page.IsTruncated
          ? page.NextContinuationToken
          : undefined;
      } while (continuationToken);
      return output.sort((left, right) => left.key.localeCompare(right.key));
    },
    async replace<T>(key: string, value: T, etag: string) {
      try {
        const response = await client.send(
          new PutObjectCommand({
            Body: JSON.stringify(value),
            Bucket: bucket,
            ContentType: "application/json",
            IfMatch: etag,
            Key: objectKey(key),
          }),
        );
        return {
          etag: response.ETag,
          value,
          versionId: response.VersionId,
        };
      } catch (error) {
        if (isPreconditionFailure(error)) throw new ObjectConflictError(key);
        throw error;
      }
    },
  };
}

export function createMemoryJsonObjectStore(): JsonObjectStore {
  const records = new Map<string, StoredJson<unknown>>();
  let version = 0;
  const nextEtag = () => `"memory-${++version}"`;
  return {
    async create<T>(key: string, value: T) {
      if (records.has(key)) throw new ObjectAlreadyExistsError(key);
      const record = { etag: nextEtag(), value, versionId: String(version) };
      records.set(key, record);
      return record;
    },
    async delete(key: string, etag?: string) {
      const current = records.get(key);
      if (etag && current?.etag !== etag) throw new ObjectConflictError(key);
      records.delete(key);
    },
    async get<T>(key: string) {
      return records.get(key) as StoredJson<T> | undefined;
    },
    async list<T>(prefix: string) {
      return [...records.entries()]
        .filter(([key]) => key.startsWith(prefix))
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, record]) => ({ key, value: record.value as T }));
    },
    async replace<T>(key: string, value: T, etag: string) {
      const current = records.get(key);
      if (!current || current.etag !== etag) throw new ObjectConflictError(key);
      const record = { etag: nextEtag(), value, versionId: String(version) };
      records.set(key, record);
      return record;
    },
  };
}
