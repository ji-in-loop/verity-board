import { describe, expect, it } from 'vitest';
import { EvidenceSchema } from '../src/schemas/evidence.js';
import { FindingSchema } from '../src/schemas/finding.js';
import { ActorSkillSchema } from '../src/schemas/actor-skill.js';
import { CommitteeSchema } from '../src/schemas/committee.js';
import { DecisionPolicySchema } from '../src/schemas/decision-policy.js';
import { ReviewCaseSchema } from '../src/schemas/review-case.js';
import { ActorReviewSchema, blockersOf, risksOf } from '../src/schemas/actor-review.js';
import { HumanApprovalSchema } from '../src/schemas/human-approval.js';
import { PlaybookSchema } from '../src/schemas/playbook.js';
import {
  CommitteeRecommendationSchema,
  DisagreementSchema,
  PolicyEvaluationSchema,
  AuditMetadataSchema,
} from '../src/schemas/recommendation.js';

describe('EvidenceSchema', () => {
  const valid = {
    evidenceId: 'ev-1',
    capability: 'testing.integration_results',
    subject: 'checkout-service',
    status: 'VERIFIED',
    summary: 'all integration tests passed',
    facts: { passed: 42, failed: 0 },
    provenance: {
      provider: 'local-file',
      sourceRef: 'integration-test-results.json',
      retrievedAt: '2026-07-25T00:00:00Z',
    },
    freshness: { isStale: false },
    classification: 'internal',
  };

  it('accepts a well-formed evidence record', () => {
    expect(EvidenceSchema.parse(valid)).toBeTruthy();
  });

  it('rejects an unknown status value', () => {
    expect(() => EvidenceSchema.parse({ ...valid, status: 'PROBABLY_FINE' })).toThrow();
  });

  it('rejects a missing provenance block', () => {
    const { provenance: _provenance, ...withoutProvenance } = valid;
    expect(() => EvidenceSchema.parse(withoutProvenance)).toThrow();
  });
});

describe('FindingSchema', () => {
  it('requires an explicit isInferred flag — no implicit factual claim', () => {
    const withoutFlag = {
      actorId: 'sre-reviewer',
      criterion: 'rollback',
      status: 'MISSING',
      severity: 'critical',
      explanation: 'no rollback evidence supplied',
      confidence: 0.4,
    };
    expect(() => FindingSchema.parse(withoutFlag)).toThrow();
  });

  it('rejects confidence outside 0..1', () => {
    expect(() =>
      FindingSchema.parse({
        actorId: 'sre-reviewer',
        criterion: 'rollback',
        status: 'VERIFIED',
        severity: 'info',
        explanation: 'ok',
        confidence: 1.5,
        isInferred: false,
      }),
    ).toThrow();
  });
});

describe('ActorSkillSchema', () => {
  const valid = {
    id: 'sre-reviewer',
    version: 1,
    displayName: 'Site Reliability Engineer',
    mandate: ['Assess operational readiness'],
    criteria: ['availability', 'rollback'],
    requiredCapabilities: ['deployment.rollback_validation'],
    allowedCapabilities: ['deployment.read'],
    questionLimits: { maximumQuestions: 3, maximumEvidenceRequests: 5 },
    authority: { blockerCategories: ['reliability', 'rollback'] },
    outputSchema: 'actor-review.v1',
  };

  it('accepts a well-formed actor skill', () => {
    expect(ActorSkillSchema.parse(valid)).toBeTruthy();
  });

  it('rejects an actor with zero criteria', () => {
    expect(() => ActorSkillSchema.parse({ ...valid, criteria: [] })).toThrow();
  });
});

describe('CommitteeSchema', () => {
  it('rejects humanApproval.required set to false — approval is structurally mandatory', () => {
    const committee = {
      id: 'production-readiness',
      version: 1,
      actors: { required: ['sre-reviewer'], conditional: [] },
      execution: {},
      decisionPolicy: 'production-readiness-policy',
      humanApproval: { required: false, decisionOwnerField: 'humanDecisionOwner' },
    };
    expect(() => CommitteeSchema.parse(committee)).toThrow();
  });

  it('accepts a conditional actor with a nested any/all activation rule', () => {
    const committee = {
      id: 'production-readiness',
      version: 1,
      actors: {
        required: ['sre-reviewer'],
        conditional: [
          {
            actor: 'security-architect',
            when: { any: [{ expr: "case.publicEndpoint == true" }, { expr: "case.dataClassification == 'restricted'" }] },
          },
        ],
      },
      execution: {},
      decisionPolicy: 'production-readiness-policy',
      humanApproval: { required: true, decisionOwnerField: 'humanDecisionOwner' },
    };
    expect(CommitteeSchema.parse(committee)).toBeTruthy();
  });
});

