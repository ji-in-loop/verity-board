# Publishing

Two workflows in [`.github/workflows`](../.github/workflows) automate CI and npm releases. Both
are free to run: this is a public repo, so GitHub Actions minutes are unmetered on standard
hosted runners, and publishing public npm packages costs nothing.

## CI (`ci.yml`)

Runs on every push/PR to `main`: build, typecheck, test, and lint across the whole pnpm
workspace on Node 20.x/22.x, plus a separate coverage job that uploads to Codecov. No secrets
required for the build-test matrix; the coverage job needs `CODECOV_TOKEN` (see the badge setup
note in the root README) but a missing token only affects the coverage badge, not the build.

## Publish (`publish.yml`)

Publishes all eleven `@verity-board/*` packages to the public npm registry, using `pnpm publish`
(not `npm publish`) — packages depend on each other via pnpm's `workspace:*` protocol, and only
`pnpm publish` rewrites that to the real resolved version in the published tarball. Triggers:
- Publishing a **GitHub Release** (recommended — gives you a changelog and a tagged version).
- Manually via **Actions → Publish to npm → Run workflow** (optionally choosing an npm dist-tag,
  e.g. `next` for a prerelease).

### One-time setup

1. Create an npm **automation token** with publish rights for the `@verity-board` scope: on
   npmjs.com, Account → Access Tokens → Generate New Token → Automation.
2. Add it as a repository secret without ever pasting it into chat or shell history where it'd
   be logged — run this yourself and paste the token at the interactive prompt:
   ```
   gh secret set NPM_TOKEN --repo ji-in-loop/verity-board
   ```

### Cutting a release

1. Bump `version` in the package(s) you're releasing (`packages/core/package.json`, etc.) —
   they version independently, and the workflow skips any package whose current version is
   already published.
2. Commit, push, and create a GitHub Release (tag it e.g. `v0.2.0`, or `core-v0.2.0` if only
   one package moved); publishing the release triggers the workflow.
3. Each package publishes with [npm provenance](https://docs.npmjs.com/generating-provenance-statements)
   attached, so consumers can verify the published artifact was built by this exact GitHub
   Actions run from this exact commit.

If a package's version already exists on npm, that publish step fails loudly rather than
silently no-op'ing — bump the version before releasing again.

### Package order

Published leaves-first (`core` → `config`/`model-adapter-shared` → the providers →
`orchestrator` → `reporters`/`cli`) purely so a failure partway through leaves a self-consistent
state — npm itself doesn't require a package's dependencies to already be published before it
accepts a publish.
