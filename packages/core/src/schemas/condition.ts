import { z } from 'zod';

/**
 * Deliberately small expression grammar (see ADR-0004): comparisons against
 * a fixed, orchestrator-computed fact table, combined via any/all. No
 * user-defined functions, no eval, no arbitrary object graph access.
 */
export type ActivationCondition =
  | { any: ActivationCondition[] }
  | { all: ActivationCondition[] }
  | { expr: string };

export const ActivationConditionSchema: z.ZodType<ActivationCondition> = z.lazy(() =>
  z.union([
    z.object({ any: z.array(ActivationConditionSchema).min(1) }),
    z.object({ all: z.array(ActivationConditionSchema).min(1) }),
    z.object({ expr: z.string().min(1) }),
  ]),
);
