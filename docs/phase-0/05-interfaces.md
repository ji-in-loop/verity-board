# Core TypeScript Interface Proposals

These are **contracts, not implementation** — types and interfaces only, no
function bodies beyond the pure `PolicyEngine`/`ConsolidationEngine` shape
(whose actual rule evaluation logic is written in Version 0.1). Concrete
types would be derived from Zod schemas (`z.infer<typeof X>`); the shapes
below are written as plain TypeScript for readability in this document.

## 1. Evidence

```typescript
type EvidenceStatus =
  | "VERIFIED"
  | "CONTRADICTED"
  | "MISSING"
  | "STALE"
  | "NOT_APPLICABLE"
  | "INFERRED";

interface Evidence {
  evidenceId: string;
  capability: string;           // e.g. "testing.integration_results"
  subject: string;               // what the evidence is about, e.g. service id
  status: EvidenceStatus;
  summary: string;
  facts: Record<string, unknown>; // structured, capability-specific payload
  provenance: {
    provider: string;            // e.g. "local-file", "mcp:observability"
    sourceRef: string;            // file path / URL / tool call id
    retrievedAt: string;          // ISO 8601
  };
  freshness: {
    asOf?: string;                // when the underlying fact was true, if known
    isStale: boolean;
  };
  classification: "public" | "internal" | "confidential" | "restricted";
  integrity?: {
    checksum?: string;
    signed?: boolean;
  };
}
```

## 2. Finding

```typescript
interface Finding {
  actorId: string;
  criterion: string;             // e.g. "rollback"
  status: EvidenceStatus;
  severity: "info" | "minor" | "material" | "critical";
  explanation: string;
  evidenceRefs: string[];         // Evidence.evidenceId[]
  requiredAction?: string;
  confidence: number;             // 0..1
  isInferred: boolean;            // true if not directly grounded in evidence
}
```

## 3. ActorSkill

```typescript
interface QuestionLimits {
  maximumQuestions: number;
  maximumEvidenceRequests: number;
}

interface EscalationRule {
  when: string;                   // rule expression, see 09-adrs.md rule grammar
  category: string;                // e.g. "reliability", "security"
}

interface ActorAuthority {
  blockerCategories: string[];     // categories this actor can raise as blocking
}

interface ActorSkill {
  id: string;
  version: number;
  displayName: string;
  description: string;
  mandate: string[];
  criteria: string[];
  requiredCapabilities: string[];  // capabilities this actor needs to function
  allowedCapabilities: string[];   // superset patterns, e.g. "telemetry.*"
  questionLimits: QuestionLimits;
  escalationRules: EscalationRule[];
  authority: ActorAuthority;
  outputSchema: string;            // reference to a registered Zod schema id
}
```

## 4. Committee

```typescript
interface ConditionalActor {
  actor: string;                   // ActorSkill.id
  when: ActivationCondition;
}

type ActivationCondition =
  | { any: ActivationCondition[] }
  | { all: ActivationCondition[] }
  | { expr: string };               // e.g. "case.publicEndpoint == true"

interface ExecutionConfig {
  mode: "parallel" | "sequential";  // sequential reserved, unused in v0.1
  maximumReviewRounds: number;
  maximumClarificationRounds: number; // hard ceiling: 1 in v0.1
  maximumQuestionsPerActor: number;
  maximumEvidenceRequests: number;
  maximumModelCalls?: number;
  timeoutMs?: number;
  stopWhenNoNewEvidence: boolean;
  stopWhenMandatoryBlockerFound: boolean;
  stopWhenAllActorsFinal: boolean;
}

interface HumanApprovalConfig {
  required: true;                   // never false — structurally mandatory
  decisionOwnerField: string;        // path into ReviewCase, e.g. "humanDecisionOwner"
}

interface Committee {
  id: string;
  version: number;
  actors: {
    required: string[];             // ActorSkill.id[]
    conditional: ConditionalActor[];
  };
  execution: ExecutionConfig;
  decisionPolicy: string;            // DecisionPolicy.id
  humanApproval: HumanApprovalConfig;
}
```

