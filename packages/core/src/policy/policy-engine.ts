import type { DecisionPolicy } from '../schemas/decision-policy.js';
import type { ActorReview } from '../schemas/actor-review.js';
import type { Evidence } from '../schemas/evidence.js';
import type { Disagreement } from '../schemas/recommendation.js';
import type { PolicyEvaluation } from '../schemas/recommendation.js';
import { evaluateCondition } from './rule-expression.js';

export interface PolicyEngineInput {
  policy: DecisionPolicy;
  actorReviews: ActorReview[];
  evidence: Evidence[];
  disagreements: Disagreement[];
}

function buildFacts(input: PolicyEngineInput): Record<string, unknown> {
  const findings = input.actorReviews.flatMap((review) => review.findings);

  const criticalBlockerCount = findings.filter(
    (f) => f.severity === 'critical' && f.category && input.policy.criticalBlockers.includes(f.category),
  ).length;

  const materialRiskCount = findings.filter((f) => f.severity === 'material').length;

  const missingEvidenceCount = input.evidence.filter((e) => e.status === 'MISSING').length;

  const criticalDisagreementCount = input.disagreements.filter(
    (d) => d.severity === 'critical',
  ).length;

  return {
    criticalBlockers: { count: criticalBlockerCount },
    materialRisks: { count: materialRiskCount },
    mandatoryEvidence: { missing: missingEvidenceCount },
    disagreements: { critical: { count: criticalDisagreementCount } },
  };
}

/**
 * Pure function: same findings/evidence/disagreements in, same outcome out.
 * Never reads a model-provided "recommendation" field — see ADR-0001.
 */
export function evaluatePolicy(input: PolicyEngineInput): PolicyEvaluation {
  const facts = buildFacts(input);

  for (const rule of input.policy.rules) {
    if (evaluateCondition(rule.when, facts)) {
      return {
        policyId: input.policy.id,
        ruleFired: JSON.stringify(rule.when),
        outcome: rule.result,
        reasoning: `Rule matched: ${JSON.stringify(rule.when)} -> ${rule.result}. Facts: ${JSON.stringify(facts)}.`,
      };
    }
  }

  return {
    policyId: input.policy.id,
    ruleFired: '__no_rule_matched__',
    outcome: input.policy.defaultOutcome,
    reasoning: `No configured rule matched the evaluated facts (${JSON.stringify(facts)}); falling back to the policy's default outcome rather than assuming approval.`,
  };
}
