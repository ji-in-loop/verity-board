import type { CommitteeRecommendation, Reporter } from '@verity-board/core';

export class JsonReporter implements Reporter {
  readonly format = 'json' as const;

  render(recommendation: CommitteeRecommendation): string {
    return JSON.stringify(recommendation, null, 2);
  }
}
