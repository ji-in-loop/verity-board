import {
  consolidateClarificationQuestions,
  type ActorReview,
  type ActorSkill,
  type ClarificationQuestion,
  type ClarificationResponse,
  type Committee,
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
  gainedNewEvidence: boolean;
}

export async function resolveClarificationResponses(
  questions: ClarificationQuestion[],
  reviewCase: ReviewCase,
  evidenceProvider: EvidenceProvider,
): Promise<ClarificationResolution> {
  let gainedNewEvidence = false;

  const responses = await Promise.all(
    questions.map(async (question): Promise<ClarificationResponse> => {
      if (!question.targetCapability) {
        return { questionId: question.questionId, text: NO_ADDITIONAL_EVIDENCE_TEXT };
      }
      const evidence = await evidenceProvider.resolve({
        capability: question.targetCapability,
        subject: reviewCase.application.id,
        reviewCase,
      });
      if (evidence.status === 'MISSING') {
        return { questionId: question.questionId, text: NO_ADDITIONAL_EVIDENCE_TEXT };
      }
      gainedNewEvidence = true;
      return { questionId: question.questionId, text: evidence.summary };
    }),
  );

  return { responses, gainedNewEvidence };
}
