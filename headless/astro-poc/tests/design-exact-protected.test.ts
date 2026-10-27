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
 * They moved again so para-rect marks base b and height h on the shape
 * (explicit label fix, same 10s lap).
 * They moved again for the 2026-10-18 topic films (distributive area,
 * fraction-division meaning, grade-4 summary, measurement L-area).
 * Explicit content. Easing helpers moved to loopHelpers.ts so those films
 * can import them; that file is pinned here too. Not a silent regen.
 * ConceptLoop.astro moved again so the kite-construct aria names the
 * division with חלקי instead of an ASCII slash (Noam, 18.10.2026).
 * conceptLoops.ts and ConceptLoop.astro moved again for the grade-8
 * sas-snap film (Noam, 20.10.2026): two visible triangles, pair-by-pair
 * marks, then they meet in the middle with both outlines still visible.
 * Moved again the same day so the dashed triangle is sas-copy: the
 * existing [data-el='copy'] { opacity: 0 } rule was hiding it.
 * Moved again so the lap reset keeps both outlines on screen and slides
 * them apart, instead of fading the card empty (Noam, 21.10.2026).
 * Explicit content fix, not a silent regen.
 * The viewer released scripts moved again so the glossary and the
 * fraction key draw a horizontal bar instead of an ASCII slash
 * (Noam, 18.10.2026). Glossary files are not in this fence. Not a
 * silent regen.
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
  // QWEN_BASE_URL and QWEN_MODEL were added so a Model Studio key can point
  // at its region and model without another code change.
  // OTTERLY_API_KEY was added for the AI-crawler log webhook. Adapter, output,
  // and integrations are unchanged. The other Astro configs are not in this fence.
  // PR223-on-233: wix({ robots: false }) so Wix does not overwrite
  // src/pages/robots.txt.ts. Explicit SEO cut-over, not a silent regen.
  'astro.config.mjs': 'c002156d52b10040396ba30e6fc01106bf866fb639a204eddc13c79fadcb2fab',
  // G9 PDF v2, G8 PDF v2 (two c2 levels), and G7 PDF v2.
  // Packages-120: replaced student PDF ids and added G9-T46 (דלתון) in the geometry group.
  // 2026-10-18: Noam-approved text-only wording migration (סינתזה → סיכום/שילוב); IDs, URLs, levels, and PDF mappings remain unchanged.
  // Noam, 2026-10-27: release reviewed native worksheet packages sitewide,
  // including the explicit grade-9 reuse map. catalog-native-release.test.ts
  // verifies every PDF, level bundle, exact manifest and subsection figure.
  'src/data/catalog.v1.json': '8e3ca43a19f3d2b46f7e768b8ccb050182d29541454331720420716b0e0b7aa5',
  'src/lib/catalog/loadCatalog.ts': '1a5e54a4c19c016046202f3e0b9bb95203e58fe983dab5a27e6f261abfbc9d95',
  // Viewer links forward the c2 sibling as pc2.
  // The same authorized release forwards canonical PDFs and all sibling levels.
  'src/lib/worksheetLinks.ts': '06bfbaa4b9b778d171ca9d8802eed0ce3fb6c6f15d7d7bff3807dd1f80ce0770',
  // kite-construct film added for /kite-grade-9 (explicit content, not a design regen).
  // 2026-10-18 topic films added; easing helpers now live in loopHelpers.ts.
  // PR169: preserve new topic films and honor OS reduced motion.
    'src/lib/conceptLoops.ts': 'c85aa43a0ea3a415059425a9f010f80606888a73d17dfaf7c4462f4519b3a53a',
  'src/lib/loopHelpers.ts': 'bfa9538f5721ee835862742147b8bbe0718afe64d85d010f2d1edae4ffa3ba77',
  'src/components/ConceptLoop.astro': '56e8badef6161e10eb6079faa6f6f60170b971bd4855156df1525147efff3b67',
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
  // Noam, 2026-10-27: learning opens that same reviewed catalog package; no
  // auth/session change. Exact worksheet/level parity has dedicated coverage.
  'public/noam-learning.js': 'c6d55b6c39e0a5c5d99ae7b14d5a53fecaf92ad21e80e86ecd5d71013a39cdba',
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
    // PR223-on-233: title/description resolve through approvedSeoProposal.
    // Head tags, fonts, canonical, and Wix-dupe strip stay in place.
    // Explicit SEO cut-over, not a silent regen.
    assert.equal(sha256(head), '97ad7597489241c3478c4e978ee84dc0d3ca081fc5488e06eb43aba838ae9435');
  });

  it('preserves viewer head and every existing script, including AI answers and storage', () => {
    // Noam requested preview-to-production navigation on 2026-10-27.
    // Its early guard has a dedicated behavioral suite. Exclude only that
    // addition so the original head/script hashes continue protecting the
    // unchanged viewer, AI answers, authentication and storage.
    const viewerWithNativeRelease = read('public/worksheet-viewer-noam.html').replace(
      /<script id="noam-preview-viewer-redirect">[\s\S]*?<\/script>\n/,
      '',
    );
    // Noam, 2026-10-27: exactly two early migration assets keep old shared URLs
    // on their complete reviewed package; the source consumer resolves the
    // selected native item. The reviewed source and typed compiler dependencies are exempt
    // from the original head/import fence. Their routing/geometry behavior is
    // tested by catalog-native-migration and ramzi-native-visual suites.
    const nativeAdditions = [
      '<script src="/noam-ai/catalog-migrations.js?v=20261027-native1"></script>',
      '<script src="/noam-catalog-migration.js?v=20261027-native1"></script>',
      '<script src="noam-native-visual.js?v=20261027-source4"></script>',
      '<script src="noam-authored-geometry.js?v=20261027-authored1"></script>',
      '<script src="noam-authored-visual.js?v=20261027-authored1"></script>',
      '<script src="noam-visual-data.js?v=20261027-typed1"></script>',
      '<script src="noam-visual-plan.js?v=20261027-typed1"></script>',
    ];
    const allScripts = [...viewerWithNativeRelease.matchAll(/<script\b[^>]*>[\s\S]*?<\/script>/gi)].map(match => match[0]);
    assert.equal(allScripts.length, 23, 'The release adds only its seven exact dependencies');
    assert.deepEqual(allScripts.slice(7,12),nativeAdditions.slice(2),'Typed compilers follow their native source consumer in dependency order');
    assert.deepEqual(allScripts.slice(0, 2), nativeAdditions.slice(0, 2), 'Old URLs migrate before worksheet scripts run');
    assert.equal(allScripts[7], nativeAdditions[2], 'Native consumer follows the existing local visual engine');
    for (const addition of nativeAdditions) assert.equal(allScripts.filter(script => script === addition).length, 1);
    const viewer = nativeAdditions.reduce((html, script) => html.replace(script + '\n', ''), viewerWithNativeRelease);
    const head = viewer.match(/<head(?:\s[^>]*)?>[\s\S]*?<\/head>/i)?.[0];
    assert.ok(head, 'Viewer must retain its head');
    // Phone reading intentionally changes the inline CSS in this head.
    // Metadata, fonts, canonical and robots are unchanged.
    // 2026-10-19: Help marks replace repeated robots; expanded source previews scroll
    // so the original SVG disclosure is reachable on desktop as well as phone.
    // PR197: reviewed full-width phone diagrams, fullscreen modal and bounded zoom.
    // PR212: Noam-approved height-aware diagram fit, vertical scroll chaining,
    // and opt-in question zoom; manually checked at 390x844 and 1280x800.
    // Only presentation CSS changed in this head; metadata/SEO/fonts stay fixed.
    // 2026-10-23: pointer cursor on expandable local visuals. Metadata unchanged.
    assert.equal(sha256(head), 'c10ecfc705406e89dc0a5b78f57c7d9bd8fa6cb970352c16a24c714d09590e27');
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
    // Phone reading deliberately adds readable zoom, fit controls and a single
    // touch-target rail; mobile layout/panel/pin tests cover these changes.
    // PR124 intentionally updates the shared viewer to anchor Ramzi to printed
    // question markers. Dedicated printed-pin fixtures cover that behavior.
    // Glossary text and the fraction key use a horizontal bar (Noam, 18.10.2026).
    // A pure equation such as a/b = c/d is wrapped in dir=ltr. A mixed Hebrew
    // sentence is not, so 15 מתוך 20 = 3/4 keeps its reading order.
    // PR185, Noam-authorized worksheet integration: original native SVG disclosure,
    // exact unlisted back link, and lv=one diagnostic support. The existing AI
    // solve/auth/rate-limit/storage code remains unchanged. Behavior and URL guards
    // are exercised by worksheet-pilot.test.ts; all other fence hashes stay fixed.
    // 2026-10-19: A modal clone expands generated diagrams without changing models,
    // source geometry, authentication or persistence; covered by diagram-expansion tests.
    // Next batches: single-sheet label and five exact return paths; G8-T26 stays diagnostic.
    // Auth, solve protocol and sibling isolation are unchanged and covered separately.
    // Remaining101: nine exact semantic native SVG namespaces and a sixth exact back path.
    // Combined with reviewed PR194 UI expansion; auth, geometry, and AI protocol unchanged.
    // PR197: reviewed clone-only zoom and original-figure expansion; no solve/auth/storage changes.
    // Noam 2026-10-19: selected-part task priority and explicit drawing action after
    // a successful geometry hint. Regression tests cover scope, errors and request races.
    // Only this script fence changes; authentication and original worksheet bytes do not.
    // Noam 2026-10-19: pin label wording only ('העזר ברמזי' / '· רמזי'); no logic change.
    // Noam 2026-10-19 20:46: Ramzi panel wording ('נועם AI' → 'רמזי'); text only.
    // Noam 2026-10-19 22:13: the explicit drawing keeps the source figure's given
    // equality ticks (package data, separate from focus). Solve/auth/storage unchanged.
    // Noam's reported rectangle: revalidate a source-given kite coordinate repair before display.
    // Noam 2026-10-20: unsupported diagram replies keep their error and may show the
    // approved source figure (עזר מהדף), highlighting only a side named in a standard hint.
    // Auth, solve protocol, storage and the other 13 released scripts are unchanged.
    // 2026-10-20: acknowledge an actually loaded source aid without claiming a
    // generated diagram succeeded; failure history, retry and auth remain unchanged.
    // 2026-10-21: exact subsection sources, original SVG coordinate units,
    // native chart drawing actions and truthful visible source fallback.
    // PR212: keep original question access after errors, fit cloned diagrams,
    // clear stale section announcements, and omit understanding buttons on errors.
    // Dedicated recovery/zoom tests cover these intentional behavior changes.
    // No auth protocol, original PDF/SVG, catalogue or storage format changed.
    // PR212 follow-up: version the plural-relation compiler and its saved plan cache.
    // PR214: verified native triangle length comparisons preserve their original
    // SVG/values, including saved drawings and shared metadata fetches. Covered
    // by ramzi-native-segment-focus.test.ts; no auth, model or storage changes.
    // 2026-10-22: four live-check client fixes — recaptcha host fallback,
    // labeled shifted-parabola example, union-area language, numeric-square sense.
    // No auth, keys, score thresholds, worker or storage changes.
    // 2026-10-23: local constructed visuals get the same enlarge control as
    // generated diagrams; Pythagoras "הריבוע של" stays numeric. Cursor/cache
    // query only. No auth, keys, score, worker or storage changes.
    // 2026-10-25: bot-client cache query for execute-ready host guard.
    // Token, siteverify, keys, score, worker and storage unchanged.
    // Noam, 2026-10-27: exact source/item visual resolution, explicitly scoped
    // construction, safe source-crop aids for reviewed legacy PDFs, and model
    // context from the selected source item. New source visuals persist intent
    // and revalidate against current manifests; errors retain retry. Dedicated
    // native/source-crop/race tests cover these authorized behavior changes.
    // The local visual import is versioned 20261027-native1 to invalidate cached
    // imperative-request parsing; endpoint, bot protection and rate limits stay fixed.
    // Noam, 2026-10-27: actual drawing buttons retain explicit drawCurrentStep
    // intent. The diagram request includes exact selected native text/object
    // identities while retaining its original crop for printed marks. Dedicated
    // drawing-intent-source tests cover scope, source identity and old requests.
    // Version the successful-plan cache for the changed payload; no auth change.
    // 2026-10-27: refresh corrected PDF crop manifests and discard OCR cached
    // from obsolete blank crops; preserve the existing conversation namespace.
    // Noam, 2026-10-27: typed visual families consume exact selected native data;
    // native version joins the cache identity and rehydration revalidates plans.
    // Domain/source-scope and legacy-protocol tests cover this intentional change;
    // bot/auth/quota behavior and the conversation namespace remain unchanged.
    assert.equal(sha256(JSON.stringify(releasedScripts)), 'af4a74e910c40565dc2b8d2389ef73753d5205b6f647cb04c778f89f371bec31');
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
