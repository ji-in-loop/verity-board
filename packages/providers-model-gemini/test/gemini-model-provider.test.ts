import { describe, expect, it, vi } from 'vitest';
import type { ActorContext, ActorSkill } from '@verity-board/core';

const { mockGenerateContent } = vi.hoisted(() => ({ mockGenerateContent: vi.fn() }));

vi.mock('@google/genai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@google/genai')>();
  return {
    ...actual,
    GoogleGenAI: vi.fn().mockImplementation(() => ({
      models: { generateContent: mockGenerateContent },
    })),
  };
});

const { GeminiModelProvider } = await import('../src/gemini-model-provider.js');

const actor: ActorSkill = {
  id: 'sre-reviewer',
  version: 1,
  displayName: 'Site Reliability Engineer',
  mandate: ['Assess operational readiness'],
  criteria: ['availability', 'rollback'],
  requiredCapabilities: ['deployment.rollback_validation'],
  allowedCapabilities: ['deployment.read'],
  questionLimits: { maximumQuestions: 3, maximumEvidenceRequests: 5 },
  authority: { blockerCategories: ['reliability', 'rollback'] },
  outputSchema: 'actor-review.v1',
};

const context: ActorContext = {
  reviewCase: {
    id: 'checkout-release-8.4',
    title: 'Checkout Platform Release 8.4',
    description: 'Adds saved-payment-method support.',
    application: { id: 'checkout-service', name: 'Checkout Service' },
    riskClassification: 'high',
    submittedArtifacts: [],
    evidenceReferences: [],
    requestingTeam: 'Checkout Platform',
    humanDecisionOwner: 'Release Director',
    attributes: {},
  },
  evidence: [],
  mandate: actor.mandate,
  criteria: actor.criteria,
  round: 1,
};

describe('GeminiModelProvider.invokeActor', () => {
  it('sends the actor prompt via a forced function call and returns the parsed args', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      functionCalls: [{ name: 'submit_actor_review', args: { findings: [], recommendation: 'GO', confidence: 0.9 } }],
    });

    const provider = new GeminiModelProvider({ apiKey: 'test-key' });
    const result = await provider.invokeActor({ actor, context });

    expect(result).toEqual({ findings: [], recommendation: 'GO', confidence: 0.9 });
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    const [request] = mockGenerateContent.mock.calls[0];
    expect(request.config.toolConfig.functionCallingConfig.mode).toBe('ANY');
    expect(request.config.toolConfig.functionCallingConfig.allowedFunctionNames).toEqual([
      'submit_actor_review',
    ]);
    expect(request.contents).toContain('Checkout Platform Release 8.4');
    expect(request.config.abortSignal).toBeUndefined();
  });

  it('threads the abort signal through to the SDK call', async () => {
    mockGenerateContent.mockResolvedValueOnce({ functionCalls: [] });

    const controller = new AbortController();
    const provider = new GeminiModelProvider({ apiKey: 'test-key' });
    await provider.invokeActor({ actor, context }, controller.signal);

    const [request] = mockGenerateContent.mock.calls.at(-1)!;
    expect(request.config.abortSignal).toBe(controller.signal);
  });

  it('returns a safe ESCALATE result when no function call is present', async () => {
    mockGenerateContent.mockResolvedValueOnce({ functionCalls: undefined });

    const provider = new GeminiModelProvider({ apiKey: 'test-key' });
    const result = await provider.invokeActor({ actor, context });

    expect(result).toEqual({ findings: [], recommendation: 'ESCALATE', confidence: 0 });
  });
});
