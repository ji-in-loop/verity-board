import { z } from 'zod';
import { ActivationConditionSchema } from './condition.js';

export const PolicyRuleSchema = z.object({
  when: ActivationConditionSchema,
  result: z.string().min(1),
});
export type PolicyRule = z.infer<typeof PolicyRuleSchema>;

export const DecisionPolicySchema = z.object({
  id: z.string().min(1),
  version: z.number().int().positive(),
  criticalBlockers: z.array(z.string()).default([]),
  rules: z.array(PolicyRuleSchema).min(1),
  /** Outcome used when no rule matches — never a silent GO. */
  defaultOutcome: z.string().default('ESCALATE'),
});
export type DecisionPolicy = z.infer<typeof DecisionPolicySchema>;
