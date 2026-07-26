import { z } from 'zod';

export const EvidenceStatusSchema = z.enum([
  'VERIFIED',
  'CONTRADICTED',
  'MISSING',
  'STALE',
  'NOT_APPLICABLE',
  'INFERRED',
  /**
   * Distinct from MISSING: a source was declared for this capability but
   * resolving it failed (provider exception, network error, malformed
   * response) rather than nothing being supplied at all. Treated the same
   * as MISSING for policy purposes — see policy-engine.ts — but kept
   * distinguishable in reports/audits for diagnosability.
   */
  'UNAVAILABLE',
]);
export type EvidenceStatus = z.infer<typeof EvidenceStatusSchema>;

export const EvidenceClassificationSchema = z.enum([
  'public',
  'internal',
  'confidential',
  'restricted',
]);
export type EvidenceClassification = z.infer<typeof EvidenceClassificationSchema>;

export const EvidenceSchema = z.object({
  evidenceId: z.string().min(1),
  capability: z.string().min(1),
  subject: z.string().min(1),
  status: EvidenceStatusSchema,
  summary: z.string(),
  facts: z.record(z.string(), z.unknown()).default({}),
  provenance: z.object({
    provider: z.string().min(1),
    sourceRef: z.string().min(1),
    retrievedAt: z.string(),
  }),
  freshness: z.object({
    asOf: z.string().optional(),
    isStale: z.boolean(),
  }),
  classification: EvidenceClassificationSchema,
  integrity: z
    .object({
      checksum: z.string().optional(),
      signed: z.boolean().optional(),
    })
    .optional(),
});
export type Evidence = z.infer<typeof EvidenceSchema>;
