import { z } from 'zod';

/**
 * Deliberately not produced anywhere in this codebase. See ADR-0006:
 * a HumanApproval is an external record a consuming organization creates
 * through its own process, never something verity-board writes itself.
 */
export const HumanApprovalSchema = z.object({
  reviewCaseId: z.string().min(1),
  decidedBy: z.string().min(1),
  decidedAt: z.string(),
  followedRecommendation: z.boolean(),
  finalDecision: z.string().min(1),
  notes: z.string().optional(),
});
export type HumanApproval = z.infer<typeof HumanApprovalSchema>;
