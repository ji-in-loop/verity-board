import OpenAI from 'openai';
import type { ActorContext, ActorSkill, ModelProvider } from '@verity-board/core';
import {
  buildSystemPrompt,
  buildUserMessage,
  reviewInputSchema,
  REVIEW_TOOL_NAME,
  REVIEW_TOOL_DESCRIPTION,
} from '@verity-board/model-adapter-shared';
import { parseChatCompletionToolCall } from './parse-response.js';

const DEFAULT_MODEL = 'gpt-4o-mini';

export interface OpenAiModelProviderOptions {
  apiKey?: string;
  /**
   * Point this at any OpenAI-compatible chat-completions endpoint — Azure
   * OpenAI, a local Ollama/vLLM/LM Studio server, or another enterprise
   * gateway — not just api.openai.com. This one adapter is what makes those
   * "any OpenAI-compatible provider" rather than requiring a bespoke adapter
   * per vendor.
   */
  baseURL?: string;
  model?: string;
}

/**
 * The only package permitted to depend on the `openai` SDK. Never imported
 * by core or orchestrator directly — see ADR-0003.
 */
export class OpenAiModelProvider implements ModelProvider {
  readonly id = 'openai';

  private readonly client: OpenAI;
  private readonly model: string;

  constructor(options: OpenAiModelProviderOptions = {}) {
    this.client = new OpenAI({
      apiKey: options.apiKey,
      baseURL: options.baseURL ?? process.env.VERITY_BOARD_OPENAI_BASE_URL,
    });
    this.model = options.model ?? process.env.VERITY_BOARD_OPENAI_MODEL ?? DEFAULT_MODEL;
  }

  async invokeActor(input: { actor: ActorSkill; context: ActorContext }, signal?: AbortSignal): Promise<unknown> {
    const { actor, context } = input;

    const response = await this.client.chat.completions.create(
      {
        model: this.model,
        messages: [
          { role: 'system', content: buildSystemPrompt(actor) },
          { role: 'user', content: buildUserMessage(context) },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: REVIEW_TOOL_NAME,
              description: REVIEW_TOOL_DESCRIPTION,
              parameters: reviewInputSchema,
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: REVIEW_TOOL_NAME } },
      },
      { signal },
    );

    return parseChatCompletionToolCall(response);
  }
}
