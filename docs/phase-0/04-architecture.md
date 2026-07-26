# Architecture

## 1. Shape: hexagonal core, thin adapters, one orchestrator

The architecture is deliberately boring: a pure domain core, a small set of
port interfaces, one or two adapters per port, one orchestrator that wires
them together, and a thin CLI. There is no distributed runtime, no message
bus, no plugin loader. Extensibility comes from adding new adapters and new
YAML config, not from adding new architectural mechanisms.

```
                            ┌─────────────────────┐
                            │         CLI          │
                            │  verity-board review  │
                            └──────────┬───────────┘
                                       │
                                       ▼
                        ┌──────────────────────────────┐
                        │        Orchestrator            │
                        │        ("the Chair")           │
                        │  - selects committee            │
                        │  - builds evidence plan         │
                        │  - runs actor invocations        │
                        │    in parallel                  │
                        │  - consolidates questions        │
                        │  - enforces stopping conditions   │
                        │  - invokes the policy engine       │
                        └───┬─────────┬─────────┬─────────┘
                            │         │         │
              ┌─────────────┘         │         └─────────────┐
              ▼                       ▼                       ▼
   ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐
   │  EvidenceProvider    │  │   ModelProvider      │  │     Reporter         │
   │  (port)               │  │   (port)              │  │     (port)           │
   ├────────────────────┤  ├────────────────────┤  ├────────────────────┤
   │ LocalFileEvidence      │  │ MockModelProvider      │  │ JsonReporter           │
   │ Provider (v0.1)        │  │ (default, deterministic)│  │ MarkdownReporter       │
   │                        │  │ AnthropicModelProvider  │  │                        │
   │ [future: MCP Evidence  │  │ (optional, isolated)    │  │                        │
   │  Gateway — v0.4]       │  │                          │  │                        │
   └────────────────────┘  └────────────────────┘  └────────────────────┘

                        ┌──────────────────────────────┐
                        │       Core domain (pure)       │
                        │  - contracts/schemas (Zod)      │
                        │  - PolicyEngine (pure fn)        │
                        │  - consolidation / dedup logic    │
                        │  - actor & committee registries    │
                        │    (config-shape, no I/O)          │
                        └──────────────────────────────┘
```

The Orchestrator depends only on the port interfaces and the core domain
types — never on a concrete provider. Concrete providers depend on the core
domain types but never on each other or on the Orchestrator. This is what
makes "provider-neutral" a testable property rather than an aspiration: if
`packages/core` or `packages/orchestrator` ever import from
`@verity-board/providers-model-anthropic`, that's an architecture violation
an ESLint import-boundary rule can catch mechanically.

## 2. Package boundaries (pnpm workspace)

| Package | Depends on | Responsibility |
|---|---|---|
| `packages/core` | nothing internal | Domain contracts (Zod schemas + inferred types), pure `PolicyEngine`, consolidation/dedup logic, port interface definitions (`ModelProvider`, `EvidenceProvider`, `Reporter`, registries). Zero I/O. |
| `packages/config` | `core` | YAML loading + validation for actor/committee/playbook definitions into core types. |
| `packages/orchestrator` | `core`, `config` | The Chair: execution engine, evidence-plan builder, stopping-condition enforcement, clarification consolidation. Depends only on port *interfaces*, never on concrete providers. |
| `packages/providers-evidence-local` | `core` | Local file evidence provider — reads a case directory, maps files to capabilities, returns canonical `Evidence`. |
| `packages/providers-model-mock` | `core` | Deterministic mock model provider. Default for all tests and the bundled example; requires no network or API key. |
| `packages/providers-model-anthropic` | `core` | Optional Anthropic adapter. The only package permitted to depend on `@anthropic-ai/sdk`. Never imported by `core` or `orchestrator` directly — wired in only at the CLI's composition point. |
| `packages/reporters` | `core` | JSON and Markdown reporters. |
| `packages/cli` | all of the above | `verity-board` binary: parses args, loads config, composes the chosen providers, invokes the orchestrator, writes reports. The only package where every port has a concrete implementation chosen. |
| `examples/production-readiness/checkout-release` | none (data only) | Fixture case: YAML/JSON/Markdown inputs, no code. |

No package other than `packages/cli` is allowed to choose *which* concrete
adapter runs — that composition decision lives in exactly one place, which is
what "supports future MCP providers without requiring MCP in v0.1" means in
practice: v0.4 adds `packages/providers-evidence-mcp` and one new line in the
CLI's composition switch, and nothing else changes.

## 3. Why not simpler (single package) or more complex (services)

- **Not a single package:** the required test in the PRD — "adding an actor
  or committee never requires editing core or orchestrator" — is only
  actually enforced if provider code is physically incapable of being
  imported from core/orchestrator. A single package makes that a convention
  to remember, not a boundary to enforce.
- **Not services/microservices:** every port has exactly one process-local
  implementation in v0.1–v0.3. There is no reason yet to pay for network
  boundaries, serialization, or deployment topology. Section 14 of the
  product vision (anti-overengineering) rules this out explicitly, and
  nothing about the v0.1–v0.3 scope needs it.

## 4. Execution model recap (implementation detail, not new architecture)

The Orchestrator's 11-step flow (validate → select committee → build
evidence plan → collect evidence → parallel actor reviews → consolidate
questions → one clarification round → final actor assessments → policy
engine → generate report → stop for human approval) is a sequence *within*
the Orchestrator package — it is not eleven services or eleven agents talking
to each other. Actor invocations are parallel *calls*, not parallel
*conversations*; actors never see each other's output before the
consolidation step, and never communicate directly at all (see
[ADR-0005](09-adrs.md#adr-0005)).