describe('DecisionPolicySchema', () => {
  it('requires at least one rule', () => {
    expect(() =>
      DecisionPolicySchema.parse({
        id: 'empty-policy',
        version: 1,
        criticalBlockers: [],
        rules: [],
      }),
    ).toThrow();
  });
});

describe('ReviewCaseSchema', () => {
  const valid = {
    id: 'checkout-release-8.4',
    title: 'Checkout Platform Release 8.4',
    application: { id: 'checkout-service', name: 'Checkout Service' },
    riskClassification: 'high',
    requestingTeam: 'Checkout Platform',
    humanDecisionOwner: 'Release Director',
  };

  it('accepts a well-formed review case and defaults the optional collections', () => {
    const parsed = ReviewCaseSchema.parse(valid);
    expect(parsed.description).toBe('');
    expect(parsed.submittedArtifacts).toEqual([]);
    expect(parsed.evidenceReferences).toEqual([]);
    expect(parsed.attributes).toEqual({});
  });

  it('accepts free-form attributes used by conditional-actor rules', () => {
    const parsed = ReviewCaseSchema.parse({
      ...valid,
      attributes: { publicEndpoint: true, dataClassification: 'restricted' },
    });
    expect(parsed.attributes).toEqual({ publicEndpoint: true, dataClassification: 'restricted' });
  });

  it('rejects an unknown riskClassification value', () => {
    expect(() => ReviewCaseSchema.parse({ ...valid, riskClassification: 'severe' })).toThrow();
  });

  it('rejects a missing humanDecisionOwner', () => {
    const { humanDecisionOwner: _humanDecisionOwner, ...withoutOwner } = valid;
    expect(() => ReviewCaseSchema.parse(withoutOwner)).toThrow();
  });

  it('rejects an application block missing its own id/name', () => {
    expect(() => ReviewCaseSchema.parse({ ...valid, application: { foo: 'bar' } })).toThrow();
  });
});

function finding(overrides: Record<string, unknown> = {}) {
  return {
    actorId: 'sre-reviewer',
    criterion: 'rollback',
    status: 'VERIFIED',
    severity: 'info',
    explanation: 'ok',
    confidence: 0.8,
    isInferred: false,
    ...overrides,
  };
}

describe('ActorReviewSchema', () => {
  const valid = {
    actorId: 'sre-reviewer',
    round: 1 as const,
    findings: [
      finding({ severity: 'critical', explanation: 'rollback unverified' }),
      finding({ severity: 'material', explanation: 'latency regression' }),
      finding({ severity: 'info', explanation: 'nit' }),
    ],
    recommendation: 'NO_GO',
    confidence: 0.9,
  };

  it('accepts a well-formed actor review', () => {
    expect(ActorReviewSchema.parse(valid)).toBeTruthy();
  });

  it('rejects a round outside 1..2', () => {
    expect(() => ActorReviewSchema.parse({ ...valid, round: 3 })).toThrow();
  });

  it('defaults unknowns and clarificationQuestions to empty arrays', () => {
    const parsed = ActorReviewSchema.parse(valid);
    expect(parsed.unknowns).toEqual([]);
    expect(parsed.clarificationQuestions).toEqual([]);
  });

  it('blockersOf returns only critical findings', () => {
    const review = ActorReviewSchema.parse(valid);
    expect(blockersOf(review)).toHaveLength(1);
    expect(blockersOf(review)[0].explanation).toBe('rollback unverified');
  });

  it('risksOf returns only material findings', () => {
    const review = ActorReviewSchema.parse(valid);
    expect(risksOf(review)).toHaveLength(1);
    expect(risksOf(review)[0].explanation).toBe('latency regression');
  });
});

describe('HumanApprovalSchema', () => {
  const valid = {
    reviewCaseId: 'checkout-release-8.4',
    decidedBy: 'Release Director',
    decidedAt: '2026-07-25T00:00:00Z',
    followedRecommendation: true,
    finalDecision: 'GO',
  };

  it('accepts a well-formed human approval record', () => {
    expect(HumanApprovalSchema.parse(valid)).toBeTruthy();
  });

  it('rejects a missing finalDecision', () => {
    const { finalDecision: _finalDecision, ...withoutDecision } = valid;
    expect(() => HumanApprovalSchema.parse(withoutDecision)).toThrow();
  });
});

