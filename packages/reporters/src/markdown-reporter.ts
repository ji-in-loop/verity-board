import type { CommitteeRecommendation, Reporter } from '@verity-board/core';

function actorLabel(actorId: string, recommendation: CommitteeRecommendation): string {
  return recommendation.actorRecommendations[actorId]?.actorDisplayName ?? actorId;
}

export class MarkdownReporter implements Reporter {
  readonly format = 'markdown' as const;

  render(recommendation: CommitteeRecommendation): string {
    const lines: string[] = [];

    lines.push('# verity-board COMMITTEE REVIEW', '');
    lines.push(`**Case:** ${recommendation.reviewCaseTitle}`);
    lines.push(`**Committee:** ${recommendation.committeeId}`);
    lines.push(`**Recommendation:** ${recommendation.overallRecommendation}`, '');

    lines.push('## Actor positions', '');
    for (const [actorId, review] of Object.entries(recommendation.actorRecommendations)) {
      lines.push(`- **${actorLabel(actorId, recommendation)}:** ${review.recommendation}`);
    }
    lines.push('');

    if (recommendation.consolidatedBlockers.length > 0) {
      lines.push('## Critical blockers', '');
      for (const blocker of recommendation.consolidatedBlockers) {
        lines.push(`- (${actorLabel(blocker.actorId, recommendation)}) ${blocker.explanation}`);
      }
      lines.push('');
    }

    if (recommendation.consolidatedRisks.length > 0) {
      lines.push('## Material risks', '');
      for (const risk of recommendation.consolidatedRisks) {
        lines.push(`- (${actorLabel(risk.actorId, recommendation)}) ${risk.explanation}`);
      }
      lines.push('');
    }

    if (recommendation.missingEvidence.length > 0) {
      lines.push('## Missing evidence', '');
      for (const evidence of recommendation.missingEvidence) {
        lines.push(`- ${evidence.summary}`);
      }
      lines.push('');
    }

    if (recommendation.disagreements.length > 0) {
      lines.push('## Disagreements', '');
      for (const disagreement of recommendation.disagreements) {
        const positions = Object.entries(disagreement.actorPositions)
          .map(([actorId, position]) => `${actorLabel(actorId, recommendation)}: ${position}`)
          .join('; ');
        lines.push(`- **${disagreement.criterion}** (${disagreement.severity}) — ${positions}`);
      }
      lines.push('');
    }

    if (recommendation.requiredActions.length > 0) {
      lines.push('## Required actions', '');
      recommendation.requiredActions.forEach((action, index) => {
        lines.push(`${index + 1}. ${action}`);
      });
      lines.push('');
    }

    lines.push('## Human decision owner', '');
    lines.push(recommendation.humanDecisionOwner, '');

    lines.push(
      '---',
      '_This is a recommendation, not a decision. No organizational action has been taken. ' +
        'The policy rule that produced this recommendation and the evidence behind every finding ' +
        'are recorded in the accompanying JSON report._',
    );

    return lines.join('\n');
  }
}
