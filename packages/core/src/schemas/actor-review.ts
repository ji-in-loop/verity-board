import { z } from 'zod';
import { FindingSchema } from './finding.js';

export const ClarificationQuestionSchema = z.object({
  questionId: z.string().min(1),
  actorId: z.string().min(1),
  text: z.string().min(1),
  targetCapability: z.string().optional(),
});
export type ClarificationQuestion = z.infer<typeof ClarificationQuestionSchema>;

export const ClarificationResponseSchema = z.object({
  questionId: z.string().min(1),
  text: z.string().min(1),
});
export type ClarificationResponse = z.infer<typeof ClarificationResponseSchema>;

export const ActorReviewSchema = z.object({
  actorId: z.string().min(1),
  actorDisplayName: z.string().optional(),
  round: z.union([z.literal(1), z.literal(2)]),
  findings: z.array(FindingSchema),
  unknowns: z.array(z.string()).default([]),
  clarificationQuestions: z.array(ClarificationQuestionSchema).default([]),
  recommendation: z.string().min(1),
  confidence: z.number().min(0).max(1),
});
export type ActorReview = z.infer<typeof ActorReviewSchema>;

export function blockersOf(review: ActorReview) {
  return review.findings.filter((f) => f.severity === 'critical');
}

export function risksOf(review: ActorReview) {
  return review.findings.filter((f) => f.severity === 'material');
}
