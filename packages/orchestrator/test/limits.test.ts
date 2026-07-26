import { describe, expect, it } from 'vitest';
import { MockModelProvider } from '@verity-board/providers-model-mock';
import type { ActorSkill } from '@verity-board/core';
import { runReview } from '../src/orchestrator.js';
import {
  EvidenceRequestLimitExceededError,
  ModelCallLimitExceededError,
  ReviewTimeoutError,
} from '../src/errors.js';
import { FakeEvidenceProvider, baseCommittee, basePolicy, baseReviewCase } from './helpers.js';

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
});
const actorB = actor({
  id: 'actor-b',
  allowedCapabilities: ['deployment.read'],
  requiredCapabilities: ['deployment.rollback_validation'],
});

describe('runReview: configurable limits', () => {
  it('rejects when the evidence plan exceeds maximumEvidenceRequests', async () => {
    const evidenceProvider = new FakeEvidenceProvider(new Map());
    const modelProvider = new MockModelProvider({});

    await expect(
      runReview({
        reviewCase: baseReviewCase(),
        committee: baseCommittee({ execution: { ...baseCommittee().execution, maximumEvidenceRequests: 1 } }),
        actors: [actorA, actorB],
        policy: basePolicy(),
        evidenceProvider,
        modelProvider,
      }),
    ).rejects.toThrow(EvidenceRequestLimitExceededError);
  });

  it('rejects when actor invocations exceed maximumModelCalls', async () => {
    const evidenceProvider = new FakeEvidenceProvider(new Map());
    const modelProvider = new MockModelProvider({
      'actor-a': () => ({ findings: [], recommendation: 'GO', confidence: 0.9 }),
      'actor-b': () => ({ findings: [], recommendation: 'GO', confidence: 0.9 }),
    });

    await expect(
      runReview({
        reviewCase: baseReviewCase(),
        committee: baseCommittee({ execution: { ...baseCommittee().execution, maximumModelCalls: 1 } }),
        actors: [actorA, actorB],
        policy: basePolicy(),
        evidenceProvider,
        modelProvider,
      }),
    ).rejects.toThrow(ModelCallLimitExceededError);
  });

  it('rejects when the review exceeds timeoutMs', async () => {
    const evidenceProvider = new FakeEvidenceProvider(new Map());
    const modelProvider = new MockModelProvider({
      'actor-a': () => new Promise((resolve) => setTimeout(() => resolve({ findings: [], recommendation: 'GO', confidence: 0.9 }), 200)),
      'actor-b': () => ({ findings: [], recommendation: 'GO', confidence: 0.9 }),
    });

    await expect(
      runReview({
        reviewCase: baseReviewCase(),
        committee: baseCommittee({ execution: { ...baseCommittee().execution, timeoutMs: 20 } }),
        actors: [actorA, actorB],
        policy: basePolicy(),
        evidenceProvider,
        modelProvider,
      }),
    ).rejects.toThrow(ReviewTimeoutError);
  });
});
