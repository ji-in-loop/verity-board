import { describe, expect, it } from 'vitest';
import { OpenAiModelProvider } from '../src/openai-model-provider.js';
import type { ActorContext, ActorSkill } from '@verity-board/core';

/**
 * Gated behind an explicit opt-in env var — never runs in default CI. See
 * docs/phase-0/08-testing-strategy.md.
 */
const LIVE = process.env.VERITY_BOARD_LIVE_MODEL_TESTS === '1';

const actor: ActorSkill = {
  id: 'sre-reviewer',
  version: 1,
  displayName: 'Site Reliability Engineer',
  description: '',
  mandate: ['Assess operational readiness'],
  criteria: ['rollback'],
  requiredCapabilities: [],
  allowedCapabilities: [],
  questionLimits: { maximumQuestions: 3, maximumEvidenceRequests: 5 },
  escalationRules: [],
  authority: { blockerCategories: ['reliability'] },
  outputSchema: 'actor-review.v1',
};

const context: ActorContext = {
  reviewCase: {
    id: 'checkout-release-8.4',
    title: 'Checkout Platform Release 8.4',
    description: 'A routine release with a known rollback issue.',
    application: { id: 'checkout-service', name: 'Checkout Service' },
    riskClassification: 'high',
    submittedArtifacts: [],
    evidenceReferences: [],
    requestingTeam: 'checkout-team',
    humanDecisionOwner: 'Release Director',
    attributes: {},
  },
  evidence: [
    {
      evidenceId: 'ev-1',
      capability: 'deployment.rollback_validation',
      subject: 'checkout-service',
      status: 'CONTRADICTED',
      summary: 'Rollback validation failed in staging at the database migration reversal step.',
      facts: { succeeded: false },
      provenance: { provider: 'local-file', sourceRef: 'rollback-report.json', retrievedAt: '2026-07-25T00:00:00Z' },
      freshness: { isStale: false },
      classification: 'internal',
    },
  ],
  mandate: actor.mandate,
  criteria: actor.criteria,
  round: 1,
};

describe.skipIf(!LIVE)('OpenAiModelProvider (live)', () => {
  it('returns a tool-shaped response with findings and a recommendation', async () => {
    const provider = new OpenAiModelProvider();
    const raw = (await provider.invokeActor({ actor, context })) as {
      findings: unknown[];
      recommendation: string;
      confidence: number;
    };
    expect(Array.isArray(raw.findings)).toBe(true);
    expect(typeof raw.recommendation).toBe('string');
    expect(typeof raw.confidence).toBe('number');
  });
});
