import type OpenAI from 'openai';
import { REVIEW_TOOL_NAME } from '@verity-board/model-adapter-shared';

/**
 * Pure and directly testable without a network call: given a chat-completion
 * response, extracts the forced tool call's arguments, or a safe fallback if
 * the model declined to call it (content filtered, refused, etc.) — treated
 * as a blocking gap by the orchestrator, never a silent pass.
 */
export function parseChatCompletionToolCall(
  response: OpenAI.Chat.Completions.ChatCompletion,
): unknown {
  const message = response.choices[0]?.message;
  const toolCall = message?.tool_calls?.find(
    (call): call is OpenAI.Chat.Completions.ChatCompletionMessageToolCall & { type: 'function' } =>
      call.type === 'function' && call.function.name === REVIEW_TOOL_NAME,
  );

  if (!toolCall) {
    return { findings: [], recommendation: 'ESCALATE', confidence: 0 };
  }

  return JSON.parse(toolCall.function.arguments);
}
