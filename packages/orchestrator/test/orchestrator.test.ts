import { describe, expect, it } from 'vitest';
import { MockModelProvider, type MockFixtureFn } from '@verity-board/providers-model-mock';
import type { ActorSkill, Evidence, EvidenceProvider, EvidenceRequest } from '@verity-board/core';
import { runReview } from '../src/orchestrator.js';
import { UnknownActorError } from '../src/errors.js';
import { FakeEvidenceProvider, baseCommittee, basePolicy, baseReviewCase, evidence } from './helpers.js';

function actor(overrides: Partial<ActorSkill> & Pick<ActorSkill, 'id' | 'allowedCapabilities'>): ActorSkill {
  return {
    version: 1,
    displayName: overrides.id,
    description: '',
    mandate: [],
    criteria: ['generic'],
    requiredCapabilities: [],
    escalationRules: [],
    questionLimits: { maximumQuestions: 3, maximumEvidenceRequests: 5 },
    authority: { blockerCategories: [] },
    outputSchema: 'actor-review.v1',
    ...overrides,
  };
}

const actorA = actor({
  id: 'actor-a',
  allowedCapabilities: ['testing.*'],
  requiredCapabilities: ['testing.integration_results'],
  criteria: ['functional_testing'],
});
const actorB = actor({
  id: 'actor-b',
  allowedCapabilities: ['deployment.read'],
  requiredCapabilities: ['deployment.rollback_validation'],
  criteria: ['rollback'],
  authority: { blockerCategories: ['reliability', 'rollback'] },
});

describe('runReview: actor isolation', () => {
  it('never exposes one actor evidence outside its allowedCapabilities to another actor', async () => {
    const evidenceProvider = new FakeEvidenceProvider(
      new Map([
        ['testing.integration_results', evidence({ capability: 'testing.integration_results', status: 'VERIFIED' })],
        ['deployment.rollback_validation', evidence({ capability: 'deployment.rollback_validation', status: 'VERIFIED' })],
      ]),
    );

    const violations: string[] = [];
    const modelProvider = new MockModelProvider({
      'actor-a': (ctx) => {
        if (ctx.evidence.some((e) => e.capability.startsWith('deployment.'))) {
          violations.push('actor-a saw deployment evidence');
        }
        return { findings: [], recommendation: 'GO', confidence: 0.9 };
      },
      'actor-b': (ctx) => {
        if (ctx.evidence.some((e) => e.capability.startsWith('testing.'))) {
          violations.push('actor-b saw testing evidence');
        }
        return { findings: [], recommendation: 'GO', confidence: 0.9 };
      },
    });

    await runReview({
      reviewCase: baseReviewCase(),
      committee: baseCommittee(),
      actors: [actorA, actorB],
      policy: basePolicy(),
      evidenceProvider,
      modelProvider,
    });

    expect(violations).toEqual([]);
  });
});

