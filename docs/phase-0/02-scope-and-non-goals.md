# Scope and Non-Goals

## In scope, Phase 0 (this phase)

- Product requirements, domain model, architecture, package boundaries.
- Core TypeScript contract proposals (types/interfaces only, no logic).
- Example configuration schemas (actor, committee, playbook, evidence,
  finding, report).
- Security and trust-boundary assessment.
- Testing strategy.
- Initial ADRs.
- Versioned roadmap.
- Open questions for the human owner.

Explicitly **not** in scope for Phase 0: any file under a would-be `packages/`
or `src/` implementation tree, any `package.json`, any build tooling, any
actual model or evidence-provider code.

## In scope, Version 0.1

- One committee: Production Readiness.
- Four required actors (Senior Engineering Lead, SRE, Solution Architect,
  Product Manager), with Engineering Manager as a fifth actor only if
  Phase 0 review concludes it's justified (see
  [open questions](11-open-questions.md)).
- YAML-defined actors, committees, playbooks.
- Local file evidence provider only.
- Model-provider interface with two implementations: deterministic mock
  (default, used in all automated tests) and one optional Anthropic adapter.
- Parallel actor execution, one configurable clarification round.
- Deterministic decision policy engine.
- JSON and Markdown reporters.
- CLI (`verity-board review ...`).
- One fully runnable example case (`checkout-release`).

## Non-goals through Version 0.3

These are excluded not because they're low-value, but because including them
early would violate the platform's core discipline (bounded scope, no
premature infrastructure) and would make it impossible to prove the "reuse
without core changes" claim that v0.2 and v0.3 exist to demonstrate:

- MCP evidence providers (arrives in v0.4, and only if v0.1–v0.3 demonstrate
  genuine reuse).
- GitHub Action / CI integration.
- Web interface or dashboard.
- Persistent database of any kind.
- Jira, Confluence, Datadog, Grafana, Jenkins, Kubernetes, Terraform
  integrations.
- Enterprise authentication / SSO.
- Plugin marketplace or dynamic plugin loading.
- Autonomous agent-to-agent conversation of any kind.
- Automated production-deployment approval (i.e., verity-board never presses
  the deploy button; it only produces a recommendation for a human).
- ADR review and Peak Readiness example projects (arrive in v0.2 / v0.3
  respectively, using the same unmodified core).

## Non-goals indefinitely (unless a future phase explicitly revisits them)

- Majority voting as a decision mechanism. A single critical blocker from an
  authoritative actor (SRE on reliability, Security on a critical finding)
  overrides approvals from every other actor — this is a permanent design
  constraint, not a v0.1 simplification.
- The model determining the official recommendation. The policy engine is
  and remains authoritative; the model's role is bounded to producing
  evidence-grounded findings.
- Organization hierarchy management, a custom workflow language, a custom
  agent protocol, or a complex policy DSL beyond the rule shape in
  [09-adrs.md](09-adrs.md) / [06-config-and-schema-examples.md](06-config-and-schema-examples.md).
- Claiming or implying that a `CommitteeRecommendation` is a `Decision`. These
  remain structurally distinct types forever (see
  [03-domain-model.md](03-domain-model.md)).
