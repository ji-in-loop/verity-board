import type { MockFixtureFn } from '@verity-board/providers-model-mock';

/**
 * Deterministic fixture responses for the bundled checkout-release example,
 * used when --model mock (the default). Keyed by actor id — see
 * docs/phase-0/08-testing-strategy.md: the README's documented example
 * output is itself a golden-file test of this fixture set.
 */
export const CHECKOUT_RELEASE_CASE_ID = 'checkout-release-8.4';

export const checkoutReleaseFixtures: Record<string, MockFixtureFn> = {
  'senior-engineering-lead': () => ({
    findings: [
      {
        criterion: 'functional_testing',
        status: 'VERIFIED',
        severity: 'info',
        explanation: 'All 482 unit tests passed.',
        evidenceRefs: [],
        confidence: 0.95,
        isInferred: false,
      },
      {
        criterion: 'integration_testing',
        status: 'VERIFIED',
        severity: 'info',
        explanation: 'All 96 integration tests passed, including the new payments-service lookup call.',
        evidenceRefs: [],
        confidence: 0.95,
        isInferred: false,
      },
      {
        criterion: 'code_ownership',
        status: 'VERIFIED',
        severity: 'info',
        explanation: 'Production owner and on-call rotation are assigned.',
        evidenceRefs: [],
        confidence: 0.9,
        isInferred: false,
      },
    ],
    recommendation: 'GO',
    confidence: 0.93,
  }),

  'sre-reviewer': () => ({
    findings: [
      {
        criterion: 'rollback',
        category: 'reliability.rollback_unverified',
        status: 'CONTRADICTED',
        severity: 'critical',
        explanation: 'Rollback validation failed in staging at the database migration reversal step.',
        evidenceRefs: [],
        requiredAction: 'Correct and rerun rollback validation.',
        confidence: 0.95,
        isInferred: false,
      },
      {
        criterion: 'availability',
        status: 'VERIFIED',
        severity: 'info',
        explanation: 'Error budget is within range and alerting is configured.',
        evidenceRefs: [],
        confidence: 0.9,
        isInferred: false,
      },
      {
        criterion: 'capacity',
        status: 'MISSING',
        severity: 'material',
        explanation:
          'Dependent service (payments-service) load-testing result was not provided; capacity under the new call pattern is unverified.',
        evidenceRefs: [],
        requiredAction: 'Attach dependent-service load-test evidence.',
        confidence: 0.6,
        isInferred: true,
      },
    ],
    recommendation: 'NO_GO',
    confidence: 0.92,
  }),

  'solution-architect': () => ({
    findings: [
      {
        criterion: 'design_alignment',
        status: 'VERIFIED',
        severity: 'info',
        explanation: 'No public API contract changes in this release.',
        evidenceRefs: [],
        confidence: 0.9,
        isInferred: false,
      },
      {
        criterion: 'cost_impact',
        category: 'cost.variance_unapproved',
        status: 'CONTRADICTED',
        severity: 'material',
        explanation: 'Monthly infrastructure cost increases by $1,100 and the variance is not yet approved.',
        evidenceRefs: [],
        requiredAction: 'Assign an owner to the infrastructure-cost variance.',
        confidence: 0.85,
        isInferred: false,
      },
    ],
    recommendation: 'CONDITIONAL_GO',
    confidence: 0.85,
  }),

  'product-manager': () => ({
    findings: [
      {
        criterion: 'acceptance_criteria',
        status: 'VERIFIED',
        severity: 'info',
        explanation: 'All stated acceptance criteria are met.',
        evidenceRefs: [],
        confidence: 0.9,
        isInferred: false,
      },
      {
        criterion: 'known_limitations',
        status: 'VERIFIED',
        severity: 'info',
        explanation: 'Single-card-per-customer limitation is documented and accepted as non-blocking.',
        evidenceRefs: [],
        confidence: 0.9,
        isInferred: false,
      },
    ],
    recommendation: 'GO',
    confidence: 0.9,
  }),
};
