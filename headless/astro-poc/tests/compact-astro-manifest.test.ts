import assert from 'node:assert/strict';
import test from 'node:test';
import { compactManifestStyleStrings } from '../scripts/lib/compact-astro-manifest.mjs';

const css = '.worksheet::before { content: "שלום  עם  רווחים\\n<script>"; }\r\n' + '/* exact bytes and legacy routes */'.repeat(7);
function fixture() {
  return {
    routes: [
      { routeData: { route: '/old/legacy/[id]', pattern: '^/old/([^/]+)$' }, styles: [{ type: 'inline', content: css }, { type: 'external', src: '/_astro/style.css' }] },
      { routeData: { route: '/noam-ai/native/[...asset]', prerender: false }, styles: [{ type: 'inline', content: css }, { type: 'inline', content: 'unique { color: red }' }] },
    ],
    assets: ['/noam-ai/manifests/old.json', '/noam-ai/native/G9-T85/a/noam-ai.json', '/legacy.pdf'],
    other: { [css]: 'a property name must stay a string', quoted: '"\\\r\nשלום', unchanged: [null, false, 0, 1.25] },
  };
}
function source(data: unknown) {
  return `// prefix unchanged\nfunction deserializeManifest(value) { return value; }\nconst manifest = deserializeManifest(${JSON.stringify(data)});\nexport { manifest };\n// suffix unchanged\n`;
}
async function load(code: string) {
  return (await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'))).manifest;
}

test('interns only repeated CSS while preserving the entire deserialized manifest and literal bytes', async () => {
  const original = source(fixture());
  const compact = compactManifestStyleStrings(original);
  assert.equal(compact.strings, 1);
  assert.equal(compact.references, 2);
  assert.ok(compact.savedBytes > 100);
  assert.equal(Buffer.byteLength(original) - Buffer.byteLength(compact.source), compact.savedBytes);
  const [before, after] = await Promise.all([load(original), load(compact.source)]);
  assert.deepEqual(after, before);
  assert.deepEqual(Buffer.from(after.routes[0].styles[0].content), Buffer.from(css));
  assert.ok(compact.source.startsWith('// prefix unchanged\nfunction deserializeManifest(value) { return value; }\n'));
  assert.ok(compact.source.endsWith('\nexport { manifest };\n// suffix unchanged\n'));
  assert.deepEqual(after.assets, fixture().assets);
});

test('does not remove unique styles, repeated non-CSS data, or small styles', () => {
  const data = fixture();
  data.routes[1].styles[0].content = '.other-unique {}';
  const input = source({ ...data, repeatedData: [css.repeat(2), css.repeat(2)], small: ['a{}', 'a{}'] });
  assert.deepEqual(compactManifestStyleStrings(input), { source: input, strings: 0, references: 0, savedBytes: 0 });
});

test('fails closed on an unfamiliar manifest shape, duplicate declaration, or generated-binding collision', () => {
  const valid = source(fixture());
  assert.throws(() => compactManifestStyleStrings('export const manifest = {};'), /Unsupported/);
  assert.throws(() => compactManifestStyleStrings(valid + valid), /Unsupported/);
  assert.throws(() => compactManifestStyleStrings(source({ assets: [] })), /routes array/);
  assert.throws(() => compactManifestStyleStrings(source({ routes: [{}] })), /styles array/);
  assert.throws(() => compactManifestStyleStrings(valid + '\nconst __noamManifestStyleStrings = [];'), /binding already exists/);
  assert.throws(() => compactManifestStyleStrings(compactManifestStyleStrings(valid).source), /binding already exists/);
});