describe('runReview: stopping conditions', () => {
  it('MANDATORY_BLOCKER_FOUND: stops after round 1 and skips clarification entirely', async () => {
    const evidenceProvider = new FakeEvidenceProvider(new Map());
    const modelProvider = new MockModelProvider({
      'actor-a': () => ({ findings: [], recommendation: 'GO', confidence: 0.9 }),
      'actor-b': () => ({
        findings: [
          {
            actorId: 'actor-b',
            criterion: 'rollback',
            category: 'reliability.rollback_unverified',
            status: 'CONTRADICTED',
            severity: 'critical',
            explanation: 'rollback failed',
            evidenceRefs: [],
            confidence: 0.95,
            isInferred: false,
          },
        ],
        recommendation: 'NO_GO',
        confidence: 0.95,
      }),
    });

    const result = await runReview({
      reviewCase: baseReviewCase(),
      committee: baseCommittee(),
      actors: [actorA, actorB],
      policy: basePolicy(),
      evidenceProvider,
      modelProvider,
    });

    expect(result.audit.stoppingCondition).toBe('MANDATORY_BLOCKER_FOUND');
    expect(result.audit.modelCallCount).toBe(2);
    expect(result.overallRecommendation).toBe('NO_GO');
  });

  it('ALL_ACTORS_FINAL: stops when no actor raises a clarification question', async () => {
    const evidenceProvider = new FakeEvidenceProvider(new Map());
    const modelProvider = new MockModelProvider({
      'actor-a': () => ({ findings: [], recommendation: 'GO', confidence: 0.9 }),
      'actor-b': () => ({ findings: [], recommendation: 'GO', confidence: 0.9 }),
    });

    const result = await runReview({
      reviewCase: baseReviewCase(),
      committee: baseCommittee(),
      actors: [actorA, actorB],
      policy: basePolicy(),
      evidenceProvider,
      modelProvider,
    });

    expect(result.audit.stoppingCondition).toBe('ALL_ACTORS_FINAL');
    expect(result.audit.modelCallCount).toBe(2);
  });

  it('NO_CLARIFICATION_ROUND_CONFIGURED: skips round 2 even with questions when the committee disables it', async () => {
    const evidenceProvider = new FakeEvidenceProvider(new Map());
    const modelProvider = new MockModelProvider({
      'actor-a': () => ({
        findings: [],
        recommendation: 'GO',
        confidence: 0.9,
        clarificationQuestions: [{ questionId: 'q1', actorId: 'actor-a', text: 'Anything else?' }],
      }),
      'actor-b': () => ({ findings: [], recommendation: 'GO', confidence: 0.9 }),
    });

    const result = await runReview({
      reviewCase: baseReviewCase(),
      committee: baseCommittee({
        execution: { ...baseCommittee().execution, maximumClarificationRounds: 0 },
      }),
      actors: [actorA, actorB],
      policy: basePolicy(),
      evidenceProvider,
      modelProvider,
    });

    expect(result.audit.stoppingCondition).toBe('NO_CLARIFICATION_ROUND_CONFIGURED');
    expect(result.audit.modelCallCount).toBe(2);
  });

  it('NO_NEW_EVIDENCE: runs no round 2 model calls when the clarification question resolves to nothing new', async () => {
    const evidenceProvider = new FakeEvidenceProvider(new Map());
    const modelProvider = new MockModelProvider({
      'actor-a': (ctx) => ({
        findings: [],
        recommendation: 'GO',
        confidence: 0.9,
        clarificationQuestions:
          ctx.round === 1
            ? [{ questionId: 'q1', actorId: 'actor-a', text: 'Was it load tested?', targetCapability: 'testing.performance_results' }]
            : [],
      }),
      'actor-b': () => ({ findings: [], recommendation: 'GO', confidence: 0.9 }),
    });

    const result = await runReview({
      reviewCase: baseReviewCase(),
      committee: baseCommittee(),
      actors: [actorA, actorB],
      policy: basePolicy(),
      evidenceProvider,
      modelProvider,
    });

    expect(result.audit.stoppingCondition).toBe('NO_NEW_EVIDENCE');
    expect(result.audit.modelCallCount).toBe(2);
  });

  it('CLARIFICATION_ROUND_COMPLETED: runs round 2 when a targeted question resolves real evidence', async () => {
    const evidenceProvider = new FakeEvidenceProvider(
      new Map([
        ['testing.performance_results', evidence({ capability: 'testing.performance_results', status: 'VERIFIED', summary: 'load test passed' })],
      ]),
    );
    const modelProvider = new MockModelProvider({
      'actor-a': (ctx) => ({
        findings: [],
        recommendation: 'GO',
        confidence: 0.9,
        clarificationQuestions:
          ctx.round === 1
            ? [{ questionId: 'q1', actorId: 'actor-a', text: 'Was it load tested?', targetCapability: 'testing.performance_results' }]
            : [],
      }),
      'actor-b': () => ({ findings: [], recommendation: 'GO', confidence: 0.9 }),
    });

    const result = await runReview({
      reviewCase: baseReviewCase(),
      committee: baseCommittee(),
      actors: [actorA, actorB],
      policy: basePolicy(),
      evidenceProvider,
      modelProvider,
    });

    expect(result.audit.stoppingCondition).toBe('CLARIFICATION_ROUND_COMPLETED');
    expect(result.audit.modelCallCount).toBe(4);
  });
});

describe('runReview: parallel execution determinism', () => {
  it('produces identical output across repeated runs (aside from timestamps)', async () => {
    const evidenceProvider = new FakeEvidenceProvider(new Map());
    const modelProvider = new MockModelProvider({
      'actor-a': () => ({ findings: [], recommendation: 'GO', confidence: 0.9 }),
      'actor-b': () => ({ findings: [], recommendation: 'GO', confidence: 0.9 }),
    });
    const input = {
      reviewCase: baseReviewCase(),
      committee: baseCommittee(),
      actors: [actorA, actorB],
      policy: basePolicy(),
      evidenceProvider,
      modelProvider,
    };

    const first = await runReview(input);
    const second = await runReview(input);

    // Mask every timestamp that's expected to differ between two real runs
    // a moment apart — audit start/end, and each MISSING/UNAVAILABLE
    // evidence record's own retrievedAt (the fake provider stamps a fresh
    // one on every resolve() call).
    const strip = (r: typeof first) => ({
      ...r,
      audit: { ...r.audit, startedAt: '', completedAt: '' },
      missingEvidence: r.missingEvidence.map((e) => ({
        ...e,
        provenance: { ...e.provenance, retrievedAt: '' },
      })),
    });
    expect(strip(first)).toEqual(strip(second));
  });
});

