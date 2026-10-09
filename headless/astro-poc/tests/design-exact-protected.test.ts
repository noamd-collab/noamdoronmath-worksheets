/**
 * Exact-design release fence. These SHA-256 values were read from the verified
 * live baseline 8a098020, not from the redesigned candidate. They protect the
 * explicitly out-of-scope behavior/content while permitting presentation edits.
 * A future intentional content/engine migration must review this fence rather
 * than silently regenerate it to make a design-only change pass.
 * conceptLoops.ts and ConceptLoop.astro moved when L01 angle-sum was removed
 * and replaced by the vertex-descent film. That was an explicit content change.
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
  'src/lib/worksheetLinks.ts': '1f9a5fdf234997fc8ba7593d1ef0066f082586816770eefc45da40035a825eaf',
  'src/lib/conceptLoops.ts': 'b78a1945395cd9239942952c806014f16138accf47a2768f5e8acf73e38e03a1',
  'src/components/ConceptLoop.astro': '37c06f29131a44c5b3c670cd1ad28206d4f5e850ff39f5b3cd3ab63df59ca391',
  // HeroLoop.astro is the homepage shell (which loops are emitted). The engine
  // above stays byte-identical; the home hero may lazy-load existing loops.
  'src/components/TriangleAreaExplorer.astro': '9f68cbd1c15d95be86bdccd58ef6bed0c51d967a7f00731744a34d03524068f9',
  'src/lib/homePage.ts': '26a884245860716a5b6dd3aa6189c9d07fcd99e21dc50fca8cf70116a3ba67fb',
  'src/data/home-page.json': 'af14191d863d623cfb95e65f28ca258663d4b8be01a1ef07d520c8b1e47ff73b',
  'public/learning.html': 'ced06f94814182e633bc9b356a8262ecebd14513c5b74c7e2515e4e09ee62524',
  'public/noam-learning-config.js': '90228359e65a99300b7d5017ddc58edce650b0b1a403a13b40c22608330f4ca7',
  // Lazy Supabase: guest learning no longer downloads the SDK. Google sign-in
  // and an existing session still load it, then recreate the engine.
  'public/noam-learning.js': '50866c6d2e8824b8dd89e5e8b00c2e55c0f1636d4a56dbed2e73928c7eef9a18',
  'public/noam-learning-boot.js': '8a4976b19a32a4e1820b4c8aa391004973988a3126337fe2b3355406220d8cd1',
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
    // SEO cut-over (issue): one title/description/canonical, full OG+Twitter,
    // and a wider Wix-duplicate strip. Reviewed on purpose; not a design tweak.
    assert.equal(sha256(head), 'a45f17779ad3e7270a995c9655cd252f193da079d57db7bd6ce24ab831a97b00');
  });

  it('preserves viewer head and every existing script, including AI answers and storage', () => {
    const viewer = read('public/worksheet-viewer-noam.html');
    const head = viewer.match(/<head(?:\s[^>]*)?>[\s\S]*?<\/head>/i)?.[0];
    assert.ok(head, 'Viewer must retain its head');
    // Google Fonts link removed; Heebo woff2 is preloaded from /fonts.
    assert.equal(sha256(head), '8c842de3e2b55e15a454fd1fabbc31794baeffaaf8b939d3a1bccd7cc586b462');
    const scripts = [...viewer.matchAll(/<script\b[^>]*>[\s\S]*?<\/script>/gi)].map((match) => match[0]);
    const adapters = scripts.filter((script) => /^<script id="exact-viewer-adapter">/.test(script));
    const companion = scripts.filter((script) => /noam-site-companion\.js/.test(script));
    // One presentation adapter follows the released blocks. ramzi-avatar.js
    // is a released script. The site companion is one extra external script
    // after that adapter, so the released blocks stay byte-identical.
    assert.equal(scripts.length, 16);
    assert.equal(adapters.length, 1, 'Only one explicitly marked presentation adapter is permitted');
    assert.equal(companion.length, 1, 'The site companion is the one added launcher script');
    assert.equal(scripts.at(-2), adapters[0], 'The adapter must follow, not replace/interleave, the released scripts');
    assert.equal(scripts.at(-1), companion[0], 'The companion script follows the adapter and does not replace it');
    const releasedScripts = scripts.slice(0, -2);
    assert.equal(releasedScripts.length, 14);
    assert.equal(sha256(JSON.stringify(releasedScripts)), 'fd137a04d4e89748d6c95b67ca71ab3274408bd71865413940699e0392276c52');
  });

  it('keeps Headless viewer adapters without rewriting the GitHub Pages root viewer', () => {
    const headless = read('public/worksheet-viewer-noam.html');
    const githubPages = readFileSync(join(root, '../../worksheet-viewer-noam.html'), 'utf8');
    assert.match(headless, /onHeadlessHost/);
    assert.match(headless, /exact-viewer-adapter/);
    assert.match(headless, /href="\/worksheets"/);
    assert.doesNotMatch(
      headless,
      /exact-viewer-header[\s\S]*href="https:\/\/www\.noamdoronmath\.co\.il\/"/
    );
    // GitHub Pages root copy stays production-oriented and is not part of this port.
    assert.doesNotMatch(githubPages, /onHeadlessHost/);
    assert.match(githubPages, /exact-viewer-adapter/);
  });
});
