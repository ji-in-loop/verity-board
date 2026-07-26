import {
  ActorReviewSchema,
  type ActorContext,
  type ActorReview,
  type ActorSkill,
  type ClarificationResponse,
  type Evidence,
  type Finding,
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

/**
 * A synthetic review carrying a single critical, protected-category finding.
 * Used whenever this actor's contribution to the review could not be
 * trusted — malformed output or a failed model call — so the gap is a
 * visible, policy-forcing finding rather than a crashed review or a
 * silently dropped actor. Every category here is checked by the policy
 * engine before any configured rule — see platform-outcomes.ts / ADR-0009.
 */
function platformFailureReview(
  actor: ActorSkill,
  round: 1 | 2,
  category: string,
  explanation: string,
): ActorReview {
  const finding: Finding = {
    actorId: actor.id,
    criterion: 'actor_output_validation',
    category,
    status: 'MISSING',
    severity: 'critical',
    explanation,
    evidenceRefs: [],
    confidence: 0,
    isInferred: false,
  };

  return {
    actorId: actor.id,
    actorDisplayName: actor.displayName,
    round,
    findings: [finding],
    unknowns: [],
    clarificationQuestions: [],
    recommendation: 'ESCALATE',
    confidence: 0,
  };
}

export async function invokeActorReview(
  actor: ActorSkill,
  context: ActorContext,
  modelProvider: ModelProvider,
  signal?: AbortSignal,
): Promise<ActorReview> {
  let raw: unknown;
  try {
    raw = await modelProvider.invokeActor({ actor, context }, signal);
  } catch (cause) {
    // A network error, rate limit, or other model-call failure must not
    // crash the whole review (which would waste every other actor's work
    // and every evidence fetch) — it becomes this actor's contribution:
    // a critical, protected-category finding that forces ESCALATE.
    return platformFailureReview(
      actor,
      context.round,
      'platform.model_call_failed',
      `${actor.displayName}'s model call failed and was treated as a blocking gap rather than crashing the review: ${String(cause)}`,
    );
  }

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

  return platformFailureReview(
    actor,
    context.round,
    'platform.actor_output_invalid',
    `${actor.displayName}'s response failed output validation and was rejected rather than trusted: ${parsed.error.message}`,
  );
}
