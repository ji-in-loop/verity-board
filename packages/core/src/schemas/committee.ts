import { z } from 'zod';
import { ActivationConditionSchema } from './condition.js';

export const ConditionalActorSchema = z.object({
  actor: z.string().min(1),
  when: ActivationConditionSchema,
});
export type ConditionalActor = z.infer<typeof ConditionalActorSchema>;

export const ExecutionConfigSchema = z.object({
  mode: z.enum(['parallel', 'sequential']).default('parallel'),
  // No maximumReviewRounds field: the orchestrator implements exactly one
  // fixed flow (round 1 -> at most one clarification round -> round 2 ->
  // stop, see ADR-0005), never a general N-round loop. A config value that
  // implied otherwise was removed rather than left to mislead — see
  // ADR-0009.
  maximumClarificationRounds: z.number().int().min(0).max(1).default(1),
  maximumQuestionsPerActor: z.number().int().nonnegative().default(3),
  maximumEvidenceRequests: z.number().int().nonnegative().default(20),
  maximumModelCalls: z.number().int().positive().optional(),
  timeoutMs: z.number().int().positive().optional(),
  stopWhenNoNewEvidence: z.boolean().default(true),
  stopWhenMandatoryBlockerFound: z.boolean().default(true),
  stopWhenAllActorsFinal: z.boolean().default(true),
});
export type ExecutionConfig = z.infer<typeof ExecutionConfigSchema>;

export const HumanApprovalConfigSchema = z.object({
  required: z.literal(true),
  decisionOwnerField: z.string().min(1),
});
export type HumanApprovalConfig = z.infer<typeof HumanApprovalConfigSchema>;

export const CommitteeSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().positive(),
  actors: z.object({
    required: z.array(z.string()).default([]),
    conditional: z.array(ConditionalActorSchema).default([]),
  }),
  execution: ExecutionConfigSchema,
  decisionPolicy: z.string().min(1),
  humanApproval: HumanApprovalConfigSchema,
});
export type Committee = z.infer<typeof CommitteeSchema>;
