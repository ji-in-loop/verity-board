import { describe, expect, it } from 'vitest';
import { evaluateExpr, evaluateCondition, RuleExpressionError } from '../src/policy/rule-expression.js';
import type { ActivationCondition } from '../src/schemas/condition.js';

const facts = {
  criticalBlockers: { count: 2 },
  case: { publicEndpoint: true, dataClassification: 'restricted' },
};

describe('evaluateExpr', () => {
  it('evaluates == against a nested numeric fact', () => {
    expect(evaluateExpr('criticalBlockers.count == 2', facts)).toBe(true);
  });

  it('evaluates != against a nested string fact', () => {
    expect(evaluateExpr("case.dataClassification != 'internal'", facts)).toBe(true);
  });

  it('evaluates >, <, >=, <= against a numeric fact', () => {
    expect(evaluateExpr('criticalBlockers.count > 1', facts)).toBe(true);
    expect(evaluateExpr('criticalBlockers.count < 1', facts)).toBe(false);
    expect(evaluateExpr('criticalBlockers.count >= 2', facts)).toBe(true);
    expect(evaluateExpr('criticalBlockers.count <= 1', facts)).toBe(false);
  });

  it('evaluates a boolean literal', () => {
    expect(evaluateExpr('case.publicEndpoint == true', facts)).toBe(true);
  });

  it('evaluates a quoted string literal', () => {
    expect(evaluateExpr("case.dataClassification == 'restricted'", facts)).toBe(true);
  });

  it('returns false for a numeric comparison against a non-numeric fact', () => {
    expect(evaluateExpr("case.dataClassification > 1", facts)).toBe(false);
  });

  it('resolves an unknown path to undefined rather than throwing', () => {
    expect(evaluateExpr('nonexistent.path == 1', facts)).toBe(false);
  });

  it('throws on a malformed expression with no recognized operator', () => {
    expect(() => evaluateExpr('criticalBlockers.count', facts)).toThrow(RuleExpressionError);
  });

  it('throws on an unquoted, non-numeric, non-boolean literal', () => {
    expect(() => evaluateExpr('case.dataClassification == restricted', facts)).toThrow(
      RuleExpressionError,
    );
  });
});

describe('evaluateCondition', () => {
  it('evaluates a single expr condition', () => {
    expect(evaluateCondition({ expr: 'criticalBlockers.count == 2' }, facts)).toBe(true);
  });

  it('evaluates any as a logical OR', () => {
    expect(
      evaluateCondition(
        { any: [{ expr: 'criticalBlockers.count == 0' }, { expr: 'case.publicEndpoint == true' }] },
        facts,
      ),
    ).toBe(true);
  });

  it('evaluates all as a logical AND', () => {
    expect(
      evaluateCondition(
        { all: [{ expr: 'criticalBlockers.count == 2' }, { expr: 'case.publicEndpoint == true' }] },
        facts,
      ),
    ).toBe(true);
    expect(
      evaluateCondition(
        { all: [{ expr: 'criticalBlockers.count == 2' }, { expr: 'case.publicEndpoint == false' }] },
        facts,
      ),
    ).toBe(false);
  });

  it('evaluates nested any/all combinations', () => {
    expect(
      evaluateCondition(
        {
          all: [
            { expr: 'criticalBlockers.count == 2' },
            { any: [{ expr: 'case.publicEndpoint == false' }, { expr: "case.dataClassification == 'restricted'" }] },
          ],
        },
        facts,
      ),
    ).toBe(true);
  });

  it('throws on a malformed condition with none of expr/any/all', () => {
    expect(() => evaluateCondition({} as unknown as ActivationCondition, facts)).toThrow(
      RuleExpressionError,
    );
  });
});
