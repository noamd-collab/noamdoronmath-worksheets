/**
 * Exact-design release fence. These SHA-256 values were read from the verified
 * live baseline 8a098020, not from the redesigned candidate. They protect the
 * explicitly out-of-scope behavior/content while permitting presentation edits.
 * A future intentional content/engine migration must review this fence rather
 * than silently regenerate it to make a design-only change pass.
 * conceptLoops.ts and ConceptLoop.astro moved when L01 angle-sum was removed
 * and replaced by the vertex-descent film. That was an explicit content change.
 * They moved again when Noam approved Kimi's L14 diff-sq v6 film (letters only,
 * x² − y² = (x − y)(x + y), 22 s lap): an explicit content change, not a regen.
 * They moved again for the grade-9 kite-construct film (loop #8 from
 * staging 654ab7c): an explicit content addition, not a regen.
 * They moved again for the kite review fixes (RTL summary, final rest
 * frame, 44px pause target): an explicit content fix, not a regen.
 * They moved again so the kite ticks follow each side, and the pause
 * button stays hidden until JS runs.
 * They moved again so the kite card plays the area film first
 * («שטח דלתון — מהדלתון למלבן»), then the ruler-and-compass film.
 * They moved again so the card title follows the film that is playing.
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
  // Optional server secrets QWEN_API_KEY and NOAM_RECAPTCHA_SECRET_KEY were
  // added so the headless Noam AI route can read Wix Secrets Manager.
  // wix({ robots: false }): Wix's injected /robots.txt was replacing ours and
  // warning at build. Reviewed for the cut-over; ConceptLoop is untouched.
  'astro.config.mjs': 'e761aaf9985f3041850fb86e7e1ecdfdcc82f6dd9c6384f6034c41e588bae9d2',
  // G9 PDF v2, G8 PDF v2 (two c2 levels), and G7 PDF v2.
  // Packages-120: replaced student PDF ids and added G9-T46 (דלתון) in the geometry group.
  'src/data/catalog.v1.json': '4c5ccc34149a798f47c4f261744f132b36d7ff083dc4d0052c81a53219639fb6',
  'src/lib/catalog/loadCatalog.ts': '1a5e54a4c19c016046202f3e0b9bb95203e58fe983dab5a27e6f261abfbc9d95',
  // Viewer links forward the c2 sibling as pc2.
  'src/lib/worksheetLinks.ts': '6bfa7fe86ff7d02a87c2f7533c6eabae1c34a372c2c68b2a92519e8c4790f531',
  // kite-construct film added for /kite-grade-9 (explicit content, not a design regen).
  'src/lib/conceptLoops.ts': 'e60dda4e84009904e23c44bbece637ee96ff17dfdb6a5525c8178d8eec2c54cd',
  'src/components/ConceptLoop.astro': 'd0b71bb4153302694c5ba797bce046d7290999c9e923ab4663c60cb58cb54246',
  // HeroLoop.astro is the homepage shell (which loops are emitted). The engine
  // above stays byte-identical; the home hero may lazy-load existing loops.
  // One readout line only: S = (a · h) : 2 school notation, PR #40 via PR #41.
  'src/components/TriangleAreaExplorer.astro': 'b2760424b5735dcf4340e5fe95aa306d19e2dd7043e841c5d12092c0fa6a01b6',
  'src/lib/homePage.ts': '26a884245860716a5b6dd3aa6189c9d07fcd99e21dc50fca8cf70116a3ba67fb',
  'src/data/home-page.json': 'af14191d863d623cfb95e65f28ca258663d4b8be01a1ef07d520c8b1e47ff73b',
  // Head favicon/manifest/theme-color tags (b7eab08, PR #34) + noam-site-companion.js (20d0ad0f, PR #82).
  'public/learning.html': 'e0ba9a8743a1422e5d3bfeafdee4a4a01e1736422a4cb3777e962078f1c61ffb',
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
    // SEO stage 4: title/description/OG/breadcrumb read approvedSeoProposal(seoPath)
    // (only rows with approved: true). Reviewed on purpose; not a design tweak.
    assert.equal(sha256(head), '97ad7597489241c3478c4e978ee84dc0d3ca081fc5488e06eb43aba838ae9435');
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
    // c2 (מצוינות 2) is a real viewer level, so the released level script changed.
    assert.equal(sha256(JSON.stringify(releasedScripts)), '71c61d6861c76294e299ae7353f598be1a532ab193be4065cc914ae6a71bde92');
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
