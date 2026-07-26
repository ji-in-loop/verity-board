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

  it('treats UNAVAILABLE evidence (a provider failure) the same as MISSING — never a silent pass', () => {
    const result = evaluatePolicy({
      policy,
      actorReviews: [],
      evidence: [
        {
          evidenceId: 'ev-1',
          capability: 'deployment.rollback_validation',
          subject: 'checkout-service',
          status: 'UNAVAILABLE',
          summary: 'evidence provider threw while resolving this capability',
          facts: {},
          provenance: { provider: 'local-file', sourceRef: 'n/a', retrievedAt: new Date().toISOString() },
          freshness: { isStale: false },
          classification: 'internal',
        },
      ],
      disagreements: [],
    });
    expect(result.outcome).not.toBe('GO');
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

  describe('platform-protected categories (see platform-outcomes.ts / ADR-0009)', () => {
    it('forces ESCALATE for a platform.actor_output_invalid finding even though it is absent from criticalBlockers, and even when every other fact would otherwise produce GO', () => {
      // This mirrors the exact production configuration: the shipped
      // catalog policy's criticalBlockers list does NOT include
      // 'platform.actor_output_invalid'. Before this fix, that meant a
      // malformed actor response could reach GO. It must not.
      expect(policy.criticalBlockers).not.toContain('platform.actor_output_invalid');

      const result = evaluatePolicy({
        policy,
        actorReviews: [
          review({ findings: [finding({ severity: 'critical', category: 'platform.actor_output_invalid' })] }),
        ],
        evidence: [],
        disagreements: [],
      });

      expect(result.outcome).toBe('ESCALATE');
      expect(result.ruleFired).toBe('__platform_protected_escalation__');
    });

    it('forces ESCALATE for every protected category, regardless of the configured policy', () => {
      const protectedCategories = [
        'platform.actor_output_invalid',
        'platform.model_call_failed',
        'platform.required_actor_missing',
        'platform.evidence_provider_failed',
        'platform.policy_evaluation_failed',
      ];

      for (const category of protectedCategories) {
        const result = evaluatePolicy({
          policy,
          actorReviews: [review({ findings: [finding({ severity: 'critical', category })] })],
          evidence: [],
          disagreements: [],
        });
        expect(result.outcome, `category ${category} should force ESCALATE`).toBe('ESCALATE');
      }
    });

    it('does not force ESCALATE for a platform-prefixed category at non-critical severity', () => {
      const result = evaluatePolicy({
        policy,
        actorReviews: [
          review({ findings: [finding({ severity: 'material', category: 'platform.actor_output_invalid' })] }),
        ],
        evidence: [],
        disagreements: [],
      });
      expect(result.outcome).toBe('CONDITIONAL_GO');
    });

    it('takes priority over a configured rule that would otherwise return NO_GO', () => {
      const result = evaluatePolicy({
        policy,
        actorReviews: [
          review({
            findings: [
              finding({ severity: 'critical', category: 'reliability.rollback_unverified' }),
              finding({ severity: 'critical', category: 'platform.model_call_failed' }),
            ],
          }),
        ],
        evidence: [],
        disagreements: [],
      });
      // Both a real business blocker and a platform failure are present;
      // ESCALATE (routing to a human) is the safer outcome than an
      // automated NO_GO when the platform itself couldn't be trusted.
      expect(result.outcome).toBe('ESCALATE');
      expect(result.ruleFired).toBe('__platform_protected_escalation__');
    });
  });
});