## 5. Playbook

```typescript
interface Playbook {
  id: string;
  version: number;
  reviewTask: string;
  inputRequirements: string[];        // required ReviewCase / evidence fields
  applicableCommittees: string[];      // Committee.id[]
  outcomeVocabulary: string[];         // e.g. ["GO","CONDITIONAL_GO","NO_GO","ESCALATE"]
  mandatoryControls: string[];
  decisionRules: string;                // DecisionPolicy.id (or overridden per playbook)
  reportFormat: ("json" | "markdown")[];
}
```

## 6. ReviewCase

```typescript
interface ReviewCase {
  id: string;
  title: string;
  description: string;
  application: {
    id: string;
    name: string;
    [key: string]: unknown;           // service/application metadata, open-ended
  };
  riskClassification: "low" | "medium" | "high" | "critical";
  submittedArtifacts: string[];        // file paths relative to the case directory
  evidenceReferences: string[];
  requestingTeam: string;
  humanDecisionOwner: string;
}
```

## 7. ActorReview

```typescript
interface ClarificationQuestion {
  questionId: string;
  actorId: string;
  text: string;
  targetCapability?: string;
}

interface ActorReview {
  actorId: string;
  round: 1 | 2;
  findings: Finding[];
  blockers: Finding[];                  // subset of findings, severity == "critical"
  risks: Finding[];                      // subset, severity == "material"
  unknowns: string[];
  clarificationQuestions: ClarificationQuestion[];
  recommendation: string;                 // this actor's own vocabulary value —
                                           // advisory only, never the committee outcome
  confidence: number;
}
```

## 8. CommitteeRecommendation

```typescript
interface PolicyEvaluation {
  policyId: string;
  ruleFired: string;
  outcome: string;                        // from Playbook.outcomeVocabulary
  reasoning: string;
}

interface Disagreement {
  criterion: string;
  actorPositions: Record<string, string>; // actorId -> position
}

interface CommitteeRecommendation {
  committeeId: string;
  reviewCaseId: string;
  actorRecommendations: Record<string, ActorReview>;
  consolidatedBlockers: Finding[];
  consolidatedRisks: Finding[];
  missingEvidence: Evidence[];             // status === "MISSING"
  disagreements: Disagreement[];
  requiredActions: string[];
  policyEvaluation: PolicyEvaluation;
  overallRecommendation: string;
  humanDecisionOwner: string;
  audit: {
    startedAt: string;
    completedAt: string;
    evidenceFetched: string[];             // Evidence.evidenceId[]
    modelCallCount: number;
    stoppingCondition: string;
  };
}

// Deliberately NOT part of CommitteeRecommendation. No code path in this
// repository ever constructs or populates this type.
interface HumanApproval {
  reviewCaseId: string;
  decidedBy: string;
  decidedAt: string;
  followedRecommendation: boolean;
  finalDecision: string;
  notes?: string;
}
```

## 9. Ports

```typescript
interface ModelProvider {
  readonly id: string;
  invokeActor(input: {
    actor: ActorSkill;
    context: ActorContext;        // case + permitted evidence + mandate, etc.
  }): Promise<unknown>;            // raw output; caller validates against outputSchema
}

interface EvidenceProvider {
  readonly id: string;
  resolve(request: {
    capability: string;
    subject: string;
    reviewCase: ReviewCase;
  }): Promise<Evidence>;
}

interface Reporter {
  readonly format: "json" | "markdown";
  render(recommendation: CommitteeRecommendation): string;
}

interface PolicyEngine {
  evaluate(input: {
    policy: DecisionPolicy;
    actorReviews: ActorReview[];
    evidence: Evidence[];
  }): PolicyEvaluation;
}
```

`ActorContext` and `DecisionPolicy` are referenced above and defined in
[06-config-and-schema-examples.md](06-config-and-schema-examples.md); they're
omitted here to avoid duplicating the same shape twice.
