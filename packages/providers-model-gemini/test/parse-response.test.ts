import { describe, expect, it } from 'vitest';
import type { GenerateContentResponse } from '@google/genai';
import { parseGenerateContentFunctionCall } from '../src/parse-response.js';

function responseWithFunctionCall(name: string, args: unknown): GenerateContentResponse {
  return { functionCalls: [{ name, args }] } as unknown as GenerateContentResponse;
}

function responseWithoutFunctionCall(): GenerateContentResponse {
  return { functionCalls: undefined } as unknown as GenerateContentResponse;
}

describe('parseGenerateContentFunctionCall', () => {
  it('returns the matching function call arguments', () => {
    const result = parseGenerateContentFunctionCall(
      responseWithFunctionCall('submit_actor_review', { findings: [], recommendation: 'GO', confidence: 0.9 }),
    );
    expect(result).toEqual({ findings: [], recommendation: 'GO', confidence: 0.9 });
  });

  it('ignores a function call for a different name', () => {
    const result = parseGenerateContentFunctionCall(responseWithFunctionCall('some_other_tool', { a: 1 }));
    expect(result).toEqual({ findings: [], recommendation: 'ESCALATE', confidence: 0 });
  });

  it('falls back to a safe ESCALATE result when no function call is present', () => {
    const result = parseGenerateContentFunctionCall(responseWithoutFunctionCall());
    expect(result).toEqual({ findings: [], recommendation: 'ESCALATE', confidence: 0 });
  });
});
