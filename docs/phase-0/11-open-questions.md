# Open Questions Requiring a Human Decision

**Resolved 2026-07-25**: the project owner accepted all recommendations
below as written. Version 0.1 proceeds on that basis:

1. Name stays **verity-board**.
2. Rollback-validation-failed is a critical blocker → forces `NO_GO`
   (Option A). The bundled example is built to match.
3. Engineering Manager is **deferred**, not included in the v0.1 committee.
4. **pnpm** workspaces, as originally specified.
5. No action yet — repo stays under `ji-in-loop` for now; publishing
   destination decided later.
6. Anthropic SDK confirmed as an isolated optional dependency of
   `packages/providers-model-anthropic`.
7. MIT / "Balajikumar Murugan" / 2026, matching `nohello`.
8. No telemetry.

The original text below is kept for context on *why* each call was made.

---

These block or shape Version 0.1 and cannot be resolved by architecture
reasoning alone — they need the project owner's decision.

## 1. Project name

"verity-board" is a working name. See the naming shortlist delivered
alongside this document (also summarized here for the record):

| Candidate | Note |
|---|---|
| **verity-board** | Original working name. Clear, on-theme ("verity" = truth/evidence). `verityboard` is free as a GitHub username/org namespace. |
| **Docket** | Evokes a formal review register/case list. Simple, memorable. `docket` is already a taken GitHub *organization* namespace — would need a variant (e.g. `docket-board`) for a dedicated org later, though not for a personal repo under `ji-in-loop/docket`. |
| **Quorum** | Evokes the minimum members needed to conduct official business — thematically strong. Both the GitHub org and user namespace are already taken by unrelated accounts; would need a suffix (e.g. `quorum-board`, `quorumreview`). |
| **Synod** | An assembly convened to deliberate — apt, distinctive. Also already taken as a GitHub user/org namespace. |
| **Actorbench** / **Readybench** | Literal, descriptive, fully available on GitHub. Less evocative than the above but zero naming-collision risk. |

Recommendation: keep **verity-board** (rename to `verityboard` or
`verity-board` consistently for repo/package naming) unless a stronger
preference emerges — it already fully avoids namespace collisions and the
product vision's own text is written around it (positioning copy, tagline,
example committee names). Renaming later is possible but costs README/
package/CLI-binary-name churn, so better to decide now than mid-v0.1.

## 2. A genuine spec inconsistency found during this review

The product vision's own Version 0.1 sample output (§6) shows:

```
SRE: NO_GO
...
Critical blocker:
Rollback validation failed in staging.
...
Recommendation: CONDITIONAL_GO
```

But §3.4 states the policy rule set explicitly includes
`reliability.rollback_unverified` under `criticalBlockers`, with the first
matching rule being `criticalBlockers.count > 0 → NO_GO`. Read literally,
a failed rollback validation *is* `reliability.rollback_unverified`, which
should force `NO_GO`, not `CONDITIONAL_GO` — and §3.4 separately states
"a critical SRE... blocker must not be cancelled because several other
actors recommend approval," which is precisely what the sample output
appears to do.

This needs a decision before v0.1's policy engine and reference example are
built, because the reference example's expected output is a golden-file
test target:

- **Option A**: The sample output is illustrative/imprecise, and the real
  rule is as written — a rollback-validation failure is a critical blocker
  and must yield `NO_GO`. The bundled example's fixtures and expected report
  should be updated to match (this is what Version 0.1 will do by default
  unless told otherwise).
- **Option B**: There's an intended distinction between "rollback validation
  failed" (a defect to fix, `CONDITIONAL_GO`-eligible) and "rollback
  validation not performed at all / unverified" (`reliability.
  rollback_unverified`, `NO_GO`-eligible) — i.e., a failed-but-attempted
  validation is different from an unattempted one, and the policy's
  `criticalBlockers` list should be read narrowly. If so, the criteria
  distinguishing these two evidence outcomes need to be spelled out
  explicitly in the policy config, not left implicit.

Recommendation: Option A is simpler, more defensible, and matches the
explicit "no majority voting, no cancelling a critical blocker" principle
literally. Flagging for confirmation rather than silently picking it.

## 3. Fifth actor: Engineering Manager in v0.1?

The vision says "optional fifth actor only if clearly justified." Given the
four required actors (Senior Engineering Lead, SRE, Solution Architect,
Product Manager) already cover workflow/testing, operations, architecture,
and business/acceptance criteria respectively, Engineering Manager's
distinct value in *this specific* committee is unclear — its criteria
(business alignment, ownership, team capability, delivery feasibility)
substantially overlap with Product Manager and Senior Engineering Lead in a
single-service production-readiness context. Recommendation: **defer**
Engineering Manager to v0.1 unless a concrete production-readiness scenario
is identified where it adds a criterion none of the other four actors
cover. (It has clearer standalone value in the v0.2 ADR committee, where the
vision already assigns it distinct criteria — business alignment, cross-team
dependencies, adoption plan — that don't overlap with Solution Architect.)

## 4. pnpm vs. npm workspaces

The vision's recommended stack specifies pnpm. The author's prior project
(`nohello`) uses npm workspaces. See [ADR-0003](09-adrs.md#adr-0003) —
proceeding with pnpm as specified unless told to match `nohello`'s npm
convention instead.

## 5. GitHub destination: personal repo vs. dedicated org

`nohello` publishes npm packages under a dedicated `nohello` npm org while
the GitHub repo lives at `ji-in-loop/nohello`. Should verity-board follow
the same pattern (repo under the personal `ji-in-loop` account, npm
packages under a project-named npm org, e.g. `@verity-board/core`), or
should this project get its own GitHub org from the start given the
"platform" ambition? No action needed until package publishing begins
(v0.1 does not require publishing to npm to be "done" — the CLI can run from
source), but worth deciding before the first release tag.

## 6. Anthropic SDK as an optional dependency

Confirming it's acceptable for `packages/providers-model-anthropic` to
depend on `@anthropic-ai/sdk` as specified in the vision (§6, "One optional
Anthropic adapter"), isolated to that single package and never imported by
`core`/`orchestrator`/other providers. No other model vendor SDK is in scope
for v0.1.

## 7. License holder and formatting

Proceeding with MIT / "Balajikumar Murugan" / 2026, identical format to
`nohello`'s `LICENSE` (already applied to this repo's `LICENSE` file as a
starting point) — flagging in case a different holder name or a
dual-license approach is wanted for this specific project.

## 8. Telemetry / analytics

Confirming there is no phone-home telemetry of any kind in the CLI (no
usage analytics, no crash reporting to a third party) — consistent with
"no cloud account required" and not mentioned as a requirement anywhere in
the vision, so treating its absence as the default unless specified
otherwise.
