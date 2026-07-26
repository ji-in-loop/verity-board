import type Anthropic from '@anthropic-ai/sdk';
import { reviewInputSchema, REVIEW_TOOL_NAME, REVIEW_TOOL_DESCRIPTION } from '@verity-board/model-adapter-shared';

export { REVIEW_TOOL_NAME };

/**
 * Wraps the provider-neutral review schema (see @verity-board/model-adapter-shared)
 * into Anthropic's tool format, forced via tool_choice rather than relying on
 * free-text JSON or a prefill. The orchestrator still re-validates the result
 * against ActorReviewSchema — this shapes the response, it isn't a substitute
 * for that validation.
 */
export const reviewTool: Anthropic.Tool = {
  name: REVIEW_TOOL_NAME,
  description: REVIEW_TOOL_DESCRIPTION,
  input_schema: reviewInputSchema as Anthropic.Tool.InputSchema,
};
