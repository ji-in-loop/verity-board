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

export async function collectEvidence(
  capabilities: string[],
  reviewCase: ReviewCase,
  evidenceProvider: EvidenceProvider,
  maximumEvidenceRequests: number,
): Promise<Evidence[]> {
  if (capabilities.length > maximumEvidenceRequests) {
    throw new EvidenceRequestLimitExceededError(
      `Evidence plan requires ${capabilities.length} requests, exceeding the committee's ` +
        `maximumEvidenceRequests limit of ${maximumEvidenceRequests}.`,
    );
  }

  return Promise.all(
    capabilities.map((capability) =>
      evidenceProvider.resolve({ capability, subject: reviewCase.application.id, reviewCase }),
    ),
  );
}
