import { z } from 'zod';

export const QuestionLimitsSchema = z.object({
  maximumQuestions: z.number().int().nonnegative(),
  maximumEvidenceRequests: z.number().int().nonnegative(),
});
export type QuestionLimits = z.infer<typeof QuestionLimitsSchema>;

export const EscalationRuleSchema = z.object({
  when: z.string().min(1),
  category: z.string().min(1),
});
export type EscalationRule = z.infer<typeof EscalationRuleSchema>;

export const ActorAuthoritySchema = z.object({
  blockerCategories: z.array(z.string()).default([]),
});
export type ActorAuthority = z.infer<typeof ActorAuthoritySchema>;

export const ActorSkillSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().positive(),
  displayName: z.string().min(1),
  description: z.string().default(''),
  mandate: z.array(z.string()).default([]),
  criteria: z.array(z.string()).min(1),
  requiredCapabilities: z.array(z.string()).default([]),
  allowedCapabilities: z.array(z.string()).default([]),
  questionLimits: QuestionLimitsSchema,
  escalationRules: z.array(EscalationRuleSchema).default([]),
  authority: ActorAuthoritySchema,
  outputSchema: z.string().min(1),
});
export type ActorSkill = z.infer<typeof ActorSkillSchema>;
