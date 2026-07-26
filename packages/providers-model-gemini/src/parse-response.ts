import type { GenerateContentResponse } from '@google/genai';
import { REVIEW_TOOL_NAME } from '@verity-board/model-adapter-shared';

/**
 * Pure and directly testable without a network call: given a generateContent
 * response, extracts the forced function call's arguments, or a safe
 * fallback if the model declined to call it — treated as a blocking gap by
 * the orchestrator, never a silent pass.
 */
export function parseGenerateContentFunctionCall(response: GenerateContentResponse): unknown {
  const call = response.functionCalls?.find((candidate) => candidate.name === REVIEW_TOOL_NAME);
  if (!call) {
    return { findings: [], recommendation: 'ESCALATE', confidence: 0 };
  }
  return call.args ?? {};
}
