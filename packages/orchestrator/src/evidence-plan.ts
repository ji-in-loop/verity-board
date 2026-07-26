import type { ActorSkill, Evidence, EvidenceProvider, ReviewCase } from '@verity-board/core';
import { EvidenceRequestLimitExceededError } from './errors.js';

export function buildEvidencePlan(actors: ActorSkill[]): string[] {
  const capabilities = new Set<string>();
  for (const actor of actors) {
    for (const capability of actor.requiredCapabilities) {
      capabilities.add(capability);
    }
  }
  return [...capabilities];
}

function unavailableEvidence(capability: string, subject: string, reason: unknown): Evidence {
  return {
    evidenceId: `ev-unavailable-${capability}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    capability,
    subject,
    status: 'UNAVAILABLE',
    summary: `The evidence provider failed while resolving "${capability}": ${String(reason)}`,
    facts: {},
    provenance: { provider: 'unknown', sourceRef: 'n/a', retrievedAt: new Date().toISOString() },
    freshness: { isStale: false },
    classification: 'internal',
  };
}

/**
 * Partial evidence-provider failure is normal for an enterprise committee —
 * one source being down must not crash the whole review. A rejected
 * resolution becomes a structured UNAVAILABLE record (treated the same as
 * MISSING by the policy engine — see policy-engine.ts) instead of an
 * uncaught exception.
 */
export async function collectEvidence(
  capabilities: string[],
  reviewCase: ReviewCase,
  evidenceProvider: EvidenceProvider,
  maximumEvidenceRequests: number,
  signal?: AbortSignal,
): Promise<Evidence[]> {
  if (capabilities.length > maximumEvidenceRequests) {
    throw new EvidenceRequestLimitExceededError(
      `Evidence plan requires ${capabilities.length} requests, exceeding the committee's ` +
        `maximumEvidenceRequests limit of ${maximumEvidenceRequests}.`,
    );
  }

  const settled = await Promise.allSettled(
    capabilities.map((capability) =>
      evidenceProvider.resolve({ capability, subject: reviewCase.application.id, reviewCase }, signal),
    ),
  );

  return settled.map((result, index) =>
    result.status === 'fulfilled'
      ? result.value
      : unavailableEvidence(capabilities[index], reviewCase.application.id, result.reason),
  );
}

/**
 * Merges newly resolved evidence (e.g. from a clarification round) into a
 * base set, keyed by capability+subject — a new resolution for a capability
 * that was previously MISSING/UNAVAILABLE supersedes it in place, and a
 * genuinely new capability is appended.
 */
export function mergeEvidence(base: Evidence[], updates: Evidence[]): Evidence[] {
  const byKey = new Map<string, Evidence>();
  for (const item of base) byKey.set(`${item.capability}|${item.subject}`, item);
  for (const item of updates) byKey.set(`${item.capability}|${item.subject}`, item);
  return [...byKey.values()];
}
