# `@arlequins/s3-cache`

S3-backed JSON cache for API responses and database query results. It provides
TTL jitter, stale-while-revalidate, gzip compression, object size limits,
hashed keys, namespace clearing, process-local single-flight loading, metric
callbacks, and configurable fail-open behavior. Version 1 objects remain
readable while new writes use the version 2 envelope.

```ts
const root = createS3Cache({ bucket: "app-cache", prefix: "production" });
const { api, database } = createApplicationCaches(root);

const response = await api.getOrSet("catalog:v1", loadCatalog, {
  ttlSeconds: 60,
});
const rows = await database.namespace("posts").getOrSet("recent:10", queryPosts);
```

Values use SuperJSON, preserving common application types such as `Date`. Do not
rely on S3 cache writes for data durability or correctness. Database writes must
succeed before invalidating the related namespace. The default `bypass` mode
reports S3 errors through `onError` and continues through the origin path.
