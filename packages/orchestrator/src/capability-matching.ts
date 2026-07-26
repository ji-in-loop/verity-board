/**
 * An actor may only see evidence for capabilities within its
 * `allowedCapabilities` patterns — enforced here, in code, at the boundary
 * where an ActorContext is assembled, never left to the model to respect.
 * Supported pattern forms: exact match, "namespace.*" wildcard, and
 * "namespace.read" (shorthand for read access to an entire namespace).
 */
export function matchesAllowedCapability(pattern: string, capability: string): boolean {
  if (pattern === capability) return true;
  if (pattern.endsWith('.*')) {
    return capability.startsWith(pattern.slice(0, -1));
  }
  if (pattern.endsWith('.read')) {
    const namespace = `${pattern.slice(0, -'.read'.length)}.`;
    return capability.startsWith(namespace);
  }
  return false;
}

export function isCapabilityAllowed(allowedPatterns: string[], capability: string): boolean {
  return allowedPatterns.some((pattern) => matchesAllowedCapability(pattern, capability));
}
