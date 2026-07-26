import Anthropic from '@anthropic-ai/sdk';
import type { ActorContext, ActorSkill, ModelProvider } from '@verity-board/core';
import { reviewTool, REVIEW_TOOL_NAME } from './review-tool.js';
import { buildSystemPrompt, buildUserMessage } from '@verity-board/model-adapter-shared';

const DEFAULT_MODEL = 'claude-sonnet-5';

export interface AnthropicModelProviderOptions {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
}

/**
 * The only package permitted to depend on @anthropic-ai/sdk (see ADR-0003).
 * Never imported by core or orchestrator directly.
 */
export class AnthropicModelProvider implements ModelProvider {
  readonly id = 'anthropic';

  private readonly client: Anthropic;
  private readonly model: string;
  private readonly maxTokens: number;

  constructor(options: AnthropicModelProviderOptions = {}) {
    this.client = new Anthropic(options.apiKey ? { apiKey: options.apiKey } : {});
    this.model = options.model ?? process.env.VERITY_BOARD_ANTHROPIC_MODEL ?? DEFAULT_MODEL;
    this.maxTokens = options.maxTokens ?? 4096;
  }

  async invokeActor(input: { actor: ActorSkill; context: ActorContext }): Promise<unknown> {
    const { actor, context } = input;

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      system: buildSystemPrompt(actor),
      messages: [{ role: 'user', content: buildUserMessage(context) }],
      tools: [reviewTool],
      tool_choice: { type: 'tool', name: REVIEW_TOOL_NAME },
    });

    if (response.stop_reason === 'refusal') {
      return { findings: [], recommendation: 'ESCALATE', confidence: 0 };
    }

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
    );
    return toolUse?.input ?? {};
  }
}
