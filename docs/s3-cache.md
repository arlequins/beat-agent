# S3 Cache

`@arlequins/s3-cache` is a reusable S3-backed cache for API responses and database
query results. The API SST stack provisions and links a dedicated bucket. Local
development remains functional when no cache bucket is configured.

## Behavior

- Cache keys are stored as SHA-256 hashes and are not exposed in S3 object names.
- Values are serialized with SuperJSON, preserving values such as `Date`.
- TTL is enforced when reading; expired entries become misses and are deleted.
- Concurrent misses for the same key share one loader call within a process.
- Namespaces can be cleared after writes or used to isolate API and DB data.
- S3 failures use fail-open behavior by default, preserving the origin path.
- Production defaults add 10% TTL jitter and compress payloads at 1 KiB.
- An optional stale window returns the last value while one local loader refreshes it.
- Maximum object limits are checked before upload.
- `onMetric` reports hit, miss, stale, refresh, error, and latency data without a vendor dependency.

## API response cache

```ts
const apiCache = createS3Cache({ bucket, prefix }).namespace("api");

const payload = await apiCache.getOrSet(
  `catalog:${locale}`,
  () => catalogService.load(locale),
  { ttlSeconds: 60 },
);
```

Do not put raw authorization tokens or sensitive identifiers in logical keys.
Although keys are hashed, cache namespaces and values still require appropriate
S3 encryption, access control, and retention policy.

## Database query cache

Inject a domain namespace at the service or use-case boundary. Keep Drizzle and
repository packages unaware of the cache implementation.

```ts
const postCache = rootCache.namespace("db").namespace("posts");
const posts = await postCache.getOrSet("recent:10", queryRecentPosts);
```

After a successful write, delete the exact key or clear the affected domain
namespace. Cache writes and invalidations must never determine database
correctness.

## Environment

| Variable | Purpose |
| --- | --- |
| `S3_CACHE_BUCKET` | Bucket name; omit to disable the cache |
| `S3_CACHE_PREFIX` | Stage or application object prefix |
| `S3_CACHE_TTL_SECONDS` | Default TTL, 300 seconds when omitted |
| `S3_CACHE_ENDPOINT` | Optional S3-compatible local endpoint |
| `S3_CACHE_FORCE_PATH_STYLE` | Path-style access for local endpoints |

When using an S3-compatible local endpoint, provide credentials through the
standard AWS SDK credential environment. The package unit tests use an injected
client and never require AWS credentials or network access.
