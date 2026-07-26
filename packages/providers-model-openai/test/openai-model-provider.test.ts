import { describe, expect, it, vi } from 'vitest';
import type { ActorContext, ActorSkill } from '@verity-board/core';

const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  })),
}));

const { OpenAiModelProvider } = await import('../src/openai-model-provider.js');

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

function completionWithToolCall(args: unknown) {
  return {
    choices: [
      {
        message: {
          tool_calls: [
            { type: 'function', function: { name: 'submit_actor_review', arguments: JSON.stringify(args) } },
          ],
        },
      },
    ],
  };
}

describe('OpenAiModelProvider.invokeActor', () => {
  it('sends the actor prompt via a forced tool call and returns the parsed arguments', async () => {
    mockCreate.mockResolvedValueOnce(completionWithToolCall({ findings: [], recommendation: 'GO', confidence: 0.9 }));

    const provider = new OpenAiModelProvider({ apiKey: 'test-key' });
    const result = await provider.invokeActor({ actor, context });

    expect(result).toEqual({ findings: [], recommendation: 'GO', confidence: 0.9 });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const [request, options] = mockCreate.mock.calls[0];
    expect(request.tool_choice).toEqual({ type: 'function', function: { name: 'submit_actor_review' } });
    expect(request.messages[1].content).toContain('Checkout Platform Release 8.4');
    expect(options).toEqual({ signal: undefined });
  });

  it('threads the abort signal through to the SDK call', async () => {
    mockCreate.mockResolvedValueOnce(completionWithToolCall({}));

    const controller = new AbortController();
    const provider = new OpenAiModelProvider({ apiKey: 'test-key' });
    await provider.invokeActor({ actor, context }, controller.signal);

    const [, options] = mockCreate.mock.calls.at(-1)!;
    expect(options.signal).toBe(controller.signal);
  });

  it('returns a safe ESCALATE result when no tool call is present', async () => {
    mockCreate.mockResolvedValueOnce({ choices: [{ message: { tool_calls: undefined } }] });

    const provider = new OpenAiModelProvider({ apiKey: 'test-key' });
    const result = await provider.invokeActor({ actor, context });

    expect(result).toEqual({ findings: [], recommendation: 'ESCALATE', confidence: 0 });
  });
});
