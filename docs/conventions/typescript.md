# TypeScript, Imports, Exports, Constants, and Types

These rules apply to TypeScript code across the repository.

## Imports and Exports

### Do Not Use Default Imports

Reference modules with named imports or namespace imports.

- Names stay consistent at call sites.
- Renames and code search are easier.
- This works well with package `exports`.

```ts
// Good: named import
// Bad: default import
import crypto, { createHash, randomBytes } from "node:crypto";
// Good: namespace import
import * as path from "node:path";
import path from "node:path";
import { useMutation, useQuery } from "@tanstack/react-query";

// Good: package named imports
import { env } from "@arlequins/env";
```

### Prefer Named Exports

Export public module members with named exports. Avoid `export default` unless a framework or tool requires it.

```ts
export class ShopModel extends Model {
  // ...
}

export const BatchStatusCode = {
  RUNNING: "RUNNING",
  COMPLETED: "COMPLETED",
} as const;

export type BatchStatusCode =
  (typeof BatchStatusCode)[keyof typeof BatchStatusCode];

export function createPostService(db: Database) {
  // ...
}
```

Allowed default export exceptions:

| Case                                                         | Example                                                                     |
| ------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Next.js App Router pages and layouts                         | `app/page.tsx`, `app/layout.tsx`                                            |
| Configuration files for tools that require default exports   | `sst.config.ts`, `vite.config.ts`, `drizzle.config.ts`, `postcss.config.js` |
| Executable entry points that require a default export        | Seed scripts or runtime-specific entry points                               |
| Turborepo generator Plop configuration                       | `turbo/generators/config.ts`                                                |
| AWS Lambda handlers when the runtime requires default export | `export default handler;`                                                   |

Avoid default exports outside these cases.

## Constants and Enum-like Values

Do not use TypeScript `enum`. Use `as const` objects.

- Object names: PascalCase, such as `BatchStatusCode`, `Domain`, or `EnvStage`.
- Keys: SCREAMING_SNAKE_CASE, such as `RUNNING`, `USER_LOGIN`, or `COMMON`.
- Derive the value type with `(typeof X)[keyof typeof X]`.
- Export a same-name type when useful.

```ts
export const BatchStatusCode = {
  RUNNING: "RUNNING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  SKIPPED: "SKIPPED",
} as const;

export type BatchStatusCode =
  (typeof BatchStatusCode)[keyof typeof BatchStatusCode];
```

```ts
// Avoid
export enum BATCH_STATUS_CODE {
  RUNNING = "RUNNING",
}
```

## Types and TypeScript

### Prefer `type` over `interface`

Prefer `type` for object shapes. This keeps object shapes, unions, and intersections consistent.

This is a preference, not a hard ban. Use `interface` when declaration merging is required or when a library API expects an interface.

Generated files and plugin APIs may keep their existing style.

```ts
export type BatchMaster = {
  batchId: string;
  status: BatchStatusCode;
  startedAt: Date;
};

export interface ExtensibleOptions {
  retry: number;
}
```

### Separate Type Imports

Type-only imports must use a separate `import type` statement.

```ts
import { useQuery } from "@tanstack/react-query";

import type { RouterInputs, RouterOutputs } from "@arlequins/trpc/client";
import { useTRPC } from "@arlequins/trpc/client";
```

Avoid inline type imports such as `import { type Foo } from "..."` when Biome
enforces separated type imports.

### Strict Mode

New code should assume strict TypeScript settings, including:

- `strict: true`
- `noUncheckedIndexedAccess: true`, so array and record indexing returns `T | undefined`
- `checkJs: true` when JavaScript checking is enabled

Handle possibly undefined values with `??`, explicit checks, or `!` only when there is a strong reason.

### moduleResolution

- Use `"Bundler"` for repositories that run through bundlers, such as Next.js, Vite, or tsx.
- Use `"node16"` or `"nodenext"` for pure Node.js libraries that rely on package `exports` subpaths.
