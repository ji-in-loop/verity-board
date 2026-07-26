import { z } from 'zod';

export const PlaybookSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().positive(),
  reviewTask: z.string().min(1),
  inputRequirements: z.array(z.string()).default([]),
  applicableCommittees: z.array(z.string()).min(1),
  outcomeVocabulary: z.array(z.string()).min(1),
  mandatoryControls: z.array(z.string()).default([]),
  decisionRules: z.string().min(1),
  reportFormat: z.array(z.enum(['json', 'markdown'])).default(['json', 'markdown']),
});
export type Playbook = z.infer<typeof PlaybookSchema>;
