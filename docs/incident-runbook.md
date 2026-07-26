# Incident Runbook

## Detection and Triage

CloudWatch alarms cover server errors and sustained average latency. The dashboard includes requests, errors, latency, and Lambda cold starts. Set `ALERT_TOPIC_ARN` to route alarms to an owned notification channel.

1. Acknowledge the alert and name an incident owner.
2. Check deployment events, stage, request IDs, error rate, latency, readiness, and external dependency status.
3. Use structured request and tRPC logs to follow a request ID. Tokens and secret-shaped fields are redacted.
4. Determine whether the incident is code, database, identity provider, or upstream dependency related.

## Mitigation

- Roll back only to a schema-compatible application release.
- Disable a failing optional readiness integration instead of bypassing required database readiness.
- For authentication incidents, do not weaken issuer, audience, expiry, or signature verification.
- For database incidents, follow [`database-operations.md`](./database-operations.md) and preserve a forensic backup.

## Recovery and Follow-up

Verify liveness, readiness, a representative authenticated transaction, and alarm recovery. Record timeline, impact, contributing conditions, actions, and owners. Add a regression test or alarm adjustment before closing the incident.

## Integration Ports

`@arlequins/logger` exposes OpenTelemetry-backed `Telemetry` and a replaceable `ErrorReporter`. Projects can register an OpenTelemetry SDK/exporter at process startup and inject a vendor error reporter without changing API or domain code. With no SDK or reporter configured, tracing and reporting safely remain no-op while CloudWatch EMF metrics continue through stdout.
