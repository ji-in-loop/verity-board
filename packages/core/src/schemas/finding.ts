import { z } from 'zod';
import { EvidenceStatusSchema } from './evidence.js';

export const FindingSeveritySchema = z.enum(['info', 'minor', 'material', 'critical']);
export type FindingSeverity = z.infer<typeof FindingSeveritySchema>;

/**
 * `category` is a dotted blocker code (e.g. "reliability.rollback_unverified")
 * used by DecisionPolicy.criticalBlockers to identify which findings can
 * force a blocking outcome. `criterion` is the broader, human-facing
 * criterion name (e.g. "rollback") an actor's `criteria` list declares.
 * The two are deliberately distinct: not every finding against a criterion
 * is severe enough to carry a blocker category.
 */
export const FindingSchema = z.object({
  actorId: z.string().min(1),
  criterion: z.string().min(1),
  category: z.string().min(1).optional(),
  status: EvidenceStatusSchema,
  severity: FindingSeveritySchema,
  explanation: z.string(),
  evidenceRefs: z.array(z.string()).default([]),
  requiredAction: z.string().optional(),
  confidence: z.number().min(0).max(1),
  isInferred: z.boolean(),
});
export type Finding = z.infer<typeof FindingSchema>;
