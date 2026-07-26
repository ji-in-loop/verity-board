# Architecture Decision Records (Initial)

## ADR-0001: Deterministic policy engine, separate from LLM judgment

**Status**: Accepted

**Context**: The product vision forbids majority voting and forbids the
model from setting the official recommendation. Without a structural
separation, it's easy for an implementation to drift toward "ask the model
what the overall recommendation should be" because it's the path of least
resistance.

**Decision**: `PolicyEvaluation.outcome` is computed exclusively by a pure
function in `packages/core` (`PolicyEngine.evaluate`), consuming only
validated `ActorReview[]` and `Evidence[]` facts. No `ModelProvider`
implementation's output is ever assigned directly to `overallRecommendation`.
An actor's own `recommendation` field is advisory/display-only.

**Consequence**: A critical finding from an actor whose `authority.
blockerCategories` includes the finding's category forces the corresponding
policy outcome (e.g. `NO_GO`) regardless of how many other actors approve.
This must be provable by a unit test, not just documented (see
[08-testing-strategy.md](08-testing-strategy.md)).

## ADR-0002: Local-file evidence provider first; MCP deferred to v0.4

**Status**: Accepted

**Context**: Requiring MCP servers, SaaS accounts, or hosted services for
the first release would violate the "local evidence first" and "no cloud
account required" requirements and would make the reference example
unrunnable without infrastructure.

**Decision**: `EvidenceProvider` is a port from day one; the only
implementation until v0.4 is `LocalFileEvidenceProvider`, which maps
capability requests to files inside a `ReviewCase` directory via a
declared, per-example mapping (not path-guessing).

**Consequence**: The v0.4 MCP evidence gateway is additive — one new
package and one new capability-mapping config shape — and requires no
change to `packages/core` or `packages/orchestrator`. This is the concrete
test of "architecture supports future MCP providers without requiring MCP
in v0.1."

## ADR-0003: pnpm workspaces, one package per adapter

**Status**: Accepted (2026-07-25 open question resolved: pnpm, matching the
vision doc, rather than `nohello`'s npm workspaces).

**Context**: Package-per-adapter (rather than one monolithic package with
optional dependencies) is what makes "core/orchestrator can never import a
concrete provider" mechanically checkable — each vendor SDK
(`@anthropic-ai/sdk`, `openai`, `@google/genai`) appears in exactly one
package's `package.json`, never in `packages/core` or
`packages/orchestrator`.

**Decision**: One package per port implementation, as laid out in
[04-architecture.md](04-architecture.md). Every model adapter also depends
on `@verity-board/model-adapter-shared` for the provider-neutral prompt
templates and the review-output JSON Schema, so the only thing that differs
between adapters is how each vendor's SDK is called and how its response is
parsed back into that same shape.

**Consequence**: Proven out in Version 0.1 with three real adapters
(Anthropic, OpenAI, Gemini) plus the deterministic mock, none of which
`core` or `orchestrator` import directly. Adding a fourth vendor, or an
enterprise's own OpenAI-compatible gateway, is one new package plus one
line in the CLI's provider registry (`packages/cli/src/model-providers.ts`)
— never a change to the domain layer. This is also a deliberate deviation
from the `nohello` repo's npm-workspaces convention, accepted knowingly for
this project.

## ADR-0004: Zod for schemas; small rule-expression grammar, not a DSL

**Status**: Accepted

**Context**: Config-driven decision rules need some conditional expression
capability (`criticalBlockers.count > 0`), but the anti-overengineering
constraints explicitly rule out a "complex policy language."

**Decision**: Use Zod as the single source of truth for all runtime
validation (config, evidence, actor output). For policy/activation rule
expressions, support only a small fixed grammar: comparisons
(`==`, `!=`, `>`, `<`, `>=`, `<=`) against a fixed, orchestrator-computed
fact table (counts, booleans, enums), combined via `any`/`all`. No
user-defined functions, no string interpolation, no `eval`, no access to
arbitrary object graphs beyond the documented fact table.

**Consequence**: Rule expressions are safe to parse and evaluate without a
sandboxing concern, at the cost of not supporting arbitrarily complex
conditions — consistent with "prefer interfaces over unfinished
implementations" and the explicit non-goal of a custom policy DSL.

## ADR-0005: One clarification round; no agent-to-agent conversation

**Status**: Accepted

**Context**: Autonomous multi-agent conversations are explicitly rejected
by the product vision as unbounded and unauditable.

**Decision**: Actors never call each other, never see each other's
`ActorReview` before consolidation, and get at most one clarification
round, with questions consolidated and deduplicated by the orchestrator
before being (conceptually) posed back to evidence/context — not to other
actors. Cross-review information sharing happens only through the
orchestrator's consolidation step, and only after independent reviews
complete.

**Consequence**: Total model calls per review are bounded and predictable:
`(number of activated actors) × (1 or 2 rounds)`, which makes
`maximumModelCalls` and `timeoutMs` limits meaningful and enforceable.

## ADR-0006: `CommitteeRecommendation` and `HumanApproval` are separate types with no automated producer for the latter

**Status**: Accepted

**Context**: The product vision requires that the platform "must not
pretend that AI has organizational authority" and that "the final decision
must always remain outside the automated recommendation."

**Decision**: `HumanApproval` is a distinct type in `packages/core` with no
constructor, factory, or code path anywhere in `packages/orchestrator` or
`packages/cli` that produces one. It is documented as an external record a
consuming organization creates through its own process (a meeting, a
ticket, a sign-off tool) — outside this repository's runtime entirely for
v0.1–v0.3.

**Consequence**: There is no "auto-approve" flag to accidentally leave on.
Making the wrong thing structurally awkward is preferred over a runtime
policy check, per the security assessment.

## ADR-0007: YAML for organizational configuration, TypeScript/Zod for core contracts

**Status**: Accepted

**Context**: Organizations authoring actors/committees/playbooks should not
need to write or compile TypeScript; the core engine needs strict runtime
validation regardless of what authored the YAML.

**Decision**: All org-facing configuration (actors, committees, playbooks,
policies) is YAML, loaded and validated into Zod-derived TypeScript types
by `packages/config`. No YAML file can express behavior beyond what the
schema allows — no templating, no code execution.

**Consequence**: A new committee or actor is a pull request touching only
YAML files plus (optionally) new example fixtures — never a change to
`packages/core` or `packages/orchestrator` source.

## ADR-0008: MIT license, matching prior project precedent

**Status**: Accepted

**Context**: The author's existing OSS project (`nohello`) is MIT-licensed
under "Balajikumar Murugan." Consistency reduces legal/administrative
overhead across the author's projects.

**Decision**: MIT license, copyright holder "Balajikumar Murugan," year
2026, matching the `nohello` `LICENSE` file format exactly.

**Consequence**: None of note — this is a low-risk, easily-revisited
choice if the author's preference differs for this specific project.
