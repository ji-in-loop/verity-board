import {
  detectDisagreements,
  evaluatePolicy,
  type ActorReview,
  type ActorSkill,
  type Committee,
  type CommitteeRecommendation,
  type DecisionPolicy,
  type Evidence,
  type EvidenceProvider,
  type ModelProvider,
  type PolicyEvaluation,
  type ReviewCase,
} from '@verity-board/core';
import { resolveActivatedActors } from './activation.js';
import { buildEvidencePlan, collectEvidence, mergeEvidence } from './evidence-plan.js';
import { buildActorContext, invokeActorReview } from './actor-invocation.js';
import { consolidateQuestions, resolveClarificationResponses } from './clarification.js';
import {
  EvidenceRequestLimitExceededError,
  ModelCallLimitExceededError,
  ReviewTimeoutError,
} from './errors.js';

export interface RunReviewInput {
  reviewCase: ReviewCase;
  committee: Committee;
  actors: ActorSkill[];
  policy: DecisionPolicy;
  evidenceProvider: EvidenceProvider;
  modelProvider: ModelProvider;
}

function hasMandatoryBlocker(reviews: ActorReview[], policy: DecisionPolicy): boolean {
  return reviews.some((review) =>
    review.findings.some(
      (f) => f.severity === 'critical' && f.category && policy.criticalBlockers.includes(f.category),
    ),
  );
}

/**
 * A malformed policy (e.g. a rule expression that fails to parse) must not
 * crash the review — it's a platform/configuration failure, not a business
 * outcome, so it forces ESCALATE the same way an invalid actor response
 * does. See ADR-0009.
 */
function evaluatePolicySafely(input: Parameters<typeof evaluatePolicy>[0]): PolicyEvaluation {
  try {
    return evaluatePolicy(input);
  } catch (cause) {
    return {
      policyId: input.policy.id,
      ruleFired: '__platform_protected_escalation__',
      outcome: 'ESCALATE',
      reasoning:
        `Policy evaluation failed (category platform.policy_evaluation_failed) and was treated as a ` +
        `blocking gap rather than crashing the review: ${String(cause)}`,
    };
  }
}

