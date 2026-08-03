# Beat agent operations

Run the following check from the deployed environment or a trusted operator
runner:

```bash
pnpm agent:readiness --api-url https://api.example.com
```

`agent:readiness` checks both liveness and S3-backed readiness. It is
safe for a scheduled monitor because it writes no agent data. A failed check
must page the on-call owner; do not use liveness alone to declare the service
healthy.

## Alert policy

Configure the host's monitoring platform to alert on these signals:

| Signal | Warning | Urgent action |
| --- | --- | --- |
| `/health/ready` failure | One failed scheduled check | Three consecutive failures or 5 minutes unavailable |
| API 5xx rate | Above 1% for 10 minutes | Above 5% for 5 minutes |
| Index runs | Any failed run | Repeated failures for a workspace; pause ingestion and inspect its audit log |
| Workspace use | 80% of product quota | 100%; reject new writes at the application boundary |
| Release checksum | Scheduled validation missed | Active snapshot checksum fails; stop release activation |
| SQS DLQ | Any message | Repeated messages; pause the related worker and inspect idempotency state |

Quotas are product policy, not hidden template defaults. Before production,
enforce document, chunk, storage, and inference budgets at the delivery or
application boundary, return a clear 429/403-style product error, and record
only non-content audit metadata. `agent.usage` supplies bounded workspace
counts for that decision; it does not silently delete data or charge users.

## Recovery

Use the workflow in
[S3-primary architecture](./s3-primary-architecture.md). For a document or
retrieval incident, preserve the source object version, active release manifest,
index run and Citation records before tombstoning the affected document.
Restore an older S3 object version by copying it into a new current version;
never permanently delete the evidence under investigation.
