import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolveModelProvider, UnknownModelProviderError, MockFixturesUnavailableError } from '../src/model-providers.js';
import { MockModelProvider } from '@verity-board/providers-model-mock';
import { AnthropicModelProvider } from '@verity-board/providers-model-anthropic';
import { OpenAiModelProvider } from '@verity-board/providers-model-openai';
import { GeminiModelProvider } from '@verity-board/providers-model-gemini';
import { CHECKOUT_RELEASE_CASE_ID } from '../src/mock-fixtures/checkout-release.js';

describe('resolveModelProvider', () => {
  // The openai SDK throws at construction time if no API key is available
  // anywhere (option or env). Set fake credentials so resolving "openai"
  // exercises the same registry path a real run would, without needing a
  // live key — invokeActor is never called here, so no network request happens.
  const previousOpenAiKey = process.env.OPENAI_API_KEY;

  beforeAll(() => {
    process.env.OPENAI_API_KEY = 'test-key';
  });

  afterAll(() => {
    if (previousOpenAiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousOpenAiKey;
  });

  it('resolves "mock" to a MockModelProvider for the bundled checkout-release case', () => {
    const provider = resolveModelProvider('mock', CHECKOUT_RELEASE_CASE_ID);
    expect(provider).toBeInstanceOf(MockModelProvider);
  });

  it('throws MockFixturesUnavailableError when "mock" is requested for an unfixtured case', () => {
    expect(() => resolveModelProvider('mock', 'some-other-case')).toThrow(
      MockFixturesUnavailableError,
    );
  });

  it('resolves "anthropic" to an AnthropicModelProvider', () => {
    expect(resolveModelProvider('anthropic', CHECKOUT_RELEASE_CASE_ID)).toBeInstanceOf(
      AnthropicModelProvider,
    );
  });

  it('resolves "openai" to an OpenAiModelProvider', () => {
    expect(resolveModelProvider('openai', CHECKOUT_RELEASE_CASE_ID)).toBeInstanceOf(
      OpenAiModelProvider,
    );
  });

  it('resolves "gemini" to a GeminiModelProvider', () => {
    expect(resolveModelProvider('gemini', CHECKOUT_RELEASE_CASE_ID)).toBeInstanceOf(
      GeminiModelProvider,
    );
  });

  it('throws UnknownModelProviderError for an unregistered id, listing the registered ones', () => {
    expect(() => resolveModelProvider('bogus-provider', CHECKOUT_RELEASE_CASE_ID)).toThrow(
      UnknownModelProviderError,
    );
    try {
      resolveModelProvider('bogus-provider', CHECKOUT_RELEASE_CASE_ID);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(UnknownModelProviderError);
      expect((error as Error).message).toContain('mock');
      expect((error as Error).message).toContain('anthropic');
      expect((error as Error).message).toContain('openai');
      expect((error as Error).message).toContain('gemini');
    }
  });
});
