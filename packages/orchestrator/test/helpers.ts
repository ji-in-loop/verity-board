import type { Committee, DecisionPolicy, Evidence, EvidenceProvider, EvidenceRequest, ReviewCase } from '@verity-board/core';

export class FakeEvidenceProvider implements EvidenceProvider {
  readonly id = 'fake';
  public readonly requestLog: EvidenceRequest[] = [];

  constructor(private readonly byCapability: Map<string, Evidence>) {}

  async resolve(request: EvidenceRequest): Promise<Evidence> {
    this.requestLog.push(request);
    const found = this.byCapability.get(request.capability);
    if (found) return found;
    return {
      evidenceId: `ev-missing-${request.capability}`,
      capability: request.capability,
      subject: request.subject,
      status: 'MISSING',
      summary: `No evidence supplied for ${request.capability}.`,
      facts: {},
      provenance: { provider: 'fake', sourceRef: 'n/a', retrievedAt: new Date().toISOString() },
      freshness: { isStale: false },
      classification: 'internal',
    };
  }
}

export function evidence(overrides: Partial<Evidence> & Pick<Evidence, 'capability' | 'status'>): Evidence {
  return {
    evidenceId: `ev-${overrides.capability}`,
    subject: 'checkout-service',
    summary: 'test evidence',
    facts: {},
    provenance: { provider: 'fake', sourceRef: 'n/a', retrievedAt: new Date().toISOString() },
    freshness: { isStale: false },
    classification: 'internal',
    ...overrides,
  };
}

export function baseReviewCase(overrides: Partial<ReviewCase> = {}): ReviewCase {
  return {
    id: 'checkout-release-8.4',
    title: 'Checkout Platform Release 8.4',
    description: '',
    application: { id: 'checkout-service', name: 'Checkout Service' },
    riskClassification: 'high',
    submittedArtifacts: [],
    evidenceReferences: [],
    requestingTeam: 'checkout-team',
    humanDecisionOwner: 'Release Director',
    attributes: {},
    ...overrides,
  };
}

export function baseCommittee(overrides: Partial<Committee> = {}): Committee {
  return {
    id: 'production-readiness',
    version: 1,
    actors: { required: ['actor-a', 'actor-b'], conditional: [] },
    execution: {
      mode: 'parallel',
      maximumReviewRounds: 2,
      maximumClarificationRounds: 1,
      maximumQuestionsPerActor: 3,
      maximumEvidenceRequests: 20,
      stopWhenNoNewEvidence: true,
      stopWhenMandatoryBlockerFound: true,
      stopWhenAllActorsFinal: true,
    },
    decisionPolicy: 'test-policy',
    humanApproval: { required: true, decisionOwnerField: 'humanDecisionOwner' },
    ...overrides,
  };
}

export function basePolicy(overrides: Partial<DecisionPolicy> = {}): DecisionPolicy {
  return {
    id: 'test-policy',
    version: 1,
    criticalBlockers: ['reliability.rollback_unverified', 'platform.actor_output_invalid'],
    rules: [
      { when: { expr: 'criticalBlockers.count > 0' }, result: 'NO_GO' },
      { when: { expr: 'disagreements.critical.count > 0' }, result: 'ESCALATE' },
      { when: { expr: 'materialRisks.count > 0' }, result: 'CONDITIONAL_GO' },
      {
        when: { all: [{ expr: 'criticalBlockers.count == 0' }, { expr: 'mandatoryEvidence.missing == 0' }] },
        result: 'GO',
      },
    ],
    defaultOutcome: 'ESCALATE',
    ...overrides,
  };
}
