import { describe, expect, it } from 'vitest';
import { evaluatePolicy } from '../src/policy/policy-engine.js';
import type { DecisionPolicy } from '../src/schemas/decision-policy.js';
import type { ActorReview } from '../src/schemas/actor-review.js';
import type { Finding } from '../src/schemas/finding.js';

const policy: DecisionPolicy = {
  id: 'production-readiness-policy',
  version: 1,
  criticalBlockers: [
    'testing.mandatory_suite_failed',
    'reliability.rollback_unverified',
    'security.critical_finding',
    'ownership.production_owner_missing',
  ],
  rules: [
    { when: { expr: 'criticalBlockers.count > 0' }, result: 'NO_GO' },
    { when: { expr: 'disagreements.critical.count > 0' }, result: 'ESCALATE' },
    { when: { expr: 'materialRisks.count > 0' }, result: 'CONDITIONAL_GO' },
    {
      when: {
        all: [
          { expr: 'criticalBlockers.count == 0' },
          { expr: 'mandatoryEvidence.missing == 0' },
        ],
      },
      result: 'GO',
    },
  ],
  defaultOutcome: 'ESCALATE',
};

function finding(overrides: Partial<Finding>): Finding {
  return {
    actorId: 'sre-reviewer',
    criterion: 'rollback',
    status: 'CONTRADICTED',
    severity: 'critical',
    explanation: 'test finding',
    evidenceRefs: [],
    confidence: 0.9,
    isInferred: false,
    ...overrides,
  };
}

function review(overrides: Partial<ActorReview>): ActorReview {
  return {
    actorId: 'sre-reviewer',
    round: 1,
    findings: [],
    unknowns: [],
    clarificationQuestions: [],
    recommendation: 'GO',
    confidence: 0.9,
    ...overrides,
  };
}

describe('evaluatePolicy', () => {
  it('is not cancelled by other actors recommending approval: a single critical blocker forces NO_GO', () => {
    const sreCriticalRollback = review({
      actorId: 'sre-reviewer',
      recommendation: 'NO_GO',
      findings: [finding({ category: 'reliability.rollback_unverified', severity: 'critical' })],
    });
    const threeApprovals = ['senior-engineering-lead', 'product-manager', 'solution-architect'].map(
      (actorId) => review({ actorId, recommendation: 'GO', findings: [] }),
    );

    const result = evaluatePolicy({
      policy,
      actorReviews: [sreCriticalRollback, ...threeApprovals],
      evidence: [],
      disagreements: [],
    });

    expect(result.outcome).toBe('NO_GO');
  });

  it('escalates on a critical disagreement even with zero critical blockers', () => {
    const result = evaluatePolicy({
      policy,
      actorReviews: [],
      evidence: [],
      disagreements: [
        { criterion: 'scalability', severity: 'critical', actorPositions: { a: 'x', b: 'y' } },
      ],
    });
    expect(result.outcome).toBe('ESCALATE');
  });

  it('returns CONDITIONAL_GO when only material risks are present', () => {
    const result = evaluatePolicy({
      policy,
      actorReviews: [
        review({ findings: [finding({ severity: 'material', category: undefined })] }),
      ],
      evidence: [],
      disagreements: [],
    });
    expect(result.outcome).toBe('CONDITIONAL_GO');
  });

  it('returns GO when there are no blockers, risks, disagreements, or missing evidence', () => {
    const result = evaluatePolicy({
      policy,
      actorReviews: [review({ findings: [] })],
      evidence: [],
      disagreements: [],
    });
    expect(result.outcome).toBe('GO');
  });

  it('does not silently return GO when missing evidence exists and no rule explicitly matches', () => {
    const noMandatoryEvidenceRule: DecisionPolicy = {
      ...policy,
      rules: [
        {
          when: { expr: 'mandatoryEvidence.missing == 0' },
          result: 'GO',
        },
      ],
    };
    const result = evaluatePolicy({
      policy: noMandatoryEvidenceRule,
      actorReviews: [],
      evidence: [
        {
          evidenceId: 'ev-1',
          capability: 'testing.performance_results',
          subject: 'payments-service',
          status: 'MISSING',
          summary: 'not provided',
          facts: {},
          provenance: { provider: 'local-file', sourceRef: 'n/a', retrievedAt: new Date().toISOString() },
          freshness: { isStale: false },
          classification: 'internal',
        },
      ],
      disagreements: [],
    });
    expect(result.outcome).toBe('ESCALATE');
    expect(result.ruleFired).toBe('__no_rule_matched__');
  });

  it('ignores a critical finding without a category in the policy criticalBlockers list', () => {
    const result = evaluatePolicy({
      policy,
      actorReviews: [
        review({ findings: [finding({ severity: 'critical', category: 'uncategorized.thing' })] }),
      ],
      evidence: [],
      disagreements: [],
    });
    expect(result.outcome).toBe('GO');
  });
});
