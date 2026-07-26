import {
  ActorReviewSchema,
  type ActorContext,
  type ActorReview,
  type ActorSkill,
  type ClarificationResponse,
  type Evidence,
  type ModelProvider,
  type ReviewCase,
} from '@verity-board/core';
import { isCapabilityAllowed } from './capability-matching.js';

export function buildActorContext(
  actor: ActorSkill,
  reviewCase: ReviewCase,
  evidence: Evidence[],
  round: 1 | 2,
  priorClarificationResponses?: ClarificationResponse[],
): ActorContext {
  return {
    reviewCase,
    evidence: evidence.filter((e) => isCapabilityAllowed(actor.allowedCapabilities, e.capability)),
    mandate: actor.mandate,
    criteria: actor.criteria,
    round,
    priorClarificationResponses,
  };
}

/** Invoked when the model's raw output fails schema validation — treated as a
 * blocking gap, never silently dropped or fabricated into a passing review. */
const INVALID_OUTPUT_CATEGORY = 'platform.actor_output_invalid';

/**
 * A model shouldn't have to redundantly echo which actor it is into every
 * finding and question — it already knows from its own invocation. Fill in
 * `actorId` (and a stable `questionId`) when the model's raw output omits
 * them, without overriding a value the model did provide.
 */
function normalizeRawOutput(raw: unknown, actor: ActorSkill): Record<string, unknown> {
  if (typeof raw !== 'object' || raw === null) return {};
  const output = raw as Record<string, unknown>;

  const findings = Array.isArray(output.findings)
    ? output.findings.map((f) =>
        typeof f === 'object' && f !== null ? { actorId: actor.id, ...f } : f,
      )
    : output.findings;

  const clarificationQuestions = Array.isArray(output.clarificationQuestions)
    ? output.clarificationQuestions.map((q, index) =>
        typeof q === 'object' && q !== null
          ? { questionId: `${actor.id}-q${index + 1}`, actorId: actor.id, ...q }
          : q,
      )
    : output.clarificationQuestions;

  return { ...output, findings, clarificationQuestions };
}

export async function invokeActorReview(
  actor: ActorSkill,
  context: ActorContext,
  modelProvider: ModelProvider,
): Promise<ActorReview> {
  const raw = await modelProvider.invokeActor({ actor, context });
  const candidate = {
    actorId: actor.id,
    actorDisplayName: actor.displayName,
    round: context.round,
    findings: [],
    unknowns: [],
    clarificationQuestions: [],
    ...normalizeRawOutput(raw, actor),
  };

  const parsed = ActorReviewSchema.safeParse(candidate);
  if (parsed.success) return parsed.data;

  return {
    actorId: actor.id,
    actorDisplayName: actor.displayName,
    round: context.round,
    findings: [
      {
        actorId: actor.id,
        criterion: 'actor_output_validation',
        category: INVALID_OUTPUT_CATEGORY,
        status: 'MISSING',
        severity: 'critical',
        explanation: `${actor.displayName}'s response failed output validation and was rejected rather than trusted: ${parsed.error.message}`,
        evidenceRefs: [],
        confidence: 0,
        isInferred: false,
      },
    ],
    unknowns: [],
    clarificationQuestions: [],
    recommendation: 'ESCALATE',
    confidence: 0,
  };
}
