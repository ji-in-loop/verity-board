export class CliArgumentError extends Error {}

export interface ReviewArgs {
  committee: string;
  case: string;
  out?: string;
  /** Resolved against the model-provider registry — see model-providers.ts. */
  model: string;
  catalog?: string;
}

function readFlag(args: string[], name: string): string | undefined {
  const index = args.indexOf(`--${name}`);
  if (index === -1) return undefined;
  const value = args[index + 1];
  if (value === undefined || value.startsWith('--')) {
    throw new CliArgumentError(`--${name} requires a value.`);
  }
  return value;
}

export function parseReviewArgs(args: string[]): ReviewArgs {
  const committee = readFlag(args, 'committee');
  const caseDir = readFlag(args, 'case');
  if (!committee) throw new CliArgumentError('Missing required flag: --committee <id>');
  if (!caseDir) throw new CliArgumentError('Missing required flag: --case <path>');

  return {
    committee,
    case: caseDir,
    out: readFlag(args, 'out'),
    model: readFlag(args, 'model') ?? 'mock',
    catalog: readFlag(args, 'catalog'),
  };
}
