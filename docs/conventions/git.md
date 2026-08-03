# Git, Branches, Commits, and Releases

This convention applies to this repository and its workspaces.

## Branch Strategy

| Branch                        | Purpose                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------------------ |
| `main`                        | Production branch. Only tagged release versions should land here.                          |
| `develop`                     | Integration branch for the next release candidate.                                         |
| `feature/<short-description>` | New features and improvements. Branch from `develop`, then merge back through a PR.        |
| `fix/<short-description>`     | Non-urgent bug fixes. Branch from `develop`, then merge back through a PR.                 |
| `release/X.Y.Z`               | Release preparation, including version updates and final adjustments. Created by git-flow. |
| `hotfix/X.Y.Z`                | Urgent production fixes. Branch from `main`, then merge into both `main` and `develop`.    |

Prefer stacked PRs for large changes so each review stays small and focused.

## Merge Strategy

- Use squash merge for `feature/*` and `fix/*` into `develop`. The PR title becomes the commit message, so PR titles must follow [Conventional Commits](#commit-messages-conventional-commits-10).
- Use merge commits for `release/X.Y.Z` into `main` and for `hotfix/X.Y.Z` into `main` and `develop`, so git-flow history remains traceable.

## Commit Messages: Conventional Commits 1.0

Format:

```text
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

Allowed types:

| Type       | Use                                                         |
| ---------- | ----------------------------------------------------------- |
| `feat`     | New feature                                                 |
| `fix`      | Bug fix                                                     |
| `docs`     | Documentation-only changes, such as `README` or conventions |
| `refactor` | Internal changes that do not alter external behavior        |
| `perf`     | Performance improvements                                    |
| `test`     | Test additions or changes                                   |
| `chore`    | Dependency updates or tool configuration                    |
| `ci`       | CI configuration                                            |
| `build`    | Build or bundling configuration                             |
| `style`    | Formatting-only changes with no logic changes               |
| `revert`   | Reverts an existing commit                                  |

`scope` should name the changed package or area, such as `db`, `trpc`, `ui`, `tooling`, `web`, `api`, or `batch`. It is optional.

Subject rules:

- Use the imperative mood.
- Aim for 50 characters or fewer. `header-max-length` may allow up to 100 characters.
- Do not end with a period.
- Write subjects in English.

Use the optional body to explain background and intent. Wrap hard lines around 72 characters when practical.

Footer rules:

- Breaking changes: use `BREAKING CHANGE: <description>` in the footer, or add `!` to the subject, such as `feat!: ...`.
- Issue references: use `Refs: #123` or `Closes: #123`.

Examples:

```text
feat(validators): add Zod schema for batch creation

Add a shared validator around the insert schema so form submissions
and service entry points validate the same payload shape.

Closes: #42
```

```text
feat(trpc)!: change session shape in context

BREAKING CHANGE: ctx.session.token has been renamed to ctx.session.accessToken.
```

## Enforcement

| Layer                   | Mechanism                                                                   | Purpose                                     |
| ----------------------- | --------------------------------------------------------------------------- | ------------------------------------------- |
| Documentation           | This convention                                                             | Shared team understanding                   |
| PR title validation     | `.github/workflows/pr-title.yml` with `amannn/action-semantic-pull-request` | Reject invalid squash-merge commit messages |
| Local commit validation | `.husky/commit-msg` running `pnpm commitlint --edit $1`                     | Reject invalid local commits                |

Enable both PR title validation and commitlint so the convention is mechanically enforced.

### commitlint Configuration

The root `commitlint.config.mjs` should configure:

- `type-enum`: enforce the allowed types listed above.
- `subject-case: [0]`: disable subject case validation.
- `subject-full-stop: [2, "never", "."]`: disallow a trailing period.
- `header-max-length: [2, "always", 100]`: allow headers up to 100 characters.
- `body-leading-blank` and `footer-leading-blank`: keep the default behavior.

## Release Procedure

See [semantic versioning](../semantic-versioning.md) for version calculation.

1. Merge Conventional Commits into `main`.
2. Review the Release Please PR containing the version and changelog update.
3. Merge the release PR after required checks and approvals pass.
4. Confirm that Release Please created the `vX.Y.Z` tag and GitHub Release.

See [dependency and release automation](../automation.md) for repository setup.

## Hotfix Procedure

1. Run `git flow hotfix start X.Y.Z` to create `hotfix/X.Y.Z` from `main`.
2. Commit the fix.
3. Run `git flow hotfix finish X.Y.Z`.
   - This merges into both `main` and `develop`, and adds the `vX.Y.Z` tag.
4. Run `git push origin main develop --follow-tags`.
