import { z } from 'zod';

export const RiskClassificationSchema = z.enum(['low', 'medium', 'high', 'critical']);
export type RiskClassification = z.infer<typeof RiskClassificationSchema>;

export const ReviewCaseSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().default(''),
  application: z.record(z.string(), z.unknown()).and(z.object({ id: z.string(), name: z.string() })),
  riskClassification: RiskClassificationSchema,
  submittedArtifacts: z.array(z.string()).default([]),
  evidenceReferences: z.array(z.string()).default([]),
  requestingTeam: z.string().min(1),
  humanDecisionOwner: z.string().min(1),
  /** Free-form case facts (e.g. publicEndpoint, dataClassification) used by conditional-actor rules. */
  attributes: z.record(z.string(), z.unknown()).default({}),
});
export type ReviewCase = z.infer<typeof ReviewCaseSchema>;
