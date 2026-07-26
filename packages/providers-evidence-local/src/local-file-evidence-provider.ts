import { readFileSync, existsSync } from 'node:fs';
import { join, resolve as resolvePath, extname } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { Evidence, EvidenceProvider, EvidenceRequest } from '@verity-board/core';
import { EvidenceMappingFileSchema, type EvidenceMappingEntry } from './mapping.js';

function slug(...parts: string[]): string {
  return `ev-${parts.join(':')}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseFacts(text: string, extension: string): Record<string, unknown> {
  if (extension === '.json') {
    const parsed = JSON.parse(text);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : { value: parsed };
  }
  if (extension === '.yaml' || extension === '.yml') {
    const parsed = parseYaml(text);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : { value: parsed };
  }
  return { raw: text };
}

export class LocalFileEvidenceProvider implements EvidenceProvider {
  readonly id = 'local-file';

  private readonly caseDir: string;
  private readonly entries: EvidenceMappingEntry[];

  constructor(caseDir: string) {
    this.caseDir = resolvePath(caseDir);
    const mappingPath = join(this.caseDir, 'evidence-mapping.yaml');
    if (!existsSync(mappingPath)) {
      throw new Error(`No evidence-mapping.yaml found in case directory: ${this.caseDir}`);
    }
    const raw = parseYaml(readFileSync(mappingPath, 'utf-8'));
    this.entries = EvidenceMappingFileSchema.parse(raw).evidence;
  }

  private readCaseFile(relativeFile: string): string {
    const resolved = resolvePath(this.caseDir, relativeFile);
    if (!resolved.startsWith(this.caseDir)) {
      throw new Error(
        `Evidence mapping referenced a file outside the case directory: ${relativeFile}`,
      );
    }
    return readFileSync(resolved, 'utf-8');
  }

  async resolve(request: EvidenceRequest, signal?: AbortSignal): Promise<Evidence> {
    // File reads here are synchronous, so there's no in-flight work to
    // cancel mid-call — but an already-aborted signal (a timeout that fired
    // while this request was queued) should still short-circuit rather than
    // do the read and throw the result away.
    signal?.throwIfAborted();

    const matches = this.entries.filter((entry) => entry.capability === request.capability);
    const entry =
      matches.find((candidate) => candidate.subject === request.subject) ?? matches[0];

    if (!entry) {
      return {
        evidenceId: slug(request.capability, request.subject),
        capability: request.capability,
        subject: request.subject,
        status: 'MISSING',
        summary: `No evidence was supplied for capability "${request.capability}" (subject: ${request.subject}).`,
        facts: {},
        provenance: {
          provider: this.id,
          sourceRef: this.caseDir,
          retrievedAt: new Date().toISOString(),
        },
        freshness: { isStale: false },
        classification: 'internal',
      };
    }

    const facts = entry.file ? parseFacts(this.readCaseFile(entry.file), extname(entry.file)) : {};

    return {
      evidenceId: slug(entry.capability, entry.subject),
      capability: entry.capability,
      subject: entry.subject,
      status: entry.status,
      summary: entry.summary,
      facts,
      provenance: {
        provider: this.id,
        sourceRef: entry.file ?? '<declared, no file>',
        retrievedAt: new Date().toISOString(),
      },
      freshness: { asOf: entry.asOf, isStale: entry.isStale },
      classification: entry.classification,
    };
  }
}
