# Domain Model

## 1. Entities

### Static configuration (authored by an organization, versioned in YAML)

- **ActorSkill** — one professional review responsibility: mandate, criteria,
  evidence permissions, question limits, escalation rules, output schema.
  Actors are *definitions*, invoked fresh for every review; they hold no
  state between reviews.
- **Committee** — a named group of actors (required + conditionally
  activated) plus the execution limits and decision policy that apply when
  they review together.
- **Playbook** — a review task type (e.g. "production readiness"): which
  committee(s) it can use, what input a `ReviewCase` must supply, the
  expected outcome vocabulary (`GO`/`NO_GO`/...), and mandatory controls.
- **DecisionPolicy** — the deterministic rule set a committee's policy engine
  evaluates against consolidated findings to produce a recommendation.

### Per-review instances (created fresh for each review run)

- **ReviewCase** — the concrete thing being reviewed: title, description,
  service/application metadata, risk classification, submitted artifacts,
  evidence references, requesting team, and the human decision owner.
- **EvidencePlan / EvidenceRequest** — the set of abstract capability
  requests (e.g. `testing.integration_results`) the orchestrator builds from
  the union of all activated actors' `requiredCapabilities`.
- **Evidence** — the canonical, normalized record returned for one
  `EvidenceRequest`, carrying a status (`VERIFIED`/`MISSING`/`CONTRADICTED`/
  `STALE`/`NOT_APPLICABLE`/`INFERRED`), provenance, and freshness.
- **ActorContext** — the bounded view assembled for exactly one actor
  invocation: case metadata, only the evidence that actor is permitted to
  see, its mandate/criteria, applicable policy fragments, and — on the
  second pass — the prior clarification response. Actor contexts never
  contain another actor's findings or questions.
- **Finding** — one atomic, evidence-referenced assessment against one
  criterion, produced by one actor.
- **ClarificationQuestion** / **ClarificationResponse** — a question an
  actor is permitted to ask (bounded by `maximumQuestions`), consolidated
  and deduplicated across actors by the orchestrator before a single
  clarification round is run.
- **ActorReview** — one actor's full output for a review round: findings,
  blockers, risks, unknowns, clarification questions, its own recommendation
  vocabulary value, and confidence.
- **PolicyEvaluation** — the deterministic result of running a committee's
  `DecisionPolicy` against the consolidated `ActorReview`s and evidence gaps:
  which rule fired, why, and the resulting outcome.
- **CommitteeRecommendation** — the final auditable artifact: all actor
  recommendations, consolidated blockers/risks/missing-evidence/
  disagreements, required actions, the `PolicyEvaluation`, the overall
  recommendation, the designated human decision owner, and audit metadata.
- **AuditTrail** — an append-only record of what the orchestrator did:
  evidence fetched (with source and timestamp), actors invoked, model calls
  made, stopping condition that ended the run. Exists so the
  `CommitteeRecommendation` is defensible after the fact, not just plausible
  at the time.
- **HumanApproval** — deliberately *not* part of `CommitteeRecommendation`.
  A separate record: who approved, when, and whether they followed or
  overrode the recommendation. verity-board never writes this field itself.

## 2. Why `CommitteeRecommendation` and `HumanApproval` are separate types

This is the single most important modeling decision in the whole system. If
"recommendation" and "decision" were the same object, it would be trivial for
downstream tooling to treat the AI's output as authoritative by accident —
e.g., a script that reads `recommendation.outcome` and auto-merges. Keeping
them as two types, where `HumanApproval` is never populated by any code path
in this repository, makes that misuse structurally awkward rather than the
path of least resistance. See [ADR-0006](09-adrs.md#adr-0006).

## 3. Lifecycle of a review (entity flow)

```
Playbook + ReviewCase
        │
        ▼
Committee resolved (required actors + conditional actors whose
activation rule matches ReviewCase)
        │
        ▼
EvidencePlan built (union of all activated actors' requiredCapabilities)
        │
        ▼
EvidenceProvider(s) resolve EvidencePlan → Evidence[]
        │
        ▼
For each activated actor, independently and in parallel:
  ActorContext built (case + permitted Evidence subset + mandate + criteria)
        │
        ▼
  ActorRuntime invokes ModelProvider → raw output
        │
        ▼
  Output validated against actor's outputSchema → ActorReview
        │
        ▼
Orchestrator consolidates ClarificationQuestions across all ActorReviews,
deduplicates, applies maximumClarificationRounds (default/ceiling: 1)
        │
        ▼
(If a clarification round runs) actors re-invoked with responses →
final ActorReview per actor
        │
        ▼
PolicyEngine(DecisionPolicy, ActorReview[], evidence gaps) → PolicyEvaluation
        │
        ▼
CommitteeRecommendation assembled (JSON + Markdown reporters render it)
        │
        ▼
[STOP — human approval happens outside this system]
```

## 4. Invariants the implementation must preserve

1. An `ActorContext` never contains another actor's `ActorReview`,
   `Finding`s, or questions. Cross-actor information only exists in the
   orchestrator's consolidation step, after independent reviews complete.
2. `Evidence.status` is never inferred as `VERIFIED` by omission. Absence of
   evidence produces `MISSING`, explicitly, and `MISSING` evidence is a
   first-class input to the policy engine — never silently dropped.
3. `PolicyEvaluation.outcome` is computed only by the policy engine, from
   configured rules, never returned directly by a model call. If a model
   response includes a suggested outcome field, the orchestrator treats it as
   an unvalidated actor opinion for display purposes only, not as the
   recommendation.
4. `CommitteeRecommendation` and `HumanApproval` are always distinct records;
   no code path sets one from the other.
5. Every `Finding` carries an explicit `isInferred` (or equivalent factual/
   inferred indicator) — a model cannot present a guess with the same
   confidence signature as a directly-verified fact.