describe('PlaybookSchema', () => {
  const valid = {
    id: 'production-readiness-playbook',
    version: 1,
    reviewTask: 'Assess whether this release is safe to ship.',
    applicableCommittees: ['production-readiness'],
    outcomeVocabulary: ['GO', 'NO_GO', 'CONDITIONAL_GO', 'ESCALATE'],
    decisionRules: 'See production-readiness-policy.',
  };

  it('accepts a well-formed playbook and defaults reportFormat to both formats', () => {
    const parsed = PlaybookSchema.parse(valid);
    expect(parsed.reportFormat).toEqual(['json', 'markdown']);
  });

  it('rejects a non-positive version', () => {
    expect(() => PlaybookSchema.parse({ ...valid, version: 0 })).toThrow();
  });

  it('rejects an empty applicableCommittees list', () => {
    expect(() => PlaybookSchema.parse({ ...valid, applicableCommittees: [] })).toThrow();
  });
});

describe('recommendation schemas', () => {
  const evidence = {
    evidenceId: 'ev-0019',
    capability: 'testing.performance_results',
    subject: 'checkout-service',
    status: 'MISSING' as const,
    summary: 'Load-testing result was not provided.',
    facts: {},
    provenance: { provider: 'local-file', sourceRef: 'n/a', retrievedAt: '2026-07-25T00:00:00Z' },
    freshness: { isStale: false },
    classification: 'internal' as const,
  };

  const policyEvaluation = {
    policyId: 'production-readiness-policy',
    ruleFired: '{"expr":"criticalBlockers.count > 0"}',
    outcome: 'NO_GO',
    reasoning: 'Rule matched.',
  };

  const audit = {
    startedAt: '2026-07-25T00:00:00Z',
    completedAt: '2026-07-25T00:00:01Z',
    modelCallCount: 4,
    stoppingCondition: 'MANDATORY_BLOCKER_FOUND',
  };

  it('PolicyEvaluationSchema accepts a well-formed evaluation', () => {
    expect(PolicyEvaluationSchema.parse(policyEvaluation)).toBeTruthy();
  });

  it('AuditMetadataSchema defaults evidenceFetched to an empty array', () => {
    expect(AuditMetadataSchema.parse(audit).evidenceFetched).toEqual([]);
  });

  it('DisagreementSchema accepts differing actor positions keyed by actor id', () => {
    const disagreement = {
      criterion: 'rollback',
      severity: 'critical' as const,
      actorPositions: { 'sre-reviewer': 'NO_GO', 'product-manager': 'GO' },
    };
    expect(DisagreementSchema.parse(disagreement)).toBeTruthy();
  });

  it('CommitteeRecommendationSchema accepts a full, well-formed recommendation', () => {
    const actorReview = {
      actorId: 'sre-reviewer',
      round: 1 as const,
      findings: [finding({ severity: 'critical' })],
      recommendation: 'NO_GO',
      confidence: 0.9,
    };

    const recommendation = {
      committeeId: 'production-readiness',
      reviewCaseId: 'checkout-release-8.4',
      reviewCaseTitle: 'Checkout Platform Release 8.4',
      actorRecommendations: { 'sre-reviewer': actorReview },
      consolidatedBlockers: [finding({ severity: 'critical' })],
      consolidatedRisks: [],
      missingEvidence: [evidence],
      disagreements: [],
      requiredActions: ['Correct and rerun rollback validation.'],
      policyEvaluation,
      overallRecommendation: 'NO_GO',
      humanDecisionOwner: 'Release Director',
      audit,
    };

    expect(CommitteeRecommendationSchema.parse(recommendation)).toBeTruthy();
  });

  it('CommitteeRecommendationSchema rejects a missing humanDecisionOwner', () => {
    const actorReview = {
      actorId: 'sre-reviewer',
      round: 1 as const,
      findings: [],
      recommendation: 'GO',
      confidence: 0.9,
    };

    expect(() =>
      CommitteeRecommendationSchema.parse({
        committeeId: 'production-readiness',
        reviewCaseId: 'checkout-release-8.4',
        reviewCaseTitle: 'Checkout Platform Release 8.4',
        actorRecommendations: { 'sre-reviewer': actorReview },
        consolidatedBlockers: [],
        consolidatedRisks: [],
        missingEvidence: [],
        disagreements: [],
        requiredActions: [],
        policyEvaluation,
        overallRecommendation: 'GO',
        audit,
      }),
    ).toThrow();
  });
});
