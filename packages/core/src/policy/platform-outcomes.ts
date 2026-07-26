/**
 * Platform-integrity failure categories. These are never configurable by an
 * organization's policy YAML — a malformed model response, a failed model
 * call, or a policy-evaluation error is a platform failure, not a business
 * judgment call, and must not depend on whether the shipped policy happens
 * to list the right blocker category. See ADR-0009.
 *
 * A critical-severity finding carrying one of these categories always forces
 * ESCALATE, evaluated before any configured policy rule — independent of
 * `DecisionPolicy.criticalBlockers`.
 */
export const PLATFORM_PROTECTED_CATEGORIES = [
  'platform.actor_output_invalid',
  'platform.model_call_failed',
  'platform.required_actor_missing',
  'platform.evidence_provider_failed',
  'platform.policy_evaluation_failed',
] as const;

export type PlatformProtectedCategory = (typeof PLATFORM_PROTECTED_CATEGORIES)[number];

export function isPlatformProtectedCategory(category: string | undefined): boolean {
  return category !== undefined && (PLATFORM_PROTECTED_CATEGORIES as readonly string[]).includes(category);
}