describe('runReview: partial and missing evidence', () => {
  it('never silently treats missing evidence as passing: falls through to the default outcome', async () => {
    const evidenceProvider = new FakeEvidenceProvider(new Map());
    const modelProvider = new MockModelProvider({
      'actor-a': () => ({ findings: [], recommendation: 'GO', confidence: 0.9 }),
      'actor-b': () => ({ findings: [], recommendation: 'GO', confidence: 0.9 }),
    });

    const result = await runReview({
      reviewCase: baseReviewCase(),
      committee: baseCommittee(),
      actors: [actorA, actorB],
      policy: basePolicy(),
      evidenceProvider,
      modelProvider,
    });

    expect(result.missingEvidence.length).toBeGreaterThan(0);
    expect(result.overallRecommendation).toBe('ESCALATE');
    expect(result.policyEvaluation.ruleFired).toBe('__no_rule_matched__');
  });
});

describe('runReview: actor output validation', () => {
  it('rejects malformed model output as a critical blocker instead of crashing or fabricating a pass', async () => {
    const evidenceProvider = new FakeEvidenceProvider(new Map());
    const modelProvider = new MockModelProvider({
      'actor-a': () => ({ findings: [], recommendation: 'GO', confidence: 0.9 }),
      // Missing required 'recommendation' field -> fails ActorReviewSchema validation.
      'actor-b': (() => ({ findings: [], confidence: 2 })) as unknown as MockFixtureFn,
    });

    const result = await runReview({
      reviewCase: baseReviewCase(),
      committee: baseCommittee(),
      actors: [actorA, actorB],
      policy: basePolicy(),
      evidenceProvider,
      modelProvider,
    });

    // A platform-integrity failure always forces ESCALATE, independent of
    // whether the policy's criticalBlockers list happens to include the
    // category — see ADR-0009 and platform-outcomes.ts.
    expect(result.overallRecommendation).toBe('ESCALATE');
    expect(result.consolidatedBlockers.some((f) => f.category === 'platform.actor_output_invalid')).toBe(true);
  });

  it('forces ESCALATE for malformed output even when the policy omits platform.actor_output_invalid from criticalBlockers (the exact production configuration)', async () => {
    const evidenceProvider = new FakeEvidenceProvider(new Map());
    const modelProvider = new MockModelProvider({
      'actor-a': () => ({ findings: [], recommendation: 'GO', confidence: 0.9 }),
      'actor-b': (() => ({ findings: [], confidence: 2 })) as unknown as MockFixtureFn,
    });

    // Deliberately mirrors the shipped catalog policy's criticalBlockers
    // list, which does NOT include 'platform.actor_output_invalid'. Before
    // ADR-0009's protected-category check, this scenario could reach GO.
    const productionLikePolicy = basePolicy({
      criticalBlockers: [
        'testing.mandatory_suite_failed',
        'reliability.rollback_unverified',
        'security.critical_finding',
        'ownership.production_owner_missing',
      ],
    });

    const result = await runReview({
      reviewCase: baseReviewCase(),
      committee: baseCommittee(),
      actors: [actorA, actorB],
      policy: productionLikePolicy,
      evidenceProvider,
      modelProvider,
    });

    expect(result.overallRecommendation).toBe('ESCALATE');
  });
});

describe('runReview: unknown actor references', () => {
  it('throws a clear error when the committee requires an actor not in the provided pool', async () => {
    const evidenceProvider = new FakeEvidenceProvider(new Map());
    const modelProvider = new MockModelProvider({});

    await expect(
      runReview({
        reviewCase: baseReviewCase(),
        committee: baseCommittee({ actors: { required: ['actor-z'], conditional: [] } }),
        actors: [actorA, actorB],
        policy: basePolicy(),
        evidenceProvider,
        modelProvider,
      }),
    ).rejects.toThrow(UnknownActorError);
  });
});

