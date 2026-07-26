import type { ActorSkill } from './schemas/actor-skill.js';
import type { ReviewCase } from './schemas/review-case.js';
import type { Evidence } from './schemas/evidence.js';
import type { ClarificationResponse } from './schemas/actor-review.js';
import type { CommitteeRecommendation } from './schemas/recommendation.js';

export interface ActorContext {
  reviewCase: ReviewCase;
  evidence: Evidence[];
  mandate: string[];
  criteria: string[];
  round: 1 | 2;
  priorClarificationResponses?: ClarificationResponse[];
}

export interface ModelProvider {
  readonly id: string;
  invokeActor(input: { actor: ActorSkill; context: ActorContext }): Promise<unknown>;
}

export interface EvidenceRequest {
  capability: string;
  subject: string;
  reviewCase: ReviewCase;
}

export interface EvidenceProvider {
  readonly id: string;
  resolve(request: EvidenceRequest): Promise<Evidence>;
}

export interface Reporter {
  readonly format: 'json' | 'markdown';
  render(recommendation: CommitteeRecommendation): string;
}
