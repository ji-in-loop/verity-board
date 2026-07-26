import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, afterEach } from 'vitest';

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
const repoRoot = join(packageDir, '..', '..');
const cliEntry = join(packageDir, 'dist', 'index.js');
const catalogDir = join(repoRoot, 'catalog');
const caseDir = join(repoRoot, 'examples', 'production-readiness', 'checkout-release');

let outDir: string;

afterEach(() => {
  if (outDir) rmSync(outDir, { recursive: true, force: true });
});

describe('verity-board review (CLI e2e, mock model)', () => {
  it('runs the checkout-release example end to end and writes JSON + Markdown reports', () => {
    outDir = mkdtempSync(join(tmpdir(), 'verity-board-cli-e2e-'));

    const result = spawnSync(
      process.execPath,
      [
        cliEntry,
        'review',
        '--committee',
        'production-readiness',
        '--case',
        caseDir,
        '--catalog',
        catalogDir,
        '--out',
        outDir,
      ],
      { encoding: 'utf-8' },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('NO_GO');
    expect(result.stdout).toContain('Rollback validation failed');
    expect(result.stdout).toContain('Correct and rerun rollback validation.');
    expect(result.stdout).toContain('Release Director');
    expect(result.stdout).toMatch(/recommendation, not a decision/i);

    const json = JSON.parse(readFileSync(join(outDir, 'recommendation.json'), 'utf-8'));
    expect(json.overallRecommendation).toBe('NO_GO');
    expect(json.consolidatedBlockers.length).toBeGreaterThan(0);
    expect(json.missingEvidence.length).toBeGreaterThan(0);
    expect(json.humanDecisionOwner).toBe('Release Director');

    const markdown = readFileSync(join(outDir, 'recommendation.md'), 'utf-8');
    expect(markdown).toContain('NO_GO');
  });

  it('rejects an unknown committee with a clear error and non-zero exit code', () => {
    outDir = mkdtempSync(join(tmpdir(), 'verity-board-cli-e2e-'));

    const result = spawnSync(
      process.execPath,
      [
        cliEntry,
        'review',
        '--committee',
        'does-not-exist',
        '--case',
        caseDir,
        '--catalog',
        catalogDir,
        '--out',
        outDir,
      ],
      { encoding: 'utf-8' },
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/unknown committee/i);
  });

  it('rejects an unknown --model provider and lists the registered providers', () => {
    outDir = mkdtempSync(join(tmpdir(), 'verity-board-cli-e2e-'));

    const result = spawnSync(
      process.execPath,
      [
        cliEntry,
        'review',
        '--committee',
        'production-readiness',
        '--case',
        caseDir,
        '--catalog',
        catalogDir,
        '--out',
        outDir,
        '--model',
        'bogus-provider',
      ],
      { encoding: 'utf-8' },
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/unknown model provider/i);
    expect(result.stderr).toContain('anthropic');
    expect(result.stderr).toContain('openai');
    expect(result.stderr).toContain('gemini');
  });
});
