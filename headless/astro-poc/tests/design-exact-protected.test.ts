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
  'src/lib/worksheetLinks.ts': '1f9a5fdf234997fc8ba7593d1ef0066f082586816770eefc45da40035a825eaf',
  'src/lib/conceptLoops.ts': 'b9e5a864e93b08e70fa7257dcf9d7fedae7dcb4cd5798996b7325d98575be53d',
  // Fence reviewed 2026-10-03 against merged, approved PRs (not regenerated blindly):
  // ConceptLoop copy/labels/fractions from PR #41 (incl. PR #40) and PR #50.
  'src/components/ConceptLoop.astro': '4fc2e8948eed7e32714c32382602d511e7d1e06742e129bca7b413183d841199',
  // HeroLoop.astro is the homepage shell (which loops are emitted). The engine
  // above stays byte-identical; the home hero may lazy-load existing loops.
  // One readout line only: S = (a · h) : 2 school notation, PR #40 via PR #41.
  'src/components/TriangleAreaExplorer.astro': 'b2760424b5735dcf4340e5fe95aa306d19e2dd7043e841c5d12092c0fa6a01b6',
  'src/lib/homePage.ts': '26a884245860716a5b6dd3aa6189c9d07fcd99e21dc50fca8cf70116a3ba67fb',
  'src/data/home-page.json': 'af14191d863d623cfb95e65f28ca258663d4b8be01a1ef07d520c8b1e47ff73b',
  // Head only: favicon/manifest/theme-color tags (b7eab08), merged with PR #34 (approved).
  'public/learning.html': 'c6f64d45c20c27ab642fe429eaea38a353dd0a68cf27a48b40237d0c98bfe3f9',
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
    // Self-hosted Heebo + Secular One preloads replace the Google Fonts stylesheet.
    assert.equal(sha256(head), '6426393d0bb12eba064470d7016f44154fd0d02ff5f2164a4a071069c32fa798');
  });

  it('preserves viewer head and every existing script, including AI answers and storage', () => {
    const viewer = read('public/worksheet-viewer-noam.html');
    const head = viewer.match(/<head(?:\s[^>]*)?>[\s\S]*?<\/head>/i)?.[0];
    assert.ok(head, 'Viewer must retain its head');
    // Google Fonts link removed; Heebo woff2 is preloaded from /fonts.
    assert.equal(sha256(head), '8c842de3e2b55e15a454fd1fabbc31794baeffaaf8b939d3a1bccd7cc586b462');
    const scripts = [...viewer.matchAll(/<script\b[^>]*>[\s\S]*?<\/script>/gi)].map((match) => match[0]);
    const adapters = scripts.filter((script) => /^<script id="exact-viewer-adapter">/.test(script));
    // One presentation adapter follows the released blocks. ramzi-avatar.js
    // is a released script (15 total). The only perf edit inside those blocks
    // is the noam-learning-boot.js cache-bust query.
    assert.equal(scripts.length, 15);
    assert.equal(adapters.length, 1, 'Only one explicitly marked presentation adapter is permitted');
    assert.equal(scripts.at(-1), adapters[0], 'The adapter must follow, not replace/interleave, the released scripts');
    const releasedScripts = scripts.slice(0, -1);
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
