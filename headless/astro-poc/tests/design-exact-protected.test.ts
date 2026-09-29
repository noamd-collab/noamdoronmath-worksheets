/**
 * Exact-design release fence. These SHA-256 values were read from the verified
 * live baseline 8a098020, not from the redesigned candidate. They protect the
 * explicitly out-of-scope behavior/content while permitting presentation edits.
 * A future intentional content/engine migration must review this fence rather
 * than silently regenerate it to make a design-only change pass.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const read = (file: string) => readFileSync(join(root, file), 'utf8');

const protectedFiles: Record<string, string> = {
  'astro.config.mjs': 'f85dead2ee638d8010de960290886eb4801b2ea9d86388fee11ceaea00e937a3',
  'src/data/catalog.v1.json': '86748683d96c1364403c019832393c97b0e632de221bda3f7c16b80e2762b6fc',
  'src/lib/catalog/loadCatalog.ts': '1a5e54a4c19c016046202f3e0b9bb95203e58fe983dab5a27e6f261abfbc9d95',
  'src/lib/worksheetLinks.ts': '2169c47f408f6fcfd62dafb74ef21b19fff0fc64581e441ba2490aca8e867d91',
  'src/lib/conceptLoops.ts': 'b9e5a864e93b08e70fa7257dcf9d7fedae7dcb4cd5798996b7325d98575be53d',
  'src/components/ConceptLoop.astro': '12c0ec36ecf290acec5f3a20c5fd74532de522c0d9edd6711322d209851218f6',
  'src/components/HeroLoop.astro': '486aec832d80a8a27df4a120b5e97dc09cc41d37791989662bf5448261ffaa75',
  'src/components/TriangleAreaExplorer.astro': '9f68cbd1c15d95be86bdccd58ef6bed0c51d967a7f00731744a34d03524068f9',
  'src/lib/homePage.ts': '26a884245860716a5b6dd3aa6189c9d07fcd99e21dc50fca8cf70116a3ba67fb',
  'src/data/home-page.json': 'af14191d863d623cfb95e65f28ca258663d4b8be01a1ef07d520c8b1e47ff73b',
  'public/learning.html': 'ced06f94814182e633bc9b356a8262ecebd14513c5b74c7e2515e4e09ee62524',
  'public/noam-learning-config.js': '90228359e65a99300b7d5017ddc58edce650b0b1a403a13b40c22608330f4ca7',
  'public/noam-learning.js': '48f1f5c5b09569aa4ad3d6b3080932f1b8645ca7f0aa71aa904cede666b51bd0',
  'public/noam-learning-boot.js': 'ae5b25e29120dbeabcbe063a4054633d926554922092abdd06625a655c47d286',
  'public/noam-learning-auth-redirect.js': '8fcd0ee6ef88a5816bb220b5a23b63821b65d0b3574dbcbfdcda6fc73cc34147',
  'public/noam-learning-core.js': 'dcdf50b7448ca7e106ae6e433787018dab7ba9c55fe4d4118dfb71f85584f0b7',
  'src/pages/sitemap-index.xml.ts': 'a37b33d949ab71b22bb4672aa646bfd4233cc370874c931cf66602ee23ac08c8',
  'src/pages/sitemap-pages.xml.ts': '08fc6902c46261d6e259c04441ff26822bdb42ffaf380c570f1b40fffff073cf',
  'src/pages/sitemap-blog.xml.ts': '6e43bead2349fb12450625e9e825b612db4e4a601e0a12a6838ad061bb42f3f2',
};

describe('exact-design protected live-baseline boundaries', () => {
  for (const [file, expected] of Object.entries(protectedFiles)) {
    it(`preserves ${file}`, () => {
      assert.equal(sha256(readFileSync(join(root, file))), expected, `${file} is outside the approved presentation-only scope`);
    });
  }

  it('preserves the shared head exactly, including SEO, canonical, fonts and robots', () => {
    const head = read('src/layouts/BaseLayout.astro').match(/<head(?:\s[^>]*)?>[\s\S]*?<\/head>/i)?.[0];
    assert.ok(head, 'BaseLayout must retain its head');
    assert.equal(sha256(head), '65f5e584cd17c5628aca4bed33df42e6c13c5936ed4dba36e6a48a437329539e');
  });

  it('preserves viewer head and every existing script, including AI answers and storage', () => {
    const viewer = read('public/worksheet-viewer-noam.html');
    const head = viewer.match(/<head(?:\s[^>]*)?>[\s\S]*?<\/head>/i)?.[0];
    assert.ok(head, 'Viewer must retain its head');
    assert.equal(sha256(head), '7497944ebb6915e1bc9c751e50d73bbe0d552b9f4b6937be4f6c78f6370465d3');
    const scripts = [...viewer.matchAll(/<script\b[^>]*>[\s\S]*?<\/script>/gi)].map((match) => match[0]);
    const adapters = scripts.filter((script) => /^<script id="exact-viewer-adapter">/.test(script));
    // This one separately reviewed presentation adapter is the only addition
    // permitted. The original 13 blocks must remain byte-identical and in order.
    assert.equal(scripts.length, 14);
    assert.equal(adapters.length, 1, 'Only one explicitly marked presentation adapter is permitted');
    assert.equal(scripts.at(-1), adapters[0], 'The adapter must follow, not replace/interleave, the released scripts');
    const releasedScripts = scripts.slice(0, -1);
    assert.equal(releasedScripts.length, 13);
    assert.equal(sha256(JSON.stringify(releasedScripts)), 'edcb33b3f75f0bbd5f9b0f415578f98b887093948b43eeb8b340ac8fe1edf2d0');
  });

  it('keeps the canonical and published viewer copies in sync', () => {
    assert.equal(read('public/worksheet-viewer-noam.html'), readFileSync(join(root, '../../worksheet-viewer-noam.html'), 'utf8'));
  });
});
