import { z } from 'zod';
import { EvidenceStatusSchema, EvidenceClassificationSchema } from '@verity-board/core';

export const EvidenceMappingEntrySchema = z.object({
  capability: z.string().min(1),
  subject: z.string().min(1),
  status: EvidenceStatusSchema,
  summary: z.string(),
  file: z.string().min(1).optional(),
  classification: EvidenceClassificationSchema.default('internal'),
  asOf: z.string().optional(),
  isStale: z.boolean().default(false),
});
export type EvidenceMappingEntry = z.infer<typeof EvidenceMappingEntrySchema>;

export const EvidenceMappingFileSchema = z.object({
  evidence: z.array(EvidenceMappingEntrySchema).default([]),
});
export type EvidenceMappingFile = z.infer<typeof EvidenceMappingFileSchema>;
