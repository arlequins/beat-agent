# Semantic Versioning and Commit-Based Version Management

This document defines how this repository uses Semantic Versioning and how Conventional Commits influence version decisions.

## Semantic Versioning

Versions use the `MAJOR.MINOR.PATCH` format, such as `1.2.3`.

| Number  | Name  | Increment when                                                 | Meaning for users                                                |
| ------- | ----- | -------------------------------------------------------------- | ---------------------------------------------------------------- |
| `MAJOR` | Major | A breaking change removes backward compatibility.              | Existing usage may stop working without changes.                 |
| `MINOR` | Minor | A backward-compatible feature is added.                        | New functionality is available, while current usage still works. |
| `PATCH` | Patch | A backward-compatible bug fix or behavior improvement is made. | Behavior is fixed or improved without changing usage.            |

When incrementing a version, increase the selected number by one and reset all numbers to its right to zero.

- `1.2.3` with a minor bump becomes `1.3.0`.
- `1.2.3` with a patch bump becomes `1.2.4`.

See [Semantic Versioning 2.0.0](https://semver.org/) for the full specification.

## Version Decisions from Commit Messages

Look at commits since the previous release and choose the largest applicable change type.

| Commit kind     | Example                                                                       | Version impact                                                                                  |
| --------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Breaking change | `feat!: change API shape` or a footer with `BREAKING CHANGE:`                 | Increment `MAJOR`, such as `1.2.3` to `2.0.0`.                                                  |
| Feature         | `feat: add batch creation form`                                               | Increment `MINOR`, such as `1.2.3` to `1.3.0`.                                                  |
| Bug fix         | `fix: handle empty batch payload`                                             | Increment `PATCH`, such as `1.2.3` to `1.2.4`.                                                  |
| Other changes   | `chore`, `docs`, `style`, `refactor`, `test`, `ci`, `build`, `perf`, `revert` | Usually no version bump, unless the release policy explicitly treats the change as publishable. |

For commit format details, see [Git conventions](conventions/git.md#commit-messages-conventional-commits-10).

## Repository Release Model

- Version source: root `package.json` and the matching git tag, such as `vX.Y.Z`.
- Release unit: the whole repository. Internal packages such as `@arlequins/ui` and `@arlequins/trpc` are private workspace packages and do not receive independent npm releases unless the repository adopts a separate publication workflow.
- Changelog: Release Please updates `CHANGELOG.md` from Conventional Commits.

Release flow:

1. Merge Conventional Commits into `main`.
2. Release Please creates or updates the repository release PR.
3. Review the computed version and generated changelog under normal CI and
   branch protection.
4. Merge the release PR to update `package.json` and `CHANGELOG.md`.
5. Release Please creates the matching `vX.Y.Z` tag and GitHub Release.

## Summary

| Item              | Policy                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------ |
| Version format    | `MAJOR.MINOR.PATCH`                                                                        |
| Version decision  | Follow Conventional Commits and choose the largest change type since the previous release. |
| Version source    | Root `package.json` and git tag.                                                           |
| Release unit      | Whole repository by default.                                                               |
| Publication       | Internal workspace packages remain private unless explicitly configured otherwise.         |
| Changelog         | Generated in the Release Please PR.                                                        |
| Release mechanism | Release Please PR, `vX.Y.Z` tag, and GitHub Release.                                       |

Use `feat`, `fix`, and `BREAKING CHANGE` deliberately so releases communicate the intended impact clearly.
