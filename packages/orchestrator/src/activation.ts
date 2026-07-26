import { evaluateCondition, type ActorSkill, type Committee, type ReviewCase } from '@verity-board/core';
import { UnknownActorError } from './errors.js';

export function buildCaseFacts(reviewCase: ReviewCase): Record<string, unknown> {
  return {
    case: {
      ...reviewCase.attributes,
      riskClassification: reviewCase.riskClassification,
      applicationId: reviewCase.application.id,
    },
  };
}

export function resolveActivatedActors(
  committee: Committee,
  actorsById: Map<string, ActorSkill>,
  reviewCase: ReviewCase,
): ActorSkill[] {
  const facts = buildCaseFacts(reviewCase);
  const activated = new Map<string, ActorSkill>();

  for (const actorId of committee.actors.required) {
    const actor = actorsById.get(actorId);
    if (!actor) {
      throw new UnknownActorError(`Committee "${committee.id}" requires unknown actor "${actorId}".`);
    }
    activated.set(actorId, actor);
  }

  for (const conditional of committee.actors.conditional) {
    if (!evaluateCondition(conditional.when, facts)) continue;
    const actor = actorsById.get(conditional.actor);
    if (!actor) {
      throw new UnknownActorError(
        `Committee "${committee.id}" has a conditional rule for unknown actor "${conditional.actor}".`,
      );
    }
    activated.set(conditional.actor, actor);
  }

  return [...activated.values()];
}
