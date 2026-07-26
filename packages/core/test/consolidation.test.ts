import { describe, expect, it } from 'vitest';
import {
  consolidateClarificationQuestions,
  detectDisagreements,
} from '../src/consolidation/consolidate.js';
import type { ActorReview } from '../src/schemas/actor-review.js';
import type { Finding } from '../src/schemas/finding.js';

function finding(overrides: Partial<Finding>): Finding {
  return {
    actorId: 'actor',
    criterion: 'rollback',
    status: 'VERIFIED',
    severity: 'info',
    explanation: '',
    evidenceRefs: [],
    confidence: 0.9,
    isInferred: false,
    ...overrides,
  };
}

function review(overrides: Partial<ActorReview>): ActorReview {
  return {
    actorId: 'actor',
    round: 1,
    findings: [],
    unknowns: [],
    clarificationQuestions: [],
    recommendation: 'GO',
    confidence: 0.9,
    ...overrides,
  };
}

describe('consolidateClarificationQuestions', () => {
  it('collapses two actors asking the same question, textually', () => {
    const reviews: ActorReview[] = [
      review({
        actorId: 'sre-reviewer',
        clarificationQuestions: [
          { questionId: 'q1', actorId: 'sre-reviewer', text: 'Was the dependent service load tested?' },
        ],
      }),
      review({
        actorId: 'solution-architect',
        clarificationQuestions: [
          { questionId: 'q2', actorId: 'solution-architect', text: 'Was the dependent service load tested?' },
        ],
      }),
    ];
    expect(consolidateClarificationQuestions(reviews)).toHaveLength(1);
  });

  it('collapses near-duplicate questions where one contains the other', () => {
    const reviews: ActorReview[] = [
      review({
        clarificationQuestions: [
          { questionId: 'q1', actorId: 'a', text: 'Was rollback tested?' },
        ],
      }),
      review({
        clarificationQuestions: [
          { questionId: 'q2', actorId: 'b', text: 'Was rollback tested in staging?' },
        ],
      }),
    ];
    expect(consolidateClarificationQuestions(reviews)).toHaveLength(1);
  });

  it('keeps genuinely distinct questions from different actors', () => {
    const reviews: ActorReview[] = [
      review({ clarificationQuestions: [{ questionId: 'q1', actorId: 'a', text: 'Was rollback tested?' }] }),
      review({ clarificationQuestions: [{ questionId: 'q2', actorId: 'b', text: 'What is the on-call rotation?' }] }),
    ];
    expect(consolidateClarificationQuestions(reviews)).toHaveLength(2);
  });
});

describe('detectDisagreements', () => {
  it('flags conflicting actor positions on the same criterion as critical when either position is critical', () => {
    const reviews: ActorReview[] = [
      review({ actorId: 'sre-reviewer', findings: [finding({ actorId: 'sre-reviewer', criterion: 'rollback', status: 'CONTRADICTED', severity: 'critical' })] }),
      review({ actorId: 'solution-architect', findings: [finding({ actorId: 'solution-architect', criterion: 'rollback', status: 'VERIFIED', severity: 'info' })] }),
    ];
    const disagreements = detectDisagreements(reviews);
    expect(disagreements).toHaveLength(1);
    expect(disagreements[0].severity).toBe('critical');
    expect(disagreements[0].actorPositions).toHaveProperty('sre-reviewer');
    expect(disagreements[0].actorPositions).toHaveProperty('solution-architect');
  });

  it('does not flag agreement as a disagreement', () => {
    const reviews: ActorReview[] = [
      review({ actorId: 'a', findings: [finding({ actorId: 'a', criterion: 'availability', status: 'VERIFIED', severity: 'info' })] }),
      review({ actorId: 'b', findings: [finding({ actorId: 'b', criterion: 'availability', status: 'VERIFIED', severity: 'info' })] }),
    ];
    expect(detectDisagreements(reviews)).toHaveLength(0);
  });
});
