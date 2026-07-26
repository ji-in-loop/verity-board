import { describe, expect, it } from 'vitest';
import type { CommitteeRecommendation } from '@verity-board/core';
import { JsonReporter } from '../src/json-reporter.js';
import { MarkdownReporter } from '../src/markdown-reporter.js';

const recommendation: CommitteeRecommendation = {
  committeeId: 'production-readiness',
  reviewCaseId: 'checkout-release-8.4',
  reviewCaseTitle: 'Checkout Platform Release 8.4',
  actorRecommendations: {
    'sre-reviewer': {
      actorId: 'sre-reviewer',
      actorDisplayName: 'Site Reliability Engineer',
      round: 1,
      findings: [
        {
          actorId: 'sre-reviewer',
          criterion: 'rollback',
          category: 'reliability.rollback_unverified',
          status: 'CONTRADICTED',
          severity: 'critical',
          explanation: 'Rollback validation failed in staging.',
          evidenceRefs: ['ev-0012'],
          requiredAction: 'Correct and rerun rollback validation.',
          confidence: 0.95,
          isInferred: false,
        },
      ],
      unknowns: [],
      clarificationQuestions: [],
      recommendation: 'NO_GO',
      confidence: 0.95,
    },
  },
  consolidatedBlockers: [
    {
      actorId: 'sre-reviewer',
      criterion: 'rollback',
      category: 'reliability.rollback_unverified',
      status: 'CONTRADICTED',
      severity: 'critical',
      explanation: 'Rollback validation failed in staging.',
      evidenceRefs: ['ev-0012'],
      requiredAction: 'Correct and rerun rollback validation.',
      confidence: 0.95,
      isInferred: false,
    },
  ],
  consolidatedRisks: [],
  missingEvidence: [
    {
      evidenceId: 'ev-0019',
      capability: 'testing.performance_results',
      subject: 'checkout-service',
      status: 'MISSING',
      summary: 'Dependent service load-testing result was not provided.',
      facts: {},
      provenance: { provider: 'local-file', sourceRef: 'n/a', retrievedAt: '2026-07-25T00:00:00Z' },
      freshness: { isStale: false },
      classification: 'internal',
    },
  ],
  disagreements: [],
  requiredActions: ['Correct and rerun rollback validation.'],
  policyEvaluation: {
    policyId: 'production-readiness-policy',
    ruleFired: '{"expr":"criticalBlockers.count > 0"}',
    outcome: 'NO_GO',
    reasoning: 'Rule matched.',
  },
  overallRecommendation: 'NO_GO',
  humanDecisionOwner: 'Release Director',
  audit: {
    startedAt: '2026-07-25T00:00:00Z',
    completedAt: '2026-07-25T00:00:01Z',
    evidenceFetched: ['ev-0012', 'ev-0019'],
    modelCallCount: 4,
    stoppingCondition: 'MANDATORY_BLOCKER_FOUND',
  },
};

describe('JsonReporter', () => {
  it('renders valid, parseable JSON containing the recommendation', () => {
    const rendered = new JsonReporter().render(recommendation);
    expect(JSON.parse(rendered)).toEqual(recommendation);
  });
});

describe('MarkdownReporter', () => {
  const rendered = new MarkdownReporter().render(recommendation);

  it('includes the case title, committee, and overall recommendation', () => {
    expect(rendered).toContain('Checkout Platform Release 8.4');
    expect(rendered).toContain('production-readiness');
    expect(rendered).toContain('NO_GO');
  });

  it('uses actor display names rather than raw ids', () => {
    expect(rendered).toContain('Site Reliability Engineer');
  });

  it('surfaces the critical blocker, missing evidence, required action, and human decision owner', () => {
    expect(rendered).toContain('Rollback validation failed in staging.');
    expect(rendered).toContain('Dependent service load-testing result was not provided.');
    expect(rendered).toContain('Correct and rerun rollback validation.');
    expect(rendered).toContain('Release Director');
  });

  it('never claims organizational authority — always marks itself as a recommendation, not a decision', () => {
    expect(rendered).toMatch(/recommendation, not a decision/i);
  });
});
