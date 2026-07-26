import { GoogleGenAI, FunctionCallingConfigMode } from '@google/genai';
import type { ActorContext, ActorSkill, ModelProvider } from '@verity-board/core';
import {
  buildSystemPrompt,
  buildUserMessage,
  reviewInputSchema,
  REVIEW_TOOL_NAME,
  REVIEW_TOOL_DESCRIPTION,
} from '@verity-board/model-adapter-shared';
import { parseGenerateContentFunctionCall } from './parse-response.js';

const DEFAULT_MODEL = 'gemini-2.5-flash';

export interface GeminiModelProviderOptions {
  apiKey?: string;
  model?: string;
}

/**
 * The only package permitted to depend on @google/genai. Never imported by
 * core or orchestrator directly — see ADR-0003.
 */
export class GeminiModelProvider implements ModelProvider {
  readonly id = 'gemini';

  private readonly client: GoogleGenAI;
  private readonly model: string;

  constructor(options: GeminiModelProviderOptions = {}) {
    this.client = new GoogleGenAI(options.apiKey ? { apiKey: options.apiKey } : {});
    this.model = options.model ?? process.env.VERITY_BOARD_GEMINI_MODEL ?? DEFAULT_MODEL;
  }

  async invokeActor(input: { actor: ActorSkill; context: ActorContext }): Promise<unknown> {
    const { actor, context } = input;

    const response = await this.client.models.generateContent({
      model: this.model,
      contents: buildUserMessage(context),
      config: {
        systemInstruction: buildSystemPrompt(actor),
        toolConfig: {
          functionCallingConfig: {
            mode: FunctionCallingConfigMode.ANY,
            allowedFunctionNames: [REVIEW_TOOL_NAME],
          },
        },
        tools: [
          {
            functionDeclarations: [
              {
                name: REVIEW_TOOL_NAME,
                description: REVIEW_TOOL_DESCRIPTION,
                parametersJsonSchema: reviewInputSchema,
              },
            ],
          },
        ],
      },
    });

    return parseGenerateContentFunctionCall(response);
  }
}
