import { describe, expect, it } from 'vitest';
import { MockModelProvider } from '../src/mock-model-provider.js';
import type { ActorContext, ActorSkill } from '@verity-board/core';

const actor: ActorSkill = {
  id: 'sre-reviewer',
  version: 1,
  displayName: 'Site Reliability Engineer',
  description: '',
  mandate: [],
  criteria: ['rollback'],
  requiredCapabilities: [],
  allowedCapabilities: [],
  questionLimits: { maximumQuestions: 3, maximumEvidenceRequests: 5 },
  escalationRules: [],
  authority: { blockerCategories: ['rollback'] },
  outputSchema: 'actor-review.v1',
};

const context: ActorContext = {
  reviewCase: {
    id: 'case-1',
    title: 'Test',
    description: '',
    application: { id: 'checkout-service', name: 'Checkout' },
    riskClassification: 'high',
    submittedArtifacts: [],
    evidenceReferences: [],
    requestingTeam: 'team',
    humanDecisionOwner: 'owner',
    attributes: {},
  },
  evidence: [],
  mandate: [],
  criteria: ['rollback'],
  round: 1,
};

describe('MockModelProvider', () => {
  it('is deterministic: same actor + context in, same output out', async () => {
    const provider = new MockModelProvider({
      'sre-reviewer': () => ({ findings: [], recommendation: 'GO', confidence: 0.9 }),
    });
    const first = await provider.invokeActor({ actor, context });
    const second = await provider.invokeActor({ actor, context });
    expect(first).toEqual(second);
  });

  it('throws a clear error for an actor with no registered fixture', async () => {
    const provider = new MockModelProvider({});
    await expect(provider.invokeActor({ actor, context })).rejects.toThrow(/no fixture registered/);
  });

  it('can branch behavior on context.round for a two-round scenario', async () => {
    const provider = new MockModelProvider({
      'sre-reviewer': (ctx) => ({
        findings: [],
        recommendation: ctx.round === 1 ? 'ESCALATE' : 'GO',
        confidence: 0.8,
      }),
    });
    const round1 = (await provider.invokeActor({ actor, context: { ...context, round: 1 } })) as {
      recommendation: string;
    };
    const round2 = (await provider.invokeActor({ actor, context: { ...context, round: 2 } })) as {
      recommendation: string;
    };
    expect(round1.recommendation).toBe('ESCALATE');
    expect(round2.recommendation).toBe('GO');
  });
});
