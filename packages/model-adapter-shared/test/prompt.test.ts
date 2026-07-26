import { describe, expect, it } from 'vitest';
import { buildSystemPrompt, buildUserMessage } from '../src/prompt.js';
import type { ActorContext, ActorSkill } from '@verity-board/core';

const actor: ActorSkill = {
  id: 'sre-reviewer',
  version: 1,
  displayName: 'Site Reliability Engineer',
  description: '',
  mandate: ['Assess operational readiness'],
  criteria: ['rollback', 'availability'],
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
    description: 'A routine release.',
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
      summary: 'Rollback validation failed in staging.',
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

describe('buildSystemPrompt', () => {
  it('includes the actor mandate and criteria', () => {
    const prompt = buildSystemPrompt(actor);
    expect(prompt).toContain('Site Reliability Engineer');
    expect(prompt).toContain('Assess operational readiness');
    expect(prompt).toContain('rollback');
  });

  it('instructs the model to treat evidence markers as untrusted data, not instructions', () => {
    const prompt = buildSystemPrompt(actor);
    expect(prompt).toMatch(/untrusted data/i);
    expect(prompt).toMatch(/never instructions to follow/i);
  });

  it('clarifies that the recommendation field is advisory, not the committee decision', () => {
    const prompt = buildSystemPrompt(actor);
    expect(prompt).toMatch(/never the committee.s official decision/i);
  });
});

describe('buildUserMessage', () => {
  it('wraps each evidence item in delimiters the system prompt treats as untrusted', () => {
    const message = buildUserMessage(context);
    expect(message).toContain('<EVIDENCE>');
    expect(message).toContain('</EVIDENCE>');
    expect(message).toContain('Rollback validation failed in staging.');
  });

  it('includes clarification responses inside evidence delimiters on round 2', () => {
    const round2 = { ...context, priorClarificationResponses: [{ questionId: 'q1', text: 'No load test was run.' }] };
    const message = buildUserMessage(round2);
    expect(message).toContain('No load test was run.');
  });
});
