import { describe, expect, it } from 'vitest';
import type OpenAI from 'openai';
import { parseChatCompletionToolCall } from '../src/parse-response.js';

function completionWithToolCall(functionName: string, args: unknown): OpenAI.Chat.Completions.ChatCompletion {
  return {
    id: 'chatcmpl-1',
    object: 'chat.completion',
    created: 0,
    model: 'gpt-4o-mini',
    choices: [
      {
        index: 0,
        finish_reason: 'tool_calls',
        logprobs: null,
        message: {
          role: 'assistant',
          content: null,
          refusal: null,
          tool_calls: [
            {
              id: 'call_1',
              type: 'function',
              function: { name: functionName, arguments: JSON.stringify(args) },
            },
          ],
        },
      },
    ],
  } as unknown as OpenAI.Chat.Completions.ChatCompletion;
}

function completionWithoutToolCall(): OpenAI.Chat.Completions.ChatCompletion {
  return {
    id: 'chatcmpl-2',
    object: 'chat.completion',
    created: 0,
    model: 'gpt-4o-mini',
    choices: [
      {
        index: 0,
        finish_reason: 'content_filter',
        logprobs: null,
        message: { role: 'assistant', content: null, refusal: 'blocked' },
      },
    ],
  } as unknown as OpenAI.Chat.Completions.ChatCompletion;
}

describe('parseChatCompletionToolCall', () => {
  it('parses the forced tool call arguments as JSON', () => {
    const result = parseChatCompletionToolCall(
      completionWithToolCall('submit_actor_review', { findings: [], recommendation: 'GO', confidence: 0.9 }),
    );
    expect(result).toEqual({ findings: [], recommendation: 'GO', confidence: 0.9 });
  });

  it('ignores a tool call for a different function name', () => {
    const result = parseChatCompletionToolCall(completionWithToolCall('some_other_tool', { a: 1 }));
    expect(result).toEqual({ findings: [], recommendation: 'ESCALATE', confidence: 0 });
  });

  it('falls back to a safe ESCALATE result when no tool call is present (e.g. content filtered)', () => {
    const result = parseChatCompletionToolCall(completionWithoutToolCall());
    expect(result).toEqual({ findings: [], recommendation: 'ESCALATE', confidence: 0 });
  });
});
