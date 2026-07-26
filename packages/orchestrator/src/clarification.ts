import {
  consolidateClarificationQuestions,
  type ActorReview,
  type ActorSkill,
  type ClarificationQuestion,
  type ClarificationResponse,
  type Committee,
  type Evidence,
  type EvidenceProvider,
  type ReviewCase,
} from '@verity-board/core';

export const NO_ADDITIONAL_EVIDENCE_TEXT = 'No additional evidence was available for this question.';

export function truncateActorQuestions(
  review: ActorReview,
  actor: ActorSkill,
  committee: Committee,
): ActorReview {
  const limit = Math.min(actor.questionLimits.maximumQuestions, committee.execution.maximumQuestionsPerActor);
  return { ...review, clarificationQuestions: review.clarificationQuestions.slice(0, limit) };
}

export function consolidateQuestions(
  reviews: ActorReview[],
  actorsById: Map<string, ActorSkill>,
  committee: Committee,
): ClarificationQuestion[] {
  const truncated = reviews.map((review) => {
    const actor = actorsById.get(review.actorId);
    return actor ? truncateActorQuestions(review, actor, committee) : review;
  });
  return consolidateClarificationQuestions(truncated);
}

export interface ClarificationResolution {
  responses: ClarificationResponse[];
  /**
   * Newly resolved Evidence for each question that named a
   * `targetCapability` and got something other than MISSING back — the
   * caller merges this into the review's canonical evidence set (see
   * mergeEvidence in evidence-plan.ts) so it actually affects missing-
   * evidence accounting, the policy evaluation, and the audit trail, not
   * just the round-2 prompt text.
   */
  evidence: Evidence[];
  gainedNewEvidence: boolean;
}

export async function resolveClarificationResponses(
  questions: ClarificationQuestion[],
  reviewCase: ReviewCase,
  evidenceProvider: EvidenceProvider,
  signal?: AbortSignal,
): Promise<ClarificationResolution> {
  const resolved = await Promise.all(
    questions.map(async (question): Promise<{ response: ClarificationResponse; evidence?: Evidence }> => {
      if (!question.targetCapability) {
        return { response: { questionId: question.questionId, text: NO_ADDITIONAL_EVIDENCE_TEXT } };
      }

      let evidence: Evidence;
      try {
        evidence = await evidenceProvider.resolve(
          { capability: question.targetCapability, subject: reviewCase.application.id, reviewCase },
          signal,
        );
      } catch {
        // A provider failure during clarification is treated the same as
        // "nothing new" for this question — it must not crash the review.
        return { response: { questionId: question.questionId, text: NO_ADDITIONAL_EVIDENCE_TEXT } };
      }

      if (evidence.status === 'MISSING' || evidence.status === 'UNAVAILABLE') {
        return { response: { questionId: question.questionId, text: NO_ADDITIONAL_EVIDENCE_TEXT } };
      }
      return { response: { questionId: question.questionId, text: evidence.summary }, evidence };
    }),
  );

  const evidence = resolved.flatMap((r) => (r.evidence ? [r.evidence] : []));

  return {
    responses: resolved.map((r) => r.response),
    evidence,
    gainedNewEvidence: evidence.length > 0,
  };
}
