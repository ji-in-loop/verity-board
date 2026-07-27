import { describe, expect, it } from 'vitest';
import { matchesAllowedCapability, isCapabilityAllowed } from '../src/capability-matching.js';

describe('matchesAllowedCapability', () => {
  it('matches an exact capability', () => {
    expect(matchesAllowedCapability('deployment.rollback_validation', 'deployment.rollback_validation')).toBe(true);
  });

  it('matches a "namespace.*" wildcard', () => {
    expect(matchesAllowedCapability('deployment.*', 'deployment.rollback_validation')).toBe(true);
  });

  it('rejects a "namespace.*" wildcard for a different namespace', () => {
    expect(matchesAllowedCapability('deployment.*', 'testing.integration_results')).toBe(false);
  });

  it('matches a "namespace.read" shorthand against any capability in that namespace', () => {
    expect(matchesAllowedCapability('deployment.read', 'deployment.rollback_validation')).toBe(true);
  });

  it('rejects a "namespace.read" shorthand for a different namespace', () => {
    expect(matchesAllowedCapability('deployment.read', 'testing.integration_results')).toBe(false);
  });

  it('rejects a capability that matches none of exact/wildcard/read-shorthand', () => {
    expect(matchesAllowedCapability('deployment.rollback_validation', 'testing.integration_results')).toBe(false);
  });
});

describe('isCapabilityAllowed', () => {
  it('returns true when any allowed pattern matches', () => {
    expect(
      isCapabilityAllowed(['testing.*', 'deployment.read'], 'deployment.rollback_validation'),
    ).toBe(true);
  });

  it('returns false when no allowed pattern matches', () => {
    expect(isCapabilityAllowed(['testing.*'], 'deployment.rollback_validation')).toBe(false);
  });

  it('returns false for an empty allow-list', () => {
    expect(isCapabilityAllowed([], 'deployment.rollback_validation')).toBe(false);
  });
});
