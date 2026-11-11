import assert from 'node:assert/strict';
import test from 'node:test';
import compactServerBuild from '../scripts/lib/compact-server-build.mjs';

async function renderer(target: 'server' | 'client') {
  let config: any;
  await compactServerBuild().hooks['astro:build:setup']!({
    target, updateConfig: (value: unknown) => { config = value; },
  } as any);
  return config?.plugins[0].renderChunk;
}

test('server compaction preserves Hebrew, literal whitespace, arithmetic and function names', async () => {
  const render = await renderer('server');
  const source = `
    // Formatting outside string literals can be removed from deployment files.
    export const caption = 'תשובה: 6 עשרות, 12 אחדות';
    export const markup = '<span dir="rtl">שתי  מילים</span>\\n';
    export const raw = String.raw\`  א\\nב  \`;
    export function calculateTotal(first, second) {
      return first + second;
    }
    export const subtractValues = (first, second) => first - second;
    export class WorksheetResult {
      label() { return caption; }
    }
    export default function renderWorksheet() { return markup; }
  `;
  const result = await render(source, { fileName: 'chunks/worksheet_test.mjs' });
  const load = (code: string) => import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
  const [original, compact] = await Promise.all([load(source), load(result.code)]);
  const values = (module: any) => ({
    caption: module.caption, markup: module.markup, raw: module.raw,
    total: module.calculateTotal(452, -137), difference: module.subtractValues(12, 5),
    names: [module.calculateTotal.name, module.subtractValues.name, module.WorksheetResult.name, module.default.name],
    rendered: module.default(), label: new module.WorksheetResult().label(),
  });
  assert.deepEqual(values(compact), values(original));
  assert.ok(result.code.includes('תשובה'), 'Hebrew must remain UTF-8 rather than grow into ASCII escapes');
  assert.ok(Buffer.byteLength(result.code) < Buffer.byteLength(source));
});

test('manifest remains byte-identical for verified SVG pruning and client config is untouched', async () => {
  const render = await renderer('server');
  const manifest = 'const manifest = deserializeManifest({"assets":["/noam-ai/native/example.svg"]});';
  assert.equal(await render(manifest, { fileName: 'manifest_abc123.mjs' }), null);
  assert.equal(await renderer('client'), undefined);
});
