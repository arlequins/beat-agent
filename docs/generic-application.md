# Generic Application Baseline

## Asynchronous Boundaries

Application code publishes events, enqueues jobs, and creates one-time schedules
through provider-neutral ports from `@arlequins/service`. `apps/api` includes
inspectable in-memory adapters for local development and tests, plus adapters
for EventBridge, SQS, and EventBridge Scheduler. Keep AWS resource names, ARNs,
and credentials in the composition root; do not pass cloud SDK types into use
cases.

Every asynchronous message carries an id, name, ISO timestamp, payload, and
schema version. Use correlation and causation ids when continuing a request or
message chain. Consumers should combine the message id with the idempotency
service before applying side effects.

## Retry Safety

Use `createIdempotencyService` around commands that may be retried by clients,
queues, or Lambda. Its application port separates key/fingerprint policy from
the durable `createDrizzleIdempotencyStore` adapter. Completed results replay,
payload mismatches conflict, failed operations release their claim, and expired
claims can be acquired again.

Mutable example records include a numeric `version`. Updates must provide the
version read by the client; the Drizzle adapter increments it atomically and
returns a conflict when another request has already changed the row.

The example content feature demonstrates a complete application slice without
turning the template into a blog product. Rename or remove the slice when a
real domain is introduced.

## Dependency Direction

```text
web -> tRPC router -> application service -> repository/file port
                                            ^
                                            |
                                Drizzle and S3 adapters
```

- `@arlequins/service` owns use cases, domain records, and ports. It has no database,
  cache, HTTP, cloud SDK, or logger implementation dependencies.
- `@arlequins/trpc` owns transport routers, adapter decoration, and composition.
- `@arlequins/db-backbone` owns Drizzle schemas, migrations, the database client,
  and Drizzle repository adapters.
- `apps/web` consumes browser-safe tRPC contracts and applies the same
  permission vocabulary used by API middleware.

## Included Example

- Content create, read, update, and delete operations.
- Server-side search, sorting, and offset pagination.
- Loading, empty, error, retry, and mutation feedback states.
- Permission-aware create, edit, delete, and upload actions.
- Optional S3 upload targets through a provider-neutral file storage port.
- Initial administrator assignment using exact OIDC `issuer|subject` values.

The upload service validates policy before calling its port. The S3 adapter only
creates a short-lived PUT target; applications remain responsible for linking
the returned object key to their own aggregate and for applying retention or
malware-scanning policies appropriate to that domain.

## Administrator Bootstrap

Set `AUTH_BOOTSTRAP_ADMIN_IDENTITIES` to a comma-separated list of exact
`issuer|subject` identities. The provisioning adapter assigns the administrator
role idempotently on login. Remove the variable after the intended accounts have
been provisioned if ongoing automatic promotion is not desired.