async function runReviewInner(input: RunReviewInput, signal: AbortSignal): Promise<CommitteeRecommendation> {
  const startedAt = new Date().toISOString();
  const { reviewCase, committee, policy, evidenceProvider, modelProvider } = input;

  const actorsById = new Map(input.actors.map((actor) => [actor.id, actor]));
  const activatedActors = resolveActivatedActors(committee, actorsById, reviewCase);

  const evidencePlan = buildEvidencePlan(activatedActors);
  const roundOneEvidence = await collectEvidence(
    evidencePlan,
    reviewCase,
    evidenceProvider,
    committee.execution.maximumEvidenceRequests,
    signal,
  );
  let evidenceFetched = [...roundOneEvidence];

  let modelCallCount = 0;
  const maxModelCalls = committee.execution.maximumModelCalls;
  function checkModelCallLimit() {
    modelCallCount += 1;
    if (maxModelCalls !== undefined && modelCallCount > maxModelCalls) {
      throw new ModelCallLimitExceededError(
        `Review exceeded the committee's maximumModelCalls limit of ${maxModelCalls}.`,
      );
    }
  }

  const roundOneReviews = await Promise.all(
    activatedActors.map(async (actor) => {
      checkModelCallLimit();
      const context = buildActorContext(actor, reviewCase, roundOneEvidence, 1);
      return invokeActorReview(actor, context, modelProvider, signal);
    }),
  );

  let finalReviews: ActorReview[] = roundOneReviews;
  let stoppingCondition: string;

  if (committee.execution.stopWhenMandatoryBlockerFound && hasMandatoryBlocker(roundOneReviews, policy)) {
    stoppingCondition = 'MANDATORY_BLOCKER_FOUND';
  } else if (committee.execution.maximumClarificationRounds === 0) {
    stoppingCondition = 'NO_CLARIFICATION_ROUND_CONFIGURED';
  } else {
    const consolidatedQuestions = consolidateQuestions(roundOneReviews, actorsById, committee);

    if (consolidatedQuestions.length === 0) {
      stoppingCondition = committee.execution.stopWhenAllActorsFinal
        ? 'ALL_ACTORS_FINAL'
        : 'NO_QUESTIONS_RAISED';
    } else {
      const remainingEvidenceBudget = committee.execution.maximumEvidenceRequests - evidenceFetched.length;
      if (consolidatedQuestions.length > Math.max(remainingEvidenceBudget, 0)) {
        throw new EvidenceRequestLimitExceededError(
          `Clarification round would require ${consolidatedQuestions.length} additional evidence ` +
            `lookups, exceeding the committee's remaining evidence budget of ${Math.max(remainingEvidenceBudget, 0)}.`,
        );
      }

      const { responses, evidence: clarificationEvidence, gainedNewEvidence } =
        await resolveClarificationResponses(consolidatedQuestions, reviewCase, evidenceProvider, signal);

      if (committee.execution.stopWhenNoNewEvidence && !gainedNewEvidence) {
        stoppingCondition = 'NO_NEW_EVIDENCE';
      } else {
        // The clarification round's whole purpose is to close evidence
        // gaps that affect the recommendation — merge what it found into
        // the canonical evidence set *before* round 2 runs, so round-2
        // actors see it, missing-evidence accounting reflects it, and the
        // policy engine evaluates against it. See ADR-0010.
        evidenceFetched = mergeEvidence(evidenceFetched, clarificationEvidence);

        const roundTwoReviews = await Promise.all(
          activatedActors.map(async (actor) => {
            checkModelCallLimit();
            const context = buildActorContext(actor, reviewCase, evidenceFetched, 2, responses);
            return invokeActorReview(actor, context, modelProvider, signal);
          }),
        );
        finalReviews = roundTwoReviews;
        stoppingCondition = 'CLARIFICATION_ROUND_COMPLETED';
      }
    }
  }

  const disagreements = detectDisagreements(finalReviews);
  const findings = finalReviews.flatMap((review) => review.findings);
  const consolidatedBlockers = findings.filter((f) => f.severity === 'critical');
  const consolidatedRisks = findings.filter((f) => f.severity === 'material');
  const missingEvidence = evidenceFetched.filter(
    (e: Evidence) => e.status === 'MISSING' || e.status === 'UNAVAILABLE',
  );
  const requiredActions = findings
    .filter((f) => f.requiredAction)
    .map((f) => f.requiredAction as string);

  const policyEvaluation = evaluatePolicySafely({
    policy,
    actorReviews: finalReviews,
    evidence: evidenceFetched,
    disagreements,
  });

  const actorRecommendations: Record<string, ActorReview> = {};
  for (const review of finalReviews) actorRecommendations[review.actorId] = review;

  return {
    committeeId: committee.id,
    reviewCaseId: reviewCase.id,
    reviewCaseTitle: reviewCase.title,
    actorRecommendations,
    consolidatedBlockers,
    consolidatedRisks,
    missingEvidence,
    disagreements,
    requiredActions,
    policyEvaluation,
    overallRecommendation: policyEvaluation.outcome,
    humanDecisionOwner: reviewCase.humanDecisionOwner,
    audit: {
      startedAt,
      completedAt: new Date().toISOString(),
      evidenceFetched: evidenceFetched.map((e) => e.evidenceId),
      modelCallCount,
      stoppingCondition,
    },
  };
}

export async function runReview(input: RunReviewInput): Promise<CommitteeRecommendation> {
  const timeoutMs = input.committee.execution.timeoutMs;
  const controller = new AbortController();

  if (timeoutMs === undefined) {
    return runReviewInner(input, controller.signal);
  }

  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      const error = new ReviewTimeoutError(`Review exceeded the committee's timeoutMs of ${timeoutMs}.`);
      // Actually cancel in-flight model/evidence calls, not just stop
      // waiting for them — providers that honor the signal (all bundled
      // ones do) stop consuming tokens/resources immediately.
      controller.abort(error);
      reject(error);
    }, timeoutMs);
  });

  try {
    return await Promise.race([runReviewInner(input, controller.signal), timeout]);
  } finally {
    clearTimeout(timer!);
  }
}
