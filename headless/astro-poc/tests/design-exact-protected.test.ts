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

const GENERIC_VIEWER_METADATA = {
  title: '',
  description: 'דף עבודה במתמטיקה באתר נועם דורון. בחרו דף עבודה מתאים מתוך קטלוג דפי העבודה.',
  verified: false,
};
const AUTHORIZED_GENERIC_TITLE = '<title>דף עבודה במתמטיקה | נועם דורון</title>';
const RELEASED_GENERIC_TITLE = '<title>דף עבודה · מתמטיקה · נועם דורון</title>';
const AUTHORIZED_METADATA_LINES = [
  '<meta name="description" data-viewer-description content="דף עבודה במתמטיקה באתר נועם דורון. בחרו דף עבודה מתאים מתוך קטלוג דפי העבודה.">',
  '<meta name="viewer-resource-title" content="">',
  '<meta name="viewer-resource-verified" content="false">',
  `<script id="viewer-resource-metadata" type="application/json">${JSON.stringify(GENERIC_VIEWER_METADATA)}</script>`,
  '',
].join('\n');
const TRUSTED_TITLE_GUARD = [
  'var trustedViewerMetadata =',
  '  document',
  '  .getElementById(',
  '    "viewer-resource-metadata"',
  '  );',
  'var trustedDocumentTitle = "";',
  'try{',
  '  var parsedViewerMetadata =',
  '    trustedViewerMetadata',
  '      ? JSON.parse(',
  '          trustedViewerMetadata',
  '          .textContent ||',
  '          "{}"',
  '        )',
  '      : null;',
  '  if (',
  '    parsedViewerMetadata &&',
  '    parsedViewerMetadata.verified === true &&',
  '    typeof parsedViewerMetadata.title === "string" &&',
  '    parsedViewerMetadata.title === document.title',
  '  ){',
  '    trustedDocumentTitle =',
  '      parsedViewerMetadata.title;',
  '  }',
  '}catch(e){}',
  '',
].join('\n');
const AUTHORIZED_TITLE_EXPRESSION = [
  'document.title =',
  '  trustedDocumentTitle ||',
  '  "דף עבודה במתמטיקה | נועם דורון";',
].join('\n');
const RELEASED_TITLE_EXPRESSION = [
  'document.title =',
  '  ttl +',
  '  " · מתמטיקה · נועם דורון";',
].join('\n');

function replaceExactlyOnce(value: string, search: string, replacement: string, label: string): string {
  assert.equal(value.split(search).length - 1, 1, `${label} must occur exactly once`);
  return value.replace(search, replacement);
}

function normalizeViewerHeadForAuthorizedMetadata(head: string): string {
  return replaceExactlyOnce(
    replaceExactlyOnce(head, AUTHORIZED_GENERIC_TITLE, RELEASED_GENERIC_TITLE, 'authorized generic title'),
    AUTHORIZED_METADATA_LINES,
    '',
    'four authorized generic metadata lines'
  );
}

function normalizeReleasedViewerScriptsForAuthorizedMetadata(releasedScripts: string[]): string[] {
  const guardedScripts = releasedScripts.filter((script) => script.includes('var trustedViewerMetadata ='));
  const titleScripts = releasedScripts.filter((script) => script.includes(AUTHORIZED_TITLE_EXPRESSION));
  assert.equal(guardedScripts.length, 1, 'Only the authorized trusted-title guard may be new');
  assert.equal(titleScripts.length, 1, 'Only the authorized document.title expression may change');
  assert.equal(guardedScripts[0], titleScripts[0], 'The guard and title replacement belong to the same released script');
  const restored = replaceExactlyOnce(guardedScripts[0], TRUSTED_TITLE_GUARD, '', 'authorized trusted-title guard');
  const restoredTitle = replaceExactlyOnce(restored, AUTHORIZED_TITLE_EXPRESSION, RELEASED_TITLE_EXPRESSION, 'authorized document.title expression');
  return releasedScripts.map((script) => script === guardedScripts[0] ? restoredTitle : script);
}

