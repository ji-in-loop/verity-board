# Product Requirements Document

## 1. Problem statement

Engineering organizations make high-stakes go/no-go decisions — production
releases, architecture decisions, peak-traffic readiness — through processes
that are usually one of two failure modes:

1. **Ad hoc and undocumented.** A release review is a 30-minute meeting where
   whoever is in the room signs off. Evidence isn't checked systematically,
   disagreement isn't recorded, and there is no artifact to audit later.
2. **Rigid checklist bureaucracy.** A static checklist gets rubber-stamped
   because nobody actually re-verifies each line against current evidence,
   and it doesn't adapt to case-specific risk (a checkout release and an
   internal-tools release get the same 40 checkboxes).

Neither failure mode scales with organizational complexity, and both leave no
defensible trail when something goes wrong post-release.

Separately, the current wave of "AI agent" tooling tends to solve this badly:
a single LLM given a system prompt like "you are a senior SRE" and asked to
"approve or reject" produces persona theatre — plausible-sounding text with no
structural guarantee it checked anything, no way to distinguish a verified
fact from a guess, and (worse) an implicit claim that the AI's opinion *is*
the decision.

## 2. Product summary

verity-board is an open-source platform that runs a **structured review
committee** over an engineering decision. It is not a chatbot and not an
autonomous multi-agent system. It is closer to a **policy-driven review
pipeline** where:

- Each professional "actor" (SRE, Solution Architect, Product Manager, ...) is
  a bounded, schema-constrained skill — not a personality, a reviewer with a
  defined mandate, defined evidence permissions, and a defined output shape.
- Evidence is collected from real artifacts (test results, telemetry,
  ownership records) and explicitly tagged `VERIFIED` / `MISSING` /
  `CONTRADICTED` / `STALE` / `INFERRED` / `NOT_APPLICABLE` — never silently
  assumed to pass.
- The **recommendation** (`GO` / `NO_GO` / `CONDITIONAL_GO` / `ESCALATE`, or
  the equivalent for other playbooks) is computed by a deterministic policy
  engine reading actor findings as facts, not asked of the model as an
  opinion.
- The **decision** is always a human action, recorded separately from the
  recommendation.

## 3. Positioning

verity-board is an **engineering review committee platform**, not a generic
multi-agent framework. It is built *above* existing model and orchestration
primitives, the same way a review board is built above the individual
reviewers on it — the value is in the structure, the evidence discipline, and
the accountability chain, not in the existence of "AI agents."

Tagline: *"Evidence from systems. Perspectives from specialized actors.
Guardrails from policy. Accountability from humans."*

## 4. Target users

- **Platform/DevEx teams** at mid-to-large engineering organizations who
  currently run manual release-readiness or ADR reviews and want a
  repeatable, auditable process without building bespoke tooling.
- **SRE / release engineering** functions that need reliability and rollback
  evidence checked every time, not just when someone remembers to ask.
- **Individual OSS maintainers and small teams** who want a lightweight,
  local-first readiness check before a release, with no SaaS dependency.

Non-target (for now): organizations wanting the platform to *make* the
decision autonomously, or wanting a hosted/SaaS product on day one.

## 5. Success criteria for Version 0.1

Version 0.1 succeeds if a new user, starting from zero context, can:

1. Clone the repo and install dependencies with no cloud account, no paid API
   key, and no external service.
2. Run `verity-board review --committee production-readiness --case
   examples/production-readiness/checkout-release` and get a completed report
   in under a few seconds using the deterministic mock model.
3. Read the Markdown report and understand, without reading code, why the
   recommendation is what it is — which actor found what, which evidence was
   missing, what the required actions are, and who the human decision owner
   is.
4. Edit one actor or committee YAML file (e.g., remove SRE as required, or
   change a policy threshold) and observe the recommendation change on rerun.
5. Trust that the reported recommendation is reproducible from the same
   inputs — running twice with the mock model and unchanged fixtures produces
   the same recommendation and findings.

If a user cannot do all five without reading the source, v0.1 is not done.

## 6. Non-functional requirements

- **No hidden network calls.** Automated tests and the bundled example must
  never require network access.
- **No organizational-authority claims.** No output artifact may say "this is
  approved" — only "this is recommended," with a human decision owner field
  that is never auto-filled.
- **Determinism where it matters.** The policy engine and consolidation logic
  must be pure functions: same findings in, same recommendation out. Only the
  actor's *analysis* is allowed to vary with a real model provider; the mock
  provider is deterministic for tests.
- **Extensibility without core changes.** Adding a new actor, committee, or
  playbook must never require editing `packages/core` or `packages/
  orchestrator` — this is the concrete test of "provider-neutral, reusable
  core" and is explicitly re-validated in v0.2 and v0.3 by building different
  review types on the unchanged engine.

## 7. What this is not

- Not a CI/CD gate that blocks a pipeline automatically (v0.1–v0.3 have no
  such integration).
- Not a replacement for human sign-off — the human approval step is
  structurally outside the automated recommendation in every version.
- Not a general agent framework — it has one orchestrator, isolated actor
  invocations, and no agent-to-agent conversation, by design (see
  [ADR-0005](09-adrs.md)).
