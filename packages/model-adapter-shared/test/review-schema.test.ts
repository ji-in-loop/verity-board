import { describe, expect, it } from 'vitest';
import { reviewInputSchema, REVIEW_TOOL_NAME } from '../src/review-schema.js';

describe('reviewInputSchema', () => {
  it('requires findings, recommendation, and confidence at the top level', () => {
    expect(reviewInputSchema.required).toEqual(['findings', 'recommendation', 'confidence']);
  });

  it('is a plain JSON-Schema object usable by any provider tool/function format', () => {
    expect(reviewInputSchema.type).toBe('object');
    expect(reviewInputSchema.properties.findings.type).toBe('array');
  });

  it('exposes a stable tool name every adapter forces the model to call', () => {
    expect(REVIEW_TOOL_NAME).toBe('submit_actor_review');
  });
});