describe('runReview: conditional actor activation', () => {
  it('activates a conditional actor only when its rule matches the review case', async () => {
    const actorC = actor({ id: 'actor-c', allowedCapabilities: [] });
    const evidenceProvider = new FakeEvidenceProvider(new Map());
    const modelProvider = new MockModelProvider({
      'actor-a': () => ({ findings: [], recommendation: 'GO', confidence: 0.9 }),
      'actor-b': () => ({ findings: [], recommendation: 'GO', confidence: 0.9 }),
      'actor-c': () => ({ findings: [], recommendation: 'GO', confidence: 0.9 }),
    });

    const committee = baseCommittee({
      actors: {
        required: ['actor-a', 'actor-b'],
        conditional: [{ actor: 'actor-c', when: { expr: 'case.publicEndpoint == true' } }],
      },
    });

    const withoutFlag = await runReview({
      reviewCase: baseReviewCase({ attributes: {} }),
      committee,
      actors: [actorA, actorB, actorC],
      policy: basePolicy(),
      evidenceProvider,
      modelProvider,
    });
    expect(withoutFlag.actorRecommendations['actor-c']).toBeUndefined();

    const withFlag = await runReview({
      reviewCase: baseReviewCase({ attributes: { publicEndpoint: true } }),
      committee,
      actors: [actorA, actorB, actorC],
      policy: basePolicy(),
      evidenceProvider,
      modelProvider,
    });
    expect(withFlag.actorRecommendations['actor-c']).toBeDefined();
  });
});

describe('runReview: clarification round evidence merging', () => {
  /**
   * Simulates evidence that wasn't ready at the start of the review but
   * resolves by the time an actor specifically asks about it during
   * clarification — e.g. a load test that finishes mid-review, or evidence
   * a human attaches in response to the question. Round-1 collection for
   * this capability legitimately returns MISSING; a follow-up resolve()
   * for the same capability returns the real result.
   */
  class ResolvesOnSecondAskEvidenceProvider implements EvidenceProvider {
    readonly id = 'resolves-on-second-ask';
    private askCounts = new Map<string, number>();

    async resolve(request: EvidenceRequest): Promise<Evidence> {
      const count = (this.askCounts.get(request.capability) ?? 0) + 1;
      this.askCounts.set(request.capability, count);

      if (request.capability === 'testing.performance_results') {
        return count === 1
          ? evidence({ capability: request.capability, status: 'MISSING', summary: 'not yet available' })
          : evidence({
              capability: request.capability,
              status: 'VERIFIED',
              summary: 'load test completed after being asked about',
            });
      }
      return evidence({ capability: request.capability, status: 'VERIFIED', summary: 'ok' });
    }
  }

  it('merges clarification-round evidence so it changes the final policy outcome and appears in the report', async () => {
    const actorRequiringLoadTest: ActorSkill = {
      ...actorA,
      requiredCapabilities: [...actorA.requiredCapabilities, 'testing.performance_results'],
    };

    const evidenceProvider = new ResolvesOnSecondAskEvidenceProvider();
    const modelProvider = new MockModelProvider({
      'actor-a': (ctx) => {
        const loadTestEvidence = ctx.evidence.find((e) => e.capability === 'testing.performance_results');
        const stillMissing = !loadTestEvidence || loadTestEvidence.status === 'MISSING';
        return {
          findings: stillMissing
            ? [
                {
                  criterion: 'capacity',
                  status: 'MISSING',
                  severity: 'material',
                  explanation: 'Load test result not yet available.',
                  confidence: 0.6,
                  isInferred: true,
                },
              ]
            : [],
          recommendation: stillMissing ? 'CONDITIONAL_GO' : 'GO',
          confidence: 0.9,
          clarificationQuestions:
            ctx.round === 1 && stillMissing
              ? [{ questionId: 'q1', actorId: 'actor-a', text: 'Did the load test finish?', targetCapability: 'testing.performance_results' }]
              : [],
        };
      },
      'actor-b': () => ({ findings: [], recommendation: 'GO', confidence: 0.9 }),
    });

    const result = await runReview({
      reviewCase: baseReviewCase(),
      committee: baseCommittee(),
      actors: [actorRequiringLoadTest, actorB],
      policy: basePolicy(),
      evidenceProvider,
      modelProvider,
    });

    // Round 1 alone (material risk from the still-missing load test) would
    // have produced CONDITIONAL_GO. Clarification resolved it, the round-2
    // actor saw the merged evidence and dropped the finding, and the merged
    // evidence itself no longer counts as missing.
    expect(result.audit.stoppingCondition).toBe('CLARIFICATION_ROUND_COMPLETED');
    expect(result.overallRecommendation).toBe('GO');
    expect(result.missingEvidence.some((e) => e.capability === 'testing.performance_results')).toBe(false);
    expect(result.audit.evidenceFetched).toContain('ev-testing.performance_results');
  });
});
