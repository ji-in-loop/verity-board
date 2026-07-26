import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import {
  ActorSkillSchema,
  CommitteeSchema,
  PlaybookSchema,
  DecisionPolicySchema,
  ReviewCaseSchema,
  type ActorSkill,
  type Committee,
  type Playbook,
  type DecisionPolicy,
  type ReviewCase,
} from '@verity-board/core';

export class ConfigValidationError extends Error {
  constructor(
    public readonly sourceRef: string,
    cause: unknown,
  ) {
    super(`Invalid configuration in ${sourceRef}: ${String(cause)}`);
  }
}

function parseYamlOrThrow(text: string, sourceRef: string): unknown {
  try {
    return parse(text);
  } catch (cause) {
    throw new ConfigValidationError(sourceRef, cause);
  }
}

function validateOrThrow<T>(schema: { parse: (v: unknown) => T }, raw: unknown, sourceRef: string): T {
  try {
    return schema.parse(raw);
  } catch (cause) {
    throw new ConfigValidationError(sourceRef, cause);
  }
}

export function loadActorSkill(yamlText: string, sourceRef = '<inline>'): ActorSkill {
  return validateOrThrow(ActorSkillSchema, parseYamlOrThrow(yamlText, sourceRef), sourceRef);
}

export function loadCommittee(yamlText: string, sourceRef = '<inline>'): Committee {
  return validateOrThrow(CommitteeSchema, parseYamlOrThrow(yamlText, sourceRef), sourceRef);
}

export function loadPlaybook(yamlText: string, sourceRef = '<inline>'): Playbook {
  return validateOrThrow(PlaybookSchema, parseYamlOrThrow(yamlText, sourceRef), sourceRef);
}

export function loadDecisionPolicy(yamlText: string, sourceRef = '<inline>'): DecisionPolicy {
  return validateOrThrow(DecisionPolicySchema, parseYamlOrThrow(yamlText, sourceRef), sourceRef);
}

export function loadReviewCase(yamlText: string, sourceRef = '<inline>'): ReviewCase {
  return validateOrThrow(ReviewCaseSchema, parseYamlOrThrow(yamlText, sourceRef), sourceRef);
}

export function loadReviewCaseFromCaseDir(caseDir: string): ReviewCase {
  const path = join(caseDir, 'review-request.yaml');
  return loadReviewCase(readFileSync(path, 'utf-8'), path);
}

function readYamlFilesIn(dir: string): { text: string; path: string }[] {
  return readdirSync(dir)
    .filter((name: string) => name.endsWith('.yaml') || name.endsWith('.yml'))
    .map((name: string) => {
      const path = join(dir, name);
      return { text: readFileSync(path, 'utf-8'), path };
    });
}

export interface Catalog {
  actors: Map<string, ActorSkill>;
  committees: Map<string, Committee>;
  playbooks: Map<string, Playbook>;
  policies: Map<string, DecisionPolicy>;
}

/**
 * Loads a catalog directory shaped as:
 *   <dir>/actors/*.yaml
 *   <dir>/committees/*.yaml
 *   <dir>/playbooks/*.yaml
 *   <dir>/policies/*.yaml
 */
export function loadCatalog(catalogDir: string): Catalog {
  const actors = new Map<string, ActorSkill>();
  for (const { text, path } of readYamlFilesIn(join(catalogDir, 'actors'))) {
    const actor = loadActorSkill(text, path);
    actors.set(actor.id, actor);
  }

  const committees = new Map<string, Committee>();
  for (const { text, path } of readYamlFilesIn(join(catalogDir, 'committees'))) {
    const committee = loadCommittee(text, path);
    committees.set(committee.id, committee);
  }

  const playbooks = new Map<string, Playbook>();
  for (const { text, path } of readYamlFilesIn(join(catalogDir, 'playbooks'))) {
    const playbook = loadPlaybook(text, path);
    playbooks.set(playbook.id, playbook);
  }

  const policies = new Map<string, DecisionPolicy>();
  for (const { text, path } of readYamlFilesIn(join(catalogDir, 'policies'))) {
    const policy = loadDecisionPolicy(text, path);
    policies.set(policy.id, policy);
  }

  return { actors, committees, playbooks, policies };
}
