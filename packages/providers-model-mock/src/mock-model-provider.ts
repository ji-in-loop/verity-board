import type { ActorContext, ActorSkill, ModelProvider } from '@verity-board/core';

export interface MockActorOutput {
  findings: unknown[];
  unknowns?: string[];
  clarificationQuestions?: unknown[];
  recommendation: string;
  confidence: number;
}

export type MockFixtureFn = (
  context: ActorContext,
  signal?: AbortSignal,
) => MockActorOutput | Promise<MockActorOutput>;

/**
 * Deterministic, network-free ModelProvider: a pure function of
 * (actor.id, context) to a fixed output, keyed by fixture. Default and only
 * provider exercised in automated tests and the bundled example — see
 * docs/phase-0/08-testing-strategy.md.
 */
export class MockModelProvider implements ModelProvider {
  readonly id = 'mock';

  constructor(private readonly fixtures: Record<string, MockFixtureFn>) {}

  async invokeActor(input: { actor: ActorSkill; context: ActorContext }, signal?: AbortSignal): Promise<unknown> {
    const fixture = this.fixtures[input.actor.id];
    if (!fixture) {
      throw new Error(
        `MockModelProvider has no fixture registered for actor "${input.actor.id}". ` +
          'Register one explicitly — the mock provider never improvises a response.',
      );
    }
    return fixture(input.context, signal);
  }
}