const protectedFiles: Record<string, string> = {
  // Optional server secrets QWEN_API_KEY and NOAM_RECAPTCHA_SECRET_KEY were
  // added so the headless Noam AI route can read Wix Secrets Manager.
  // Adapter, output, and integrations are unchanged. The other two Astro
  // configs (preview, open07-verify) are not in this fence.
  'astro.config.mjs': 'c63c0e1646e6198757b32ca085cda16091a3168adf0017ce9e3ce74b91b8f451',
  // G9 PDF v2, G8 PDF v2 (two c2 levels), and G7 PDF v2.
  // Packages-120: replaced student PDF ids and added G9-T46 (דלתון) in the geometry group.
  'src/data/catalog.v1.json': '2efb9b0b42b8ba4c0f605f8835a7a24412b8103d4cfbb6c53a04657b67059959',
  'src/lib/catalog/loadCatalog.ts': '1a5e54a4c19c016046202f3e0b9bb95203e58fe983dab5a27e6f261abfbc9d95',
  // Viewer links forward the c2 sibling as pc2.
  'src/lib/worksheetLinks.ts': '6bfa7fe86ff7d02a87c2f7533c6eabae1c34a372c2c68b2a92519e8c4790f531',
  // kite-construct film added for /kite-grade-9 (explicit content, not a design regen).
  'src/lib/conceptLoops.ts': 'e60dda4e84009904e23c44bbece637ee96ff17dfdb6a5525c8178d8eec2c54cd',
  'src/components/ConceptLoop.astro': 'd0b71bb4153302694c5ba797bce046d7290999c9e923ab4663c60cb58cb54246',
  // HeroLoop.astro is the homepage shell (which loops are emitted). The engine
  // above stays byte-identical; the home hero may lazy-load existing loops.
  // 47afe919: intentional text-only school notation on the readout
  // (':' for division, '×' for multiply). Not a fence regen.
  'src/components/TriangleAreaExplorer.astro': 'b2760424b5735dcf4340e5fe95aa306d19e2dd7043e841c5d12092c0fa6a01b6',
  'src/lib/homePage.ts': '26a884245860716a5b6dd3aa6189c9d07fcd99e21dc50fca8cf70116a3ba67fb',
  'src/data/home-page.json': 'af14191d863d623cfb95e65f28ca258663d4b8be01a1ef07d520c8b1e47ff73b',
  // b7eab08d added the favicon links. 20d0ad0f added noam-site-companion.js.
  // Both are intentional. The בס״ד headless block was not redesigned.
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
    // Self-hosted Heebo + Secular One preloads replace the Google Fonts stylesheet.
    assert.equal(sha256(head), '6426393d0bb12eba064470d7016f44154fd0d02ff5f2164a4a071069c32fa798');
  });

  it('preserves viewer head and every existing script, allowing only the reviewed metadata bootstrap', () => {
    const viewer = read('public/worksheet-viewer-noam.html');
    const head = viewer.match(/<head(?:\s[^>]*)?>[\s\S]*?<\/head>/i)?.[0];
    assert.ok(head, 'Viewer must retain its head');
    // Preserve the released head fingerprint, normalizing only the new generic
    // title plus exactly four approved metadata lines. This is not a hash regen.
    assert.equal(sha256(normalizeViewerHeadForAuthorizedMetadata(head)), '6aa632f8c5727a7dcbce3357966a5e04fa47250e5e7c53122fd08cf6176a78e9');
    const scripts = [...viewer.matchAll(/<script\b[^>]*>[\s\S]*?<\/script>/gi)].map((match) => match[0]);
    const bootstrap = scripts.filter((script) => /^<script id="viewer-resource-metadata" type="application\/json">[\s\S]*<\/script>$/.test(script));
    assert.equal(bootstrap.length, 1, 'The one added metadata bootstrap must be non-executable application/json');
    const bootstrapJson = bootstrap[0].match(/^<script id="viewer-resource-metadata" type="application\/json">([\s\S]*)<\/script>$/)?.[1];
    assert.equal(bootstrapJson, JSON.stringify(GENERIC_VIEWER_METADATA), 'Bootstrap payload must be the exact generic metadata fields');
    assert.deepEqual(JSON.parse(bootstrapJson), GENERIC_VIEWER_METADATA);
    const executableScripts = scripts.filter((script) => script !== bootstrap[0]);
    const adapters = executableScripts.filter((script) => /^<script id="exact-viewer-adapter">/.test(script));
    const companion = executableScripts.filter((script) => /noam-site-companion\.js/.test(script));
    // One presentation adapter follows the released blocks. ramzi-avatar.js
    // is a released script. The site companion is one extra external script
    // after that adapter, so the released blocks stay byte-identical.
    assert.equal(scripts.length, 17, 'Only the non-executable metadata bootstrap is added');
    assert.equal(executableScripts.length, 16);
    assert.equal(adapters.length, 1, 'Only one explicitly marked presentation adapter is permitted');
    assert.equal(companion.length, 1, 'The site companion is the one added launcher script');
    assert.equal(executableScripts.at(-2), adapters[0], 'The adapter must follow, not replace/interleave, the released scripts');
    assert.equal(executableScripts.at(-1), companion[0], 'The companion script follows the adapter and does not replace it');
    const releasedScripts = executableScripts.slice(0, -2);
    assert.equal(releasedScripts.length, 14);
    // Phone reading deliberately adds readable zoom, fit controls and a single
    // touch-target rail; mobile layout/panel/pin tests cover these changes.
    // PR124 intentionally updates the shared viewer to anchor Ramzi to printed
    // question markers. Dedicated printed-pin fixtures cover that behavior.
    // Restore only this PR's trusted title guard and original title expression
    // before checking the existing released-script fingerprint.
    assert.equal(sha256(JSON.stringify(normalizeReleasedViewerScriptsForAuthorizedMetadata(releasedScripts))), 'e80fe08884059830c858c96f6560b1dfa58013f092e5a1d4d76dc1f93a06627a');
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
