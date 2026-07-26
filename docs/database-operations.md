# Database Operations

## Deployment Order

1. Create and validate a custom-format backup.
2. Run `pnpm db:migrate`. The command waits for a PostgreSQL advisory lock, so only one deployment applies migrations at a time.
3. Run `pnpm db:seed`. Production-safe reference seeds always run. Sample seeds run only when `SEED_SAMPLE_DATA=true`.
4. Deploy the API and workers.
5. Verify `/health/ready` and a representative read/write path before shifting traffic.

Migrations must remain backward compatible with the currently deployed application. Use expand/migrate/contract changes across separate releases for destructive schema changes.

## Backup and Restore Verification

Install PostgreSQL client tools, then run:

```bash
pnpm db:backup -- backups/pre-release.dump
pnpm db:restore:verify -- backups/pre-release.dump app_restore_check
```

The restore command refuses to target `DATABASE_NAME`. Inspect the restored database separately, then delete it only after application and data checks pass.

## Migration Failure

1. Stop further deployments and retain the failed logs and migration identifier.
2. Determine whether the migration transaction rolled back. Do not edit the migration journal manually.
3. Prefer a forward repair migration. Restore the backup into a separate database before considering production restoration.
4. Roll the application back only when the old version remains schema-compatible.
5. If production restoration is unavoidable, announce downtime, isolate writers, take an additional forensic backup, restore using the provider runbook, and validate readiness before reopening traffic.
