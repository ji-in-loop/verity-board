import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  loadActorSkill,
  loadCommittee,
  loadPlaybook,
  loadDecisionPolicy,
  loadCatalog,
  ConfigValidationError,
} from '../src/loaders.js';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const read = (name: string) => readFileSync(join(fixturesDir, name), 'utf-8');

describe('loadActorSkill', () => {
  it('loads a well-formed actor YAML', () => {
    const actor = loadActorSkill(read('valid-actor.yaml'));
    expect(actor.id).toBe('sre-reviewer');
    expect(actor.criteria).toContain('rollback');
  });

  it('rejects an actor with no criteria, with a source-referencing error', () => {
    expect(() => loadActorSkill(read('invalid-actor-no-criteria.yaml'), 'invalid-actor-no-criteria.yaml')).toThrow(
      ConfigValidationError,
    );
  });

  it('rejects malformed YAML syntax rather than crashing uncontrolled', () => {
    expect(() => loadActorSkill('id: [unclosed', 'bad.yaml')).toThrow(ConfigValidationError);
  });
});

describe('loadCommittee', () => {
  it('loads a well-formed committee YAML with nested activation conditions', () => {
    const committee = loadCommittee(read('valid-committee.yaml'));
    expect(committee.actors.required).toContain('sre-reviewer');
    expect(committee.actors.conditional[0].actor).toBe('security-architect');
  });

  it('rejects humanApproval.required: false', () => {
    expect(() => loadCommittee(read('invalid-committee-approval-false.yaml'))).toThrow(
      ConfigValidationError,
    );
  });
});

describe('loadPlaybook', () => {
  it('loads a well-formed playbook YAML', () => {
    const playbook = loadPlaybook(read('valid-playbook.yaml'));
    expect(playbook.outcomeVocabulary).toEqual(['GO', 'CONDITIONAL_GO', 'NO_GO', 'ESCALATE']);
  });
});

describe('loadDecisionPolicy', () => {
  it('loads a well-formed policy YAML with ordered rules', () => {
    const policy = loadDecisionPolicy(read('valid-policy.yaml'));
    expect(policy.rules).toHaveLength(4);
    expect(policy.rules[0].result).toBe('NO_GO');
  });
});

describe('loadCatalog', () => {
  it('loads actors, committees, playbooks, and policies from a directory tree', () => {
    const catalog = loadCatalog(join(fixturesDir, 'catalog'));
    expect(catalog.actors.get('sre-reviewer')?.displayName).toBe('Site Reliability Engineer');
    expect(catalog.committees.get('production-readiness')).toBeDefined();
    expect(catalog.playbooks.get('production-readiness-playbook')).toBeDefined();
    expect(catalog.policies.get('production-readiness-policy')).toBeDefined();
  });
});
