import { describe, expect, it, vi } from 'vitest';
import type { ActorContext, ActorSkill } from '@verity-board/core';

const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}));

const { AnthropicModelProvider } = await import('../src/anthropic-model-provider.js');

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

describe('AnthropicModelProvider.invokeActor', () => {
  it('sends the actor prompt via a forced tool call and returns the tool input', async () => {
    mockCreate.mockResolvedValueOnce({
      stop_reason: 'tool_use',
      content: [{ type: 'tool_use', name: 'submit_actor_review', input: { findings: [], recommendation: 'GO', confidence: 0.9 } }],
    });

    const provider = new AnthropicModelProvider({ apiKey: 'test-key' });
    const result = await provider.invokeActor({ actor, context });

    expect(result).toEqual({ findings: [], recommendation: 'GO', confidence: 0.9 });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const [request, options] = mockCreate.mock.calls[0];
    expect(request.tool_choice).toEqual({ type: 'tool', name: 'submit_actor_review' });
    expect(request.messages[0].content).toContain('Checkout Platform Release 8.4');
    expect(options).toEqual({ signal: undefined });
  });

  it('threads the abort signal through to the SDK call', async () => {
    mockCreate.mockResolvedValueOnce({
      stop_reason: 'tool_use',
      content: [{ type: 'tool_use', name: 'submit_actor_review', input: {} }],
    });

    const controller = new AbortController();
    const provider = new AnthropicModelProvider({ apiKey: 'test-key' });
    await provider.invokeActor({ actor, context }, controller.signal);

    const [, options] = mockCreate.mock.calls.at(-1)!;
    expect(options.signal).toBe(controller.signal);
  });

  it('returns a safe ESCALATE result when Claude refuses', async () => {
    mockCreate.mockResolvedValueOnce({ stop_reason: 'refusal', content: [] });

    const provider = new AnthropicModelProvider({ apiKey: 'test-key' });
    const result = await provider.invokeActor({ actor, context });

    expect(result).toEqual({ findings: [], recommendation: 'ESCALATE', confidence: 0 });
  });

  it('returns an empty object when no tool_use block is present', async () => {
    mockCreate.mockResolvedValueOnce({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'no tool call' }] });

    const provider = new AnthropicModelProvider({ apiKey: 'test-key' });
    const result = await provider.invokeActor({ actor, context });

    expect(result).toEqual({});
  });
});
