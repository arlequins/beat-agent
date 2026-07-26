# Dependency and Release Automation

## Renovate

Install the Renovate GitHub App for the repository. The checked-in
`.github/renovate.json` then provides weekly updates, immediate vulnerability
alerts, bounded PR concurrency, and compatibility groups for the major runtime
stacks. Patch and stable minor updates may merge only after all required CI
checks pass. Major updates always require review.

Keep `main` protected and require CI and Security checks before enabling
Renovate automerge. The Dependency Dashboard is the operational view for
blocked, pending, and manually approved updates.

## Release Please

Release Please reads Conventional Commits on `main` and maintains one release
PR for the repository. The PR updates `package.json`,
`.release-please-manifest.json`, and `CHANGELOG.md`. Merging it creates a
`vX.Y.Z` tag and a GitHub Release. Keep `include-component-in-tag` disabled in
`release-please-config.json`; enabling it changes the expected tag to
`<package-name>-vX.Y.Z` and disconnects release history from the repository's
existing tags.

The workflow uses its short-lived `GITHUB_TOKEN` by default, so no release
secret is required. Grant GitHub Actions permission to create and approve pull
requests in the repository settings. The workflow itself grants only the
contents, issues, and pull-request permissions needed by Release Please.

Organizations that already manage a release automation app may optionally
store its installation token or a fine-grained token as
`RELEASE_PLEASE_TOKEN`. When present, that token takes precedence over
`GITHUB_TOKEN`. Do not use a personal broad-scope classic token.

```bash
gh secret set RELEASE_PLEASE_TOKEN
gh workflow run release.yml
```

Pull requests created with `GITHUB_TOKEN` can require a maintainer to approve
their workflow runs, depending on the repository's Actions settings. An
optional GitHub App or fine-grained token avoids that approval step and is
recommended when release PR validation must start unattended.

npm Trusted Publishing is independent from this GitHub automation. It replaces
an npm publishing token for `npm publish`; it does not provide permission to
create GitHub pull requests, tags, or releases. This template is private by
default and does not publish a package to npm.

Release PRs follow the same review and branch-protection requirements as other
changes. Do not manually edit the generated version or changelog unless the
release PR is being corrected deliberately.
