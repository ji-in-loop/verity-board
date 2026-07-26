# verity-board (working name)

> An open-source, configurable, AI-assisted engineering review committee platform.
> Evidence from systems. Perspectives from specialized actors. Guardrails from
> policy. Accountability from humans.

**Status: Version 0.1 — core platform + Production Readiness reference
implementation.** Phase 0 (product/architecture design) is complete and
lives under [`docs/phase-0/`](docs/phase-0/README.md). This is the first
runnable release: four built-in actors, a deterministic policy engine, a
local file evidence provider, a fully offline mock model provider, and
optional model adapters for Anthropic, OpenAI (and any OpenAI-compatible
gateway), and Gemini — the project is not built around any single vendor's
model, by design (see [ADR-0003](docs/phase-0/09-adrs.md#adr-0003)).

## What problem this solves

Production-readiness reviews are usually either an undocumented meeting or a
static checklist nobody re-verifies. verity-board runs a structured
committee instead: each professional "actor" (SRE, Solution Architect,
Product Manager, Senior Engineering Lead) independently reviews the same
evidence, a deterministic policy engine — not an LLM, not a vote — computes
the recommendation, and a human always owns the final decision.

## Quickstart

```sh
git clone <this repo>
cd verity-board
pnpm install
pnpm -r --filter='./packages/*' run build
node packages/cli/dist/index.js review \
  --committee production-readiness \
  --case examples/production-readiness/checkout-release
```

No API key, no cloud account, no network access required — the default
model provider is a deterministic, offline mock. Runs in under a second.

## Sample output

```
# verity-board COMMITTEE REVIEW

**Case:** Checkout Platform Release 8.4
**Committee:** production-readiness
**Recommendation:** NO_GO

## Actor positions

- **Senior Engineering Lead:** GO
- **Site Reliability Engineer:** NO_GO
- **Solution Architect:** CONDITIONAL_GO
- **Product Manager:** GO

## Critical blockers

- (Site Reliability Engineer) Rollback validation failed in staging at the database migration reversal step.

## Material risks

- (Site Reliability Engineer) Dependent service (payments-service) load-testing result was not provided; capacity under the new call pattern is unverified.
- (Solution Architect) Monthly infrastructure cost increases by $1,100 and the variance is not yet approved.

## Missing evidence

- No evidence was supplied for capability "testing.performance_results" (subject: checkout-service).

## Required actions

1. Correct and rerun rollback validation.
2. Attach dependent-service load-test evidence.
3. Assign an owner to the infrastructure-cost variance.

## Human decision owner

Release Director

---
_This is a recommendation, not a decision. No organizational action has been
taken. The policy rule that produced this recommendation and the evidence
behind every finding are recorded in the accompanying JSON report._
```

A single critical finding from the SRE forces `NO_GO` regardless of how many
other actors approve — see [ADR-0001](docs/phase-0/09-adrs.md#adr-0001). A
full JSON report (findings, evidence provenance, the exact policy rule that
fired, and an audit trail) is written alongside the Markdown report.

Try changing the outcome yourself: edit
`examples/production-readiness/checkout-release/rollback-report.json`'s
`succeeded` field, or remove `sre-reviewer` from
`catalog/committees/production-readiness.yaml`, and rerun the command above.

## How it works

- **Actors** (`catalog/actors/*.yaml`) are structured skills — a mandate,
  evaluation criteria, permitted evidence capabilities, question limits, and
  blocker authority — not just a system prompt with a job title. See
  [authoring guide](docs/phase-0/05-interfaces.md) for the contract.
- **Committees** (`catalog/committees/*.yaml`) define which actors are
  required, which activate conditionally, and the execution/decision policy
  that governs the review.
- **Playbooks** (`catalog/playbooks/*.yaml`) define a review task type's
  input requirements and outcome vocabulary (e.g. `GO`/`NO_GO`/
  `CONDITIONAL_GO`/`ESCALATE`).
- **Why humans retain final authority**: the platform never constructs a
  `HumanApproval` record — see [ADR-0006](docs/phase-0/09-adrs.md#adr-0006).
  A `CommitteeRecommendation` and a human decision are permanently distinct
  types in this codebase.
- **Creating a custom actor or committee** is a YAML-only change — add a
  file under `catalog/actors/` or `catalog/committees/`, no code change
  required. See [06-config-and-schema-examples.md](docs/phase-0/06-config-and-schema-examples.md).

## Package layout (pnpm workspace)

| Package | Responsibility |
|---|---|
| `@verity-board/core` | Domain contracts (Zod schemas), the pure policy engine, consolidation/dedup logic — zero I/O |
| `@verity-board/config` | YAML loaders for actors/committees/playbooks/policies |
| `@verity-board/orchestrator` | The Chair: execution engine, evidence planning, stopping conditions |
| `@verity-board/providers-evidence-local` | Local file evidence provider |
| `@verity-board/model-adapter-shared` | Provider-neutral prompt building and the review-output JSON Schema, shared by every model adapter |
| `@verity-board/providers-model-mock` | Deterministic, offline model provider (default; used in all tests) |
| `@verity-board/providers-model-anthropic` | Optional Anthropic adapter |
| `@verity-board/providers-model-openai` | Optional OpenAI adapter — also works against any OpenAI-compatible gateway (Azure OpenAI, Ollama, vLLM, LM Studio, ...) via `--model openai` + a base URL |
| `@verity-board/providers-model-gemini` | Optional Google Gemini adapter |
| `@verity-board/reporters` | JSON and Markdown report rendering |
| `@verity-board/cli` | The `verity-board` command |

Every adapter package depends only on `@verity-board/core`'s `ModelProvider`
interface and its own vendor SDK — `core` and `orchestrator` never import a
concrete provider (ADR-0003). Full architecture rationale:
[docs/phase-0/04-architecture.md](docs/phase-0/04-architecture.md).

## Running with a real model

The mock provider is the default and the only one exercised in automated
tests — see [docs/phase-0/08-testing-strategy.md](docs/phase-0/08-testing-strategy.md).
For a real committee review, pick `--model <provider>`:

```sh
# Anthropic
export ANTHROPIC_API_KEY=sk-ant-...
node packages/cli/dist/index.js review --committee production-readiness \
  --case examples/production-readiness/checkout-release --model anthropic

# OpenAI (or Azure OpenAI / Ollama / vLLM / LM Studio / any OpenAI-compatible gateway)
export OPENAI_API_KEY=sk-...
export VERITY_BOARD_OPENAI_BASE_URL=https://your-gateway.example.com/v1  # optional
node packages/cli/dist/index.js review --committee production-readiness \
  --case examples/production-readiness/checkout-release --model openai

# Gemini
export GOOGLE_API_KEY=...
node packages/cli/dist/index.js review --committee production-readiness \
  --case examples/production-readiness/checkout-release --model gemini
```

Each adapter's model defaults to a mid-tier model for its vendor and can be
overridden with an env var (`VERITY_BOARD_ANTHROPIC_MODEL`,
`VERITY_BOARD_OPENAI_MODEL`, `VERITY_BOARD_GEMINI_MODEL`) or a constructor
option if you're embedding the packages directly.

**Adding a new vendor or enterprise gateway** is one new package plus one
line in `packages/cli/src/model-providers.ts`'s registry — no change to
`core`, `orchestrator`, or any other adapter. See
[ADR-0003](docs/phase-0/09-adrs.md#adr-0003).

## Testing

```sh
pnpm -r --filter='./packages/*' run typecheck
pnpm -r --filter='./packages/*' run test
pnpm lint
```

72 tests across 11 packages, zero network calls, zero live model calls by
default. Each real-model adapter also ships one contract test gated behind
`VERITY_BOARD_LIVE_MODEL_TESTS=1` (skipped otherwise) that hits its vendor's
live API — run it yourself with the relevant API key set to verify a new
adapter end-to-end.

## Documentation

Phase 0's full design record — PRD, domain model, architecture, security
assessment, testing strategy, ADRs, roadmap — lives under
[`docs/phase-0/`](docs/phase-0/README.md).
