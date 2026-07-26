import { describe, expect, it } from 'vitest';
import { EvidenceSchema } from '../src/schemas/evidence.js';
import { FindingSchema } from '../src/schemas/finding.js';
import { ActorSkillSchema } from '../src/schemas/actor-skill.js';
import { CommitteeSchema } from '../src/schemas/committee.js';
import { DecisionPolicySchema } from '../src/schemas/decision-policy.js';

describe('EvidenceSchema', () => {
  const valid = {
    evidenceId: 'ev-1',
    capability: 'testing.integration_results',
    subject: 'checkout-service',
    status: 'VERIFIED',
    summary: 'all integration tests passed',
    facts: { passed: 42, failed: 0 },
    provenance: {
      provider: 'local-file',
      sourceRef: 'integration-test-results.json',
      retrievedAt: '2026-07-25T00:00:00Z',
    },
    freshness: { isStale: false },
    classification: 'internal',
  };

  it('accepts a well-formed evidence record', () => {
    expect(EvidenceSchema.parse(valid)).toBeTruthy();
  });

  it('rejects an unknown status value', () => {
    expect(() => EvidenceSchema.parse({ ...valid, status: 'PROBABLY_FINE' })).toThrow();
  });

  it('rejects a missing provenance block', () => {
    const { provenance: _provenance, ...withoutProvenance } = valid;
    expect(() => EvidenceSchema.parse(withoutProvenance)).toThrow();
  });
});

describe('FindingSchema', () => {
  it('requires an explicit isInferred flag — no implicit factual claim', () => {
    const withoutFlag = {
      actorId: 'sre-reviewer',
      criterion: 'rollback',
      status: 'MISSING',
      severity: 'critical',
      explanation: 'no rollback evidence supplied',
      confidence: 0.4,
    };
    expect(() => FindingSchema.parse(withoutFlag)).toThrow();
  });

  it('rejects confidence outside 0..1', () => {
    expect(() =>
      FindingSchema.parse({
        actorId: 'sre-reviewer',
        criterion: 'rollback',
        status: 'VERIFIED',
        severity: 'info',
        explanation: 'ok',
        confidence: 1.5,
        isInferred: false,
      }),
    ).toThrow();
  });
});

describe('ActorSkillSchema', () => {
  const valid = {
    id: 'sre-reviewer',
    version: 1,
    displayName: 'Site Reliability Engineer',
    mandate: ['Assess operational readiness'],
    criteria: ['availability', 'rollback'],
    requiredCapabilities: ['deployment.rollback_validation'],
    allowedCapabilities: ['deployment.read'],
    questionLimits: { maximumQuestions: 3, maximumEvidenceRequests: 5 },
    authority: { blockerCategories: ['reliability', 'rollback'] },
    outputSchema: 'actor-review.v1',
  };

  it('accepts a well-formed actor skill', () => {
    expect(ActorSkillSchema.parse(valid)).toBeTruthy();
  });

  it('rejects an actor with zero criteria', () => {
    expect(() => ActorSkillSchema.parse({ ...valid, criteria: [] })).toThrow();
  });
});

describe('CommitteeSchema', () => {
  it('rejects humanApproval.required set to false — approval is structurally mandatory', () => {
    const committee = {
      id: 'production-readiness',
      version: 1,
      actors: { required: ['sre-reviewer'], conditional: [] },
      execution: {},
      decisionPolicy: 'production-readiness-policy',
      humanApproval: { required: false, decisionOwnerField: 'humanDecisionOwner' },
    };
    expect(() => CommitteeSchema.parse(committee)).toThrow();
  });

  it('accepts a conditional actor with a nested any/all activation rule', () => {
    const committee = {
      id: 'production-readiness',
      version: 1,
      actors: {
        required: ['sre-reviewer'],
        conditional: [
          {
            actor: 'security-architect',
            when: { any: [{ expr: "case.publicEndpoint == true" }, { expr: "case.dataClassification == 'restricted'" }] },
          },
        ],
      },
      execution: {},
      decisionPolicy: 'production-readiness-policy',
      humanApproval: { required: true, decisionOwnerField: 'humanDecisionOwner' },
    };
    expect(CommitteeSchema.parse(committee)).toBeTruthy();
  });
});

describe('DecisionPolicySchema', () => {
  it('requires at least one rule', () => {
    expect(() =>
      DecisionPolicySchema.parse({
        id: 'empty-policy',
        version: 1,
        criticalBlockers: [],
        rules: [],
      }),
    ).toThrow();
  });
});
