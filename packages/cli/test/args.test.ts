import { describe, expect, it } from 'vitest';
import { parseReviewArgs, CliArgumentError } from '../src/args.js';

describe('parseReviewArgs', () => {
  it('parses all flags when provided', () => {
    const args = parseReviewArgs([
      '--committee',
      'production-readiness',
      '--case',
      '/tmp/case-dir',
      '--out',
      '/tmp/out-dir',
      '--model',
      'anthropic',
      '--catalog',
      '/tmp/catalog-dir',
    ]);

    expect(args).toEqual({
      committee: 'production-readiness',
      case: '/tmp/case-dir',
      out: '/tmp/out-dir',
      model: 'anthropic',
      catalog: '/tmp/catalog-dir',
    });
  });

  it('defaults model to "mock" and leaves out/catalog undefined when omitted', () => {
    const args = parseReviewArgs(['--committee', 'production-readiness', '--case', '/tmp/case-dir']);

    expect(args.model).toBe('mock');
    expect(args.out).toBeUndefined();
    expect(args.catalog).toBeUndefined();
  });

  it('throws when --committee is missing', () => {
    expect(() => parseReviewArgs(['--case', '/tmp/case-dir'])).toThrow(CliArgumentError);
  });

  it('throws when --case is missing', () => {
    expect(() => parseReviewArgs(['--committee', 'production-readiness'])).toThrow(CliArgumentError);
  });

  it('throws when a flag is given with no value because it is the last argument', () => {
    expect(() =>
      parseReviewArgs(['--committee', 'production-readiness', '--case']),
    ).toThrow(CliArgumentError);
  });

  it('throws when a flag is immediately followed by another flag rather than a value', () => {
    expect(() =>
      parseReviewArgs(['--committee', '--case', '/tmp/case-dir']),
    ).toThrow(CliArgumentError);
  });
});
