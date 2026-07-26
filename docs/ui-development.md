# UI Development

The shared `@arlequins/ui` package provides three feedback loops:

- React Testing Library and Vitest for component behavior.
- Storybook for isolated visual development and accessibility checks.
- The application end-to-end suite for complete browser workflows.

## Commands

```bash
pnpm --filter @arlequins/ui test
pnpm storybook
pnpm storybook:build
```

Write tests around accessible roles and user-visible behavior. Keep stories next
to components as `*.stories.tsx`, and include representative states such as
disabled, destructive, loading, and validation states when applicable.

The Storybook accessibility addon reports violations while developing and the
static Storybook build is required by CI. A successful build confirms that every
story can be bundled independently from the Next.js application.

## Visual Regression

Playwright stores responsive baselines for representative dashboard, list,
user, and administration views. Update them deliberately with
`pnpm test:e2e --update-snapshots=all` after reviewing both desktop Chromium and
mobile Chrome output. The same suite runs WCAG A/AA checks on each view.

## Blog application example

The full preset includes a responsive editorial application under `apps/web`.
It demonstrates common product surfaces without coupling the template to a
specific business domain:

| Route | Example surface |
| --- | --- |
| `/` | Dashboard metrics, activity chart, publishing queue, and recent content |
| `/posts/` | Searchable and filterable data list |
| `/posts/[slug]/` | Static detail page with article content and performance data |
| `/editor/` | Stateful form with draft, publish, and preview actions |
| `/users/` | Role filtering, status display, and invitation dialog |
| `/admin/` | Tabbed publication, workflow, and security settings |

Shared application components live in `apps/web/src/components/blog`, while
sample content is isolated in `apps/web/src/lib/blog-data.ts`. Replace the data
module with tRPC queries when adapting the example to a real application. The
minimal preset removes the complete example, its images, and its UI-only
dependencies.
