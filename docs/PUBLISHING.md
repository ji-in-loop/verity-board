# Publishing

Two workflows in [`.github/workflows`](../.github/workflows) automate CI and npm releases. Both
are free to run: this is a public repo, so GitHub Actions minutes are unmetered on standard
hosted runners, and publishing public npm packages costs nothing.

## CI (`ci.yml`)

Runs on every push/PR to `main`: build, typecheck, test, and lint across the whole pnpm
workspace on Node 20.x/22.x, plus a separate coverage job that uploads to Codecov.

## Publish (`publish.yml`)

Publishes all eleven `@verity-board/*` packages to the public npm registry using **npm Trusted
Publishing (OIDC)** — no `NPM_TOKEN` secret, ever. Triggers:
- Publishing a **GitHub Release** (recommended — gives you a changelog and a tagged version).
- Manually via **Actions → Publish to npm → Run workflow** (optionally choosing an npm dist-tag,
  e.g. `next` for a prerelease).

### Why this isn't a plain `npm publish` or `pnpm publish`

Packages depend on each other via pnpm's `workspace:*` protocol (e.g.
`packages/cli/package.json` depends on `"@verity-board/core": "workspace:*"`). Only `pnpm pack`
/ `pnpm publish` rewrite that to the real resolved version in the tarball — a bare `npm publish`
would ship a broken `workspace:*` range to consumers. Verified locally with `pnpm pack` before
relying on it in CI.

But `pnpm publish` itself has no Trusted Publishing (OIDC) support as of pnpm 11.x — checked
`pnpm publish --help` directly, across pnpm 9/10/11: no such flag or mechanism exists. `npm`'s
CLI (≥11.5.1) does. So the workflow combines both: `pnpm pack` produces a tarball with
`workspace:*` correctly rewritten, then `npm publish <tarball>` publishes it — the one command
that actually understands Trusted Publishing.

### One-time setup — this is the part that needs you, specifically

**npm has no way to register a Trusted Publisher for a package that has never been published.**
There's no settings page to configure until the package exists. So getting from "zero packages
published" to "CI publishes everything automatically" is a two-phase process:

**Phase 1 — bootstrap: publish every package once, from your own machine.**

```sh
npm login   # if not already logged in — needs your ji-in-loop npm account
pnpm run build

for pkg in core config model-adapter-shared providers-evidence-local \
           providers-model-mock providers-model-anthropic providers-model-openai \
           providers-model-gemini orchestrator reporters cli; do
  (cd "packages/$pkg" && pnpm publish --access public --no-git-checks)
done
```

This uses your own authenticated npm session — no token involved, nothing to store. Each
package publishes as `0.1.0` (or whatever `version` currently is). If your npm account has
2FA-on-writes enabled (yours does, via passkey), expect an OTP/passkey prompt on each publish —
that's normal for an interactive session and unrelated to the automation-token restriction that
blocked you earlier.

**Phase 2 — configure Trusted Publishing per package, now that each one exists.**

For each of the 11 packages, on npmjs.com:
1. Go to the package's page → **Settings** → **Trusted Publisher**.
2. Add a GitHub Actions trusted publisher:
   - **Organization or user**: `ji-in-loop`
   - **Repository**: `verity-board`
   - **Workflow filename**: `publish.yml` (filename only, not the full path)
   - **Environment**: leave blank unless you set up a GitHub Environment for this
3. Save. npm doesn't validate these fields when you save them — a typo only surfaces the next
   time you try to publish, so double-check the owner/repo/filename match exactly.

After Phase 2, `publish.yml` can publish new versions of that package with zero secrets — the
OIDC token GitHub Actions generates for the run is all it needs.

### Cutting a release (after the one-time bootstrap)

1. Bump `version` in the package(s) you're releasing (`packages/core/package.json`, etc.) —
   they version independently, and the workflow skips any package whose current version is
   already published.
2. Commit, push, and create a GitHub Release (tag it e.g. `v0.2.0`, or `core-v0.2.0` if only
   one package moved); publishing the release triggers the workflow.
3. Each package publishes with [npm provenance](https://docs.npmjs.com/generating-provenance-statements)
   attached, so consumers can verify the published artifact was built by this exact GitHub
   Actions run from this exact commit.

If a package's version already exists on npm, that publish step fails loudly rather than
silently no-op'ing — bump the version before releasing again. If a package hasn't had Trusted
Publishing configured yet (Phase 2 skipped for it), the workflow's publish step for that package
will fail with an auth error — go configure it, then re-run.

### Package order

Published leaves-first (`core` → `config`/`model-adapter-shared` → the providers →
`orchestrator` → `reporters`/`cli`) purely so a failure partway through leaves a self-consistent
state — npm itself doesn't require a package's dependencies to already be published before it
accepts a publish.
