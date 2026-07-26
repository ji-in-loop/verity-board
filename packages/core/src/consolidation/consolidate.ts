import type { ActorReview, ClarificationQuestion } from '../schemas/actor-review.js';
import type { Disagreement } from '../schemas/recommendation.js';

function normalize(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Collapses semantically-overlapping clarification questions across actors
 * into one. "Overlapping" here means normalized-text equality or one
 * question's normalized text fully containing another's — a deliberately
 * simple heuristic, not NLP similarity, consistent with the anti-DSL
 * discipline applied to the policy grammar.
 */
export function consolidateClarificationQuestions(
  actorReviews: ActorReview[],
): ClarificationQuestion[] {
  const all = actorReviews.flatMap((review) => review.clarificationQuestions);
  const kept: ClarificationQuestion[] = [];
  const keptNormalized: string[] = [];

  for (const question of all) {
    const normalized = normalize(question.text);
    const isDuplicate = keptNormalized.some(
      (existing) =>
        existing === normalized || existing.includes(normalized) || normalized.includes(existing),
    );
    if (!isDuplicate) {
      kept.push(question);
      keptNormalized.push(normalized);
    }
  }

  return kept;
}

/**
 * A disagreement is two or more actors reaching a different status or
 * severity for the same criterion. Severity is "critical" if any of the
 * conflicting findings is itself critical-severity — a disagreement that
 * includes a critical position is never downgraded to "material" just
 * because other actors disagree with it.
 */
export function detectDisagreements(actorReviews: ActorReview[]): Disagreement[] {
  const byCriterion = new Map<string, { actorId: string; status: string; severity: string }[]>();

  for (const review of actorReviews) {
    for (const finding of review.findings) {
      const entries = byCriterion.get(finding.criterion) ?? [];
      entries.push({ actorId: finding.actorId, status: finding.status, severity: finding.severity });
      byCriterion.set(finding.criterion, entries);
    }
  }

  const disagreements: Disagreement[] = [];
  for (const [criterion, entries] of byCriterion) {
    const distinctPositions = new Set(entries.map((e) => `${e.status}:${e.severity}`));
    if (distinctPositions.size <= 1) continue;

    const severity = entries.some((e) => e.severity === 'critical') ? 'critical' : 'material';
    const actorPositions: Record<string, string> = {};
    for (const entry of entries) {
      actorPositions[entry.actorId] = `${entry.status} (${entry.severity})`;
    }

    disagreements.push({ criterion, severity, actorPositions });
  }

  return disagreements;
}
