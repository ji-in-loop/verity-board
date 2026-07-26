# Versioned Roadmap

Each release gate requires explicit human approval before the next phase
begins. No phase's implementation starts early.

| Phase | Goal | Status |
|---|---|---|
| **Phase 0** | Product requirements, domain model, architecture, contracts, security assessment, testing strategy, ADRs, roadmap, open questions. No implementation code. | **Complete and approved 2026-07-25.** |
| **v0.1** | Core platform + Production Readiness reference implementation: 4 built-in actors, YAML actor/committee/playbook definitions, local evidence provider, mock + optional Anthropic model providers, parallel execution, one clarification round, deterministic policy engine, JSON + Markdown reports, CLI, fully runnable example. | **Complete 2026-07-25.** 8 packages, 63 tests (1 live-model test gated and skipped by default), lint/typecheck/build all clean. Awaiting review before v0.2. |
| **v0.2** | ADR Review example project (Solution Architect, Engineering Manager, conditional Security Architect) on the *same, unmodified* core/orchestrator — the first proof that the platform generalizes. | Not started — blocked on v0.1 completion and approval. |
| **v0.3** | Peak Readiness example project — dynamic committees, conditional actor activation (Data Engineering Manager, Security Architect, Systems Architect), time-sensitive evidence — again on the unmodified core. | Not started — blocked on v0.2 completion and approval. |
| **v0.4** | Optional MCP evidence providers via a provider-neutral evidence gateway (capability → MCP tool mapping, read-only allowlists, redaction, provenance). Only begins if v0.1–v0.3 demonstrate genuine reuse without core changes. | Not started — gated on v0.1–v0.3 approval, not just completion. |
| **v1.0** | Hardening: GitHub Action, signed policy packs, org-level config inheritance, audit logs, policy waivers, multiple model adapters, secret-provider integration, prompt-injection test suite expansion, contribution model. Scope to be re-evaluated based on real usage, not assumed wholesale. | Not started — requires real user validation of earlier releases first. |

## Gate discipline

At the end of each phase, the working protocol (product vision §15) is
followed exactly: restate goal, inspect repo, present plan, name
assumptions/risks, implement only the approved phase, run all tests,
demonstrate the primary user journey, update docs, summarize files changed /
decisions made / commands run / test results / known limitations / deferred
work, then **stop** for approval. No phase's scope creeps into the next
without that explicit stop.
