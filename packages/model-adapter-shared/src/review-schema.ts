/**
 * The one review-output contract every model adapter forces the model into,
 * via whichever "structured output" or "forced tool call" mechanism that
 * provider's API offers — never free-text JSON, never a prefill. Plain JSON
 * Schema so it can be wrapped into each SDK's own tool/function format
 * without duplicating the shape per adapter. The orchestrator still
 * re-validates the result against ActorReviewSchema; this schema shapes the
 * response, it isn't a substitute for that validation.
 */
export const REVIEW_TOOL_NAME = 'submit_actor_review';

export const REVIEW_TOOL_DESCRIPTION =
  'Submit your independent review as this actor. Call this exactly once with your complete findings.';

export const reviewInputSchema = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      description: 'One entry per criterion you evaluated.',
      items: {
        type: 'object',
        properties: {
          criterion: { type: 'string' },
          category: {
            type: 'string',
            description:
              'Dotted blocker code (e.g. "reliability.rollback_unverified") if this finding should be checked against the committee policy as a potential blocker. Omit for findings that are not policy-relevant.',
          },
          status: {
            type: 'string',
            enum: ['VERIFIED', 'CONTRADICTED', 'MISSING', 'STALE', 'NOT_APPLICABLE', 'INFERRED'],
          },
          severity: { type: 'string', enum: ['info', 'minor', 'material', 'critical'] },
          explanation: { type: 'string' },
          evidenceRefs: { type: 'array', items: { type: 'string' } },
          requiredAction: { type: 'string' },
          confidence: { type: 'number', description: '0 to 1' },
          isInferred: {
            type: 'boolean',
            description: 'true if this is a guess rather than directly grounded in evidence',
          },
        },
        required: ['criterion', 'status', 'severity', 'explanation', 'confidence', 'isInferred'],
      },
    },
    unknowns: { type: 'array', items: { type: 'string' } },
    clarificationQuestions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          targetCapability: {
            type: 'string',
            description: 'The evidence capability that would answer this question, if known.',
          },
        },
        required: ['text'],
      },
    },
    recommendation: {
      type: 'string',
      description: "Your own advisory position — never the committee's official recommendation.",
    },
    confidence: { type: 'number', description: '0 to 1' },
  },
  required: ['findings', 'recommendation', 'confidence'],
};
