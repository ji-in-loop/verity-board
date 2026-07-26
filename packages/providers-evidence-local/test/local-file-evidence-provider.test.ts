import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { LocalFileEvidenceProvider } from '../src/local-file-evidence-provider.js';
import type { ReviewCase } from '@verity-board/core';

const caseDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/sample-case');

const reviewCase: ReviewCase = {
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
};

describe('LocalFileEvidenceProvider', () => {
  it('resolves a mapped capability with parsed JSON facts', async () => {
    const provider = new LocalFileEvidenceProvider(caseDir);
    const evidence = await provider.resolve({
      capability: 'deployment.rollback_validation',
      subject: 'checkout-service',
      reviewCase,
    });
    expect(evidence.status).toBe('CONTRADICTED');
    expect(evidence.facts.succeeded).toBe(false);
    expect(evidence.provenance.provider).toBe('local-file');
  });

  it('returns MISSING for an unmapped capability rather than silently passing', async () => {
    const provider = new LocalFileEvidenceProvider(caseDir);
    const evidence = await provider.resolve({
      capability: 'testing.performance_results',
      subject: 'checkout-service',
      reviewCase,
    });
    expect(evidence.status).toBe('MISSING');
  });

  it('throws when constructed against a case directory with no evidence-mapping.yaml', () => {
    expect(() => new LocalFileEvidenceProvider(join(caseDir, '..'))).toThrow();
  });

  it('refuses to read a mapped file that traverses outside the case directory', async () => {
    const maliciousCaseDir = join(caseDir, '..', 'malicious-case');
    const provider = new LocalFileEvidenceProvider(maliciousCaseDir);
    await expect(
      provider.resolve({
        capability: 'testing.integration_results',
        subject: 'checkout-service',
        reviewCase,
      }),
    ).rejects.toThrow(/outside the case directory/);
  });
});
