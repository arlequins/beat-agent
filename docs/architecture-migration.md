# Feature-sliced architecture guide

Beat Agent combines Clean Architecture for server code with Feature-Sliced
Design (FSD) for the web application. Business rules remain testable when the
delivery framework, storage provider, or screen changes.

## Dependency direction

```text
Web route -> widget -> feature -> entity -> shared
HTTP adapter -> application port <- provider adapter
                 └─ domain model
```

Server domain and application code must not import Hono, tRPC, AWS SDKs,
database clients, environment loaders, or provider-specific logging. Web
entities must not depend on features or widgets; features must not depend on
widgets. `pnpm architecture:check` checks these rules.

## Migration rules

1. Introduce a domain type and invariant without a provider import.
2. Define an application port and test the use case with a double.
3. Move provider implementation under `infrastructure/` or `adaptors/`.
4. Wire adapters in a composition root.
5. Keep HTTP/UI delivery thin and add a contract test.
6. Keep compatibility barrels until all imports move, then remove them in a
   separate conventional change.

Existing `components/` and `lib/` folders are compatibility seams. New web
code belongs in `shared`, `entities`, `features`, or `widgets`.
