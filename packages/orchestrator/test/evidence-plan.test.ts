import { describe, expect, it } from 'vitest';
import type { EvidenceProvider, EvidenceRequest, Evidence } from '@verity-board/core';
import { collectEvidence, mergeEvidence } from '../src/evidence-plan.js';
import { baseReviewCase, evidence } from './helpers.js';

class PartiallyFailingEvidenceProvider implements EvidenceProvider {
  readonly id = 'partially-failing';
  constructor(private readonly failingCapabilities: Set<string>) {}

  async resolve(request: EvidenceRequest): Promise<Evidence> {
    if (this.failingCapabilities.has(request.capability)) {
      throw new Error(`simulated provider failure for ${request.capability}`);
    }
    return evidence({ capability: request.capability, status: 'VERIFIED', summary: 'ok' });
  }
}

describe('collectEvidence', () => {
  it('does not crash the whole review when one provider call rejects — converts it to UNAVAILABLE', async () => {
    const provider = new PartiallyFailingEvidenceProvider(new Set(['deployment.rollback_validation']));
    const results = await collectEvidence(
      ['testing.integration_results', 'deployment.rollback_validation'],
      baseReviewCase(),
      provider,
      20,
    );

    expect(results).toHaveLength(2);
    const ok = results.find((e) => e.capability === 'testing.integration_results');
    const failed = results.find((e) => e.capability === 'deployment.rollback_validation');
    expect(ok?.status).toBe('VERIFIED');
    expect(failed?.status).toBe('UNAVAILABLE');
    expect(failed?.summary).toMatch(/simulated provider failure/);
  });

  it('collects everything normally when no provider call fails', async () => {
    const provider = new PartiallyFailingEvidenceProvider(new Set());
    const results = await collectEvidence(['a.capability', 'b.capability'], baseReviewCase(), provider, 20);
    expect(results.every((e) => e.status === 'VERIFIED')).toBe(true);
  });
});

describe('mergeEvidence', () => {
  it('supersedes a base record with a newer resolution for the same capability and subject', () => {
    const base = [evidence({ capability: 'testing.performance_results', status: 'MISSING', summary: 'not provided' })];
    const updates = [evidence({ capability: 'testing.performance_results', status: 'VERIFIED', summary: 'load test passed' })];

    const merged = mergeEvidence(base, updates);
    expect(merged).toHaveLength(1);
    expect(merged[0].status).toBe('VERIFIED');
    expect(merged[0].summary).toBe('load test passed');
  });

  it('appends a genuinely new capability rather than dropping it', () => {
    const base = [evidence({ capability: 'testing.integration_results', status: 'VERIFIED' })];
    const updates = [evidence({ capability: 'testing.performance_results', status: 'VERIFIED' })];

    const merged = mergeEvidence(base, updates);
    expect(merged).toHaveLength(2);
    expect(merged.map((e) => e.capability).sort()).toEqual(['testing.integration_results', 'testing.performance_results']);
  });

  it('leaves unrelated base evidence untouched', () => {
    const base = [
      evidence({ capability: 'a.cap', status: 'VERIFIED', summary: 'unchanged' }),
      evidence({ capability: 'b.cap', status: 'MISSING' }),
    ];
    const updates = [evidence({ capability: 'b.cap', status: 'VERIFIED', summary: 'now resolved' })];

    const merged = mergeEvidence(base, updates);
    expect(merged.find((e) => e.capability === 'a.cap')?.summary).toBe('unchanged');
    expect(merged.find((e) => e.capability === 'b.cap')?.summary).toBe('now resolved');
  });
});
