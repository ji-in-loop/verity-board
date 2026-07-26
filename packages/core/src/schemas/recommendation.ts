import { z } from 'zod';
import { FindingSchema } from './finding.js';
import { EvidenceSchema } from './evidence.js';
import { ActorReviewSchema } from './actor-review.js';

export const DisagreementSchema = z.object({
  criterion: z.string().min(1),
  severity: z.enum(['material', 'critical']),
  actorPositions: z.record(z.string(), z.string()),
});
export type Disagreement = z.infer<typeof DisagreementSchema>;

export const PolicyEvaluationSchema = z.object({
  policyId: z.string().min(1),
  ruleFired: z.string().min(1),
  outcome: z.string().min(1),
  reasoning: z.string(),
});
export type PolicyEvaluation = z.infer<typeof PolicyEvaluationSchema>;

export const AuditMetadataSchema = z.object({
  startedAt: z.string(),
  completedAt: z.string(),
  evidenceFetched: z.array(z.string()).default([]),
  modelCallCount: z.number().int().nonnegative(),
  stoppingCondition: z.string().min(1),
});
export type AuditMetadata = z.infer<typeof AuditMetadataSchema>;

export const CommitteeRecommendationSchema = z.object({
  committeeId: z.string().min(1),
  reviewCaseId: z.string().min(1),
  reviewCaseTitle: z.string().min(1),
  actorRecommendations: z.record(z.string(), ActorReviewSchema),
  consolidatedBlockers: z.array(FindingSchema),
  consolidatedRisks: z.array(FindingSchema),
  missingEvidence: z.array(EvidenceSchema),
  disagreements: z.array(DisagreementSchema),
  requiredActions: z.array(z.string()),
  policyEvaluation: PolicyEvaluationSchema,
  overallRecommendation: z.string().min(1),
  humanDecisionOwner: z.string().min(1),
  audit: AuditMetadataSchema,
});
export type CommitteeRecommendation = z.infer<typeof CommitteeRecommendationSchema>;
