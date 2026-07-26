import type { ActivationCondition } from '../schemas/condition.js';

const COMPARISON_PATTERN = /^(\S+)\s*(==|!=|>=|<=|>|<)\s*(.+)$/;

export class RuleExpressionError extends Error {}

function resolvePath(facts: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((value, segment) => {
    if (value === undefined || value === null) return undefined;
    if (typeof value !== 'object') return undefined;
    return (value as Record<string, unknown>)[segment];
  }, facts);
}

function parseLiteral(raw: string): string | number | boolean {
  const trimmed = raw.trim();
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  const quoted = trimmed.match(/^'(.*)'$|^"(.*)"$/);
  if (quoted) return quoted[1] ?? quoted[2] ?? '';
  const numeric = Number(trimmed);
  if (!Number.isNaN(numeric) && trimmed !== '') return numeric;
  throw new RuleExpressionError(
    `Unrecognized literal "${raw}" — string literals must be quoted, e.g. 'restricted'.`,
  );
}

export function evaluateExpr(expr: string, facts: Record<string, unknown>): boolean {
  const match = expr.trim().match(COMPARISON_PATTERN);
  if (!match) {
    throw new RuleExpressionError(
      `Malformed expression "${expr}" — expected "<path> <op> <value>".`,
    );
  }
  const [, path, op, rawValue] = match;
  const actual = resolvePath(facts, path);
  const expected = parseLiteral(rawValue);

  switch (op) {
    case '==':
      return actual === expected;
    case '!=':
      return actual !== expected;
    case '>':
      return typeof actual === 'number' && actual > (expected as number);
    case '<':
      return typeof actual === 'number' && actual < (expected as number);
    case '>=':
      return typeof actual === 'number' && actual >= (expected as number);
    case '<=':
      return typeof actual === 'number' && actual <= (expected as number);
    default:
      throw new RuleExpressionError(`Unsupported operator "${op}".`);
  }
}

export function evaluateCondition(
  condition: ActivationCondition,
  facts: Record<string, unknown>,
): boolean {
  if ('expr' in condition) return evaluateExpr(condition.expr, facts);
  if ('any' in condition) return condition.any.some((c) => evaluateCondition(c, facts));
  if ('all' in condition) return condition.all.every((c) => evaluateCondition(c, facts));
  throw new RuleExpressionError('Malformed condition: expected one of expr/any/all.');
}
