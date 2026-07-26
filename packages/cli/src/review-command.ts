import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadCatalog, loadReviewCaseFromCaseDir } from '@verity-board/config';
import { runReview } from '@verity-board/orchestrator';
import { LocalFileEvidenceProvider } from '@verity-board/providers-evidence-local';
import { JsonReporter, MarkdownReporter } from '@verity-board/reporters';
import type { ActorSkill } from '@verity-board/core';
import type { ReviewArgs } from './args.js';
import { resolveModelProvider, UnknownModelProviderError, MockFixturesUnavailableError } from './model-providers.js';

export class ReviewCommandError extends Error {}

export async function runReviewCommand(args: ReviewArgs): Promise<{
  json: string;
  markdown: string;
  outDir: string;
}> {
  const catalogDir = resolve(args.catalog ?? join(process.cwd(), 'catalog'));
  const caseDir = resolve(args.case);

  const catalog = loadCatalog(catalogDir);
  const committee = catalog.committees.get(args.committee);
  if (!committee) {
    throw new ReviewCommandError(
      `Unknown committee "${args.committee}". Available: ${[...catalog.committees.keys()].join(', ') || '(none found)'}`,
    );
  }

  const policy = catalog.policies.get(committee.decisionPolicy);
  if (!policy) {
    throw new ReviewCommandError(
      `Committee "${committee.id}" references unknown policy "${committee.decisionPolicy}".`,
    );
  }

  const referencedActorIds = new Set([
    ...committee.actors.required,
    ...committee.actors.conditional.map((c) => c.actor),
  ]);
  const actors: ActorSkill[] = [];
  for (const actorId of referencedActorIds) {
    const actor = catalog.actors.get(actorId);
    if (!actor) {
      throw new ReviewCommandError(`Committee "${committee.id}" references unknown actor "${actorId}".`);
    }
    actors.push(actor);
  }

  const reviewCase = loadReviewCaseFromCaseDir(caseDir);
  const evidenceProvider = new LocalFileEvidenceProvider(caseDir);

  let modelProvider;
  try {
    modelProvider = resolveModelProvider(args.model, reviewCase.id);
  } catch (error) {
    if (error instanceof UnknownModelProviderError || error instanceof MockFixturesUnavailableError) {
      throw new ReviewCommandError(error.message);
    }
    throw error;
  }

  const recommendation = await runReview({
    reviewCase,
    committee,
    actors,
    policy,
    evidenceProvider,
    modelProvider,
  });

  const json = new JsonReporter().render(recommendation);
  const markdown = new MarkdownReporter().render(recommendation);

  const outDir = resolve(args.out ?? join(caseDir, 'reports'));
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'recommendation.json'), json);
  writeFileSync(join(outDir, 'recommendation.md'), markdown);

  return { json, markdown, outDir };
}
