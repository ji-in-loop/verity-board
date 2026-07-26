import type { ModelProvider } from '@verity-board/core';
import { MockModelProvider } from '@verity-board/providers-model-mock';
import { AnthropicModelProvider } from '@verity-board/providers-model-anthropic';
import { OpenAiModelProvider } from '@verity-board/providers-model-openai';
import { GeminiModelProvider } from '@verity-board/providers-model-gemini';
import { CHECKOUT_RELEASE_CASE_ID, checkoutReleaseFixtures } from './mock-fixtures/checkout-release.js';

export class UnknownModelProviderError extends Error {}
export class MockFixturesUnavailableError extends Error {}

/**
 * One entry per model provider. Adding a new vendor (or an OpenAI-compatible
 * enterprise gateway, which just needs different env vars — see
 * providers-model-openai's baseURL option) is exactly this: one new adapter
 * package plus one line here. Nothing in core or orchestrator changes — see
 * ADR-0003.
 */
const modelProviderRegistry: Record<string, (reviewCaseId: string) => ModelProvider> = {
  mock: (reviewCaseId) => {
    if (reviewCaseId !== CHECKOUT_RELEASE_CASE_ID) {
      throw new MockFixturesUnavailableError(
        `No mock fixtures are registered for case "${reviewCaseId}". ` +
          'The bundled mock provider only knows the checkout-release example. ' +
          'Pass --model <anthropic|openai|gemini> to review a different case with a real model.',
      );
    }
    return new MockModelProvider(checkoutReleaseFixtures);
  },
  anthropic: () => new AnthropicModelProvider(),
  openai: () => new OpenAiModelProvider(),
  gemini: () => new GeminiModelProvider(),
};

export function resolveModelProvider(modelId: string, reviewCaseId: string): ModelProvider {
  const factory = modelProviderRegistry[modelId];
  if (!factory) {
    throw new UnknownModelProviderError(
      `Unknown model provider "${modelId}". Available: ${Object.keys(modelProviderRegistry).join(', ')}.`,
    );
  }
  return factory(reviewCaseId);
}
