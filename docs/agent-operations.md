# Agent operations

The template deliberately keeps operational controls provider-neutral. Run the
following checks from the deployed environment (or a trusted operator runner):

```bash
pnpm agent:readiness --api-url https://api.example.com
pnpm db:backup -- backups/pre-release.dump
pnpm db:restore:verify -- backups/pre-release.dump agent_restore_check
```

`agent:readiness` checks both liveness and PostgreSQL-backed readiness. It is
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
| Backup verification | Missed daily run | Restore verification fails; stop deployments and preserve the archive |

Quotas are product policy, not hidden template defaults. Before production,
enforce document, chunk, storage, and inference budgets at the delivery or
application boundary, return a clear 429/403-style product error, and record
only non-content audit metadata. `agent.usage` supplies bounded workspace
counts for that decision; it does not silently delete data or charge users.

## Recovery

Use the existing custom-format backup and side-by-side restore workflow in
[Database operations](./database-operations.md). For a document or retrieval
incident, first soft-delete the affected document, preserve `audit_log` and
`index_run` records, then re-ingest from a verified source. Do not restore a
backup over a live database without first verifying it in a separate database.
