import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const root = new URL('../../../../', import.meta.url), require = createRequire(import.meta.url);
const { loadRamziActivationEvidence, validateRamziActivation } = require('../../../../scripts/lib/worksheet-ramzi-activation.cjs');

/** Both permitted phases retain the whole corpus. Active flags require actual,
 * exact-byte on-disk receipts and all twelve native/manifest pairs first. */
export function readFirst567Activation() {
  const registry = JSON.parse(readFileSync(new URL('headless/catalog/worksheet-editions.v1.json', root), 'utf8'));
  const evidence = loadRamziActivationEvidence(fileURLToPath(new URL('headless/catalog/', root)), fileURLToPath(new URL('headless/astro-poc/public/', root)));
  const ramzi = validateRamziActivation(registry, evidence);
  const ready = evidence?.ready;
  const units = new Map<string, any>((ready?.units || []).map((unit: any) => [unit.pdfId, unit]));
  return { ready, units, ramzi };
}
export function assertFirst567Phase(manifest: any, bytes: Buffer, phase: ReturnType<typeof readFirst567Activation>) {
  const active = phase.ready !== undefined;
  assert.equal(manifest.publishable, active);
  assert.equal(manifest.reviewRequired, !active);
  assert.equal(manifest.nativeExportPublished, active);
  if (active) {
    const unit = phase.units.get(manifest.pdfHash);
    assert.ok(unit, 'active manifest must be one of the twelve verified units');
    assert.equal(createHash('sha256').update(bytes).digest('hex'), unit.manifestSha256, 'root/public manifest bytes match the reviewed receipt');
  }
}
