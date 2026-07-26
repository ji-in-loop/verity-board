import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { runReviewCommand, ReviewCommandError } from '../src/review-command.js';
import type { ReviewArgs } from '../src/args.js';

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
const repoRoot = join(packageDir, '..', '..');
const catalogDir = join(repoRoot, 'catalog');
const caseDir = join(repoRoot, 'examples', 'production-readiness', 'checkout-release');

let outDir: string;

afterEach(() => {
  if (outDir) rmSync(outDir, { recursive: true, force: true });
});

function baseArgs(overrides: Partial<ReviewArgs> = {}): ReviewArgs {
  outDir = mkdtempSync(join(tmpdir(), 'verity-board-cli-unit-'));
  return {
    committee: 'production-readiness',
    case: caseDir,
    catalog: catalogDir,
    out: outDir,
    model: 'mock',
    ...overrides,
  };
}

describe('runReviewCommand', () => {
  it('runs the checkout-release example in-process and writes JSON + Markdown reports', async () => {
    const { json, markdown, outDir: resultOutDir } = await runReviewCommand(baseArgs());

    expect(resultOutDir).toBe(outDir);

    const parsed = JSON.parse(json);
    expect(parsed.overallRecommendation).toBe('NO_GO');
    expect(parsed.humanDecisionOwner).toBe('Release Director');
    expect(markdown).toContain('NO_GO');

    const writtenJson = readFileSync(join(outDir, 'recommendation.json'), 'utf-8');
    const writtenMarkdown = readFileSync(join(outDir, 'recommendation.md'), 'utf-8');
    expect(JSON.parse(writtenJson)).toEqual(parsed);
    expect(writtenMarkdown).toBe(markdown);
  });

  it('throws ReviewCommandError for an unknown committee', async () => {
    await expect(runReviewCommand(baseArgs({ committee: 'does-not-exist' }))).rejects.toThrow(
      ReviewCommandError,
    );
  });

  it('wraps an unresolvable model provider as a ReviewCommandError rather than letting it propagate raw', async () => {
    await expect(runReviewCommand(baseArgs({ model: 'bogus-provider' }))).rejects.toThrow(
      ReviewCommandError,
    );
  });

  it('defaults outDir to <case>/reports when --out is not given', async () => {
    // Copy the fixture case into a scratch dir rather than pointing --case at
    // the real examples/ directory, so the default "write into <case>/reports"
    // behavior doesn't leave files behind in the repo tree.
    const scratchCaseDir = mkdtempSync(join(tmpdir(), 'verity-board-cli-unit-case-'));
    cpSync(caseDir, scratchCaseDir, { recursive: true });
    outDir = join(scratchCaseDir, 'reports');

    try {
      const { outDir: resultOutDir } = await runReviewCommand({
        committee: 'production-readiness',
        case: scratchCaseDir,
        catalog: catalogDir,
        model: 'mock',
      });

      expect(resultOutDir).toBe(outDir);
    } finally {
      rmSync(scratchCaseDir, { recursive: true, force: true });
    }
  });
});
