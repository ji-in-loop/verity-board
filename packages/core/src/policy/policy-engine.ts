import type { DecisionPolicy } from '../schemas/decision-policy.js';
import type { ActorReview } from '../schemas/actor-review.js';
import type { Evidence } from '../schemas/evidence.js';
import type { Disagreement } from '../schemas/recommendation.js';
import type { PolicyEvaluation } from '../schemas/recommendation.js';
import { evaluateCondition } from './rule-expression.js';
import { isPlatformProtectedCategory } from './platform-outcomes.js';

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

  // 'MISSING' (never supplied) and 'UNAVAILABLE' (an evidence provider
  // failed while resolving it) both mean "policy cannot verify this" — an
  // evidence-collection failure must never be silently treated as a pass.
  const missingEvidenceCount = input.evidence.filter(
    (e) => e.status === 'MISSING' || e.status === 'UNAVAILABLE',
  ).length;

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
 *
 * Platform-integrity failures (see platform-outcomes.ts) are checked before
 * any configured rule and always force ESCALATE — this is not something an
 * organization's policy YAML can opt out of by omitting the category from
 * `criticalBlockers`. See ADR-0009.
 */
export function evaluatePolicy(input: PolicyEngineInput): PolicyEvaluation {
  const findings = input.actorReviews.flatMap((review) => review.findings);
  const platformFailure = findings.find(
    (f) => f.severity === 'critical' && isPlatformProtectedCategory(f.category),
  );

  if (platformFailure) {
    return {
      policyId: input.policy.id,
      ruleFired: '__platform_protected_escalation__',
      outcome: 'ESCALATE',
      reasoning:
        `A platform-integrity failure (category "${platformFailure.category}") was found, which ` +
        'always forces ESCALATE regardless of the configured policy — platform failures are not ' +
        'a business-policy decision. See ADR-0009.',
    };
  }

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
