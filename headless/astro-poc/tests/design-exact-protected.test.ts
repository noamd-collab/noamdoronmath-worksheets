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
 * They moved again so OS prefers-reduced-motion parks a loop unless the
 * visitor explicitly enables motion on this site.
 * They moved again for the 10.11.2026 landing animation audit: fade-only
 * films now move their pieces, and the sas-snap copy is visible.
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
  // OTTERLY_API_KEY added to the env schema (optional secret, read from env only).
  // QWEN_BASE_URL and QWEN_MODEL are optional secrets for the Model Studio endpoint.
  // Noam, 2026-10-30: add only optional server-secret schemas for the v2
  // human challenge. Removing those two lines exactly restores live 64933173.
  // Existing reCAPTCHA v3 settings and every other config byte are unchanged.
  // Reviewed 2026-11-11 packaging fix for the authorized landing publication:
  // add only compactServerBuild's import and integration registration. Removing
  // exactly those additions restores 7db60ed4. All 40 client assets are identical;
  // 376 routes, 104 built-page checks and six motion/Stop checks were verified.
  // Preserve this exact-file fence; no other configuration is relaxed.
  // 2026-11-12: Noam requested private skill-based worksheet generation.
  // Add only the optional server-secret TEACHER_GENERATION_SERVICE_KEY schema.
  // Removing that single line restores the preceding protected hash exactly;
  // no value is committed, client-exposed or required by existing teacher tools.
  'astro.config.mjs': 'ee86254e32a78e36ee35bdb98c193c82982a949cabff8da91e65b66715cff745',
  // Noam requested restoring main's reviewed native PDF catalog on baseline
  // (30 October 2026), keeping the baseline Hebrew title corrections.
  // G9 PDF v2, G8 PDF v2 (two c2 levels), and G7 PDF v2.
  // Packages-120: replaced student PDF ids and added G9-T46 (דלתון) in the geometry group.
  // Visible topic labels: סינתזה גאומטרית → שילוב גאומטרי, and the grade-6 synthesis sheet → סיכום.
  // Noam, 2026-11-02: G9-T07 republished with its final-answers pages (new PDF ids only).
  // Noam, 2026-11-02: batch 2 (G9-T04, G9-T05, G9-T10, G9-T11) republished with final answers.
  // Batch 3 (2026-11-02): G9-T17, G9-T18, G9-T19 and G9-T20 republished with final answers; the catalog points at their new PDFs.
  // Batch 4 (2026-11-02): 92 grade 7-9 topics, 276 sheets, republished with final answers; the catalog points at their new PDFs.
  // Batch 5 (2026-11-03): 72 more grade 7-9 sheets republished with final answers; the catalog points at their new PDFs.
  // Batch 6 (2026-11-03): G8-T65 (3 sheets) republished with final answers; the catalog points at its new PDFs.
  // 2026-11-03: four source-recovered grade 8 worksheets; question pages pixel-identical; final answers appended.
  // Final answers completed for remaining22 sheets; verified source identity with authorized AA-only differences, 2026-11-03.
  // 2026-11-08: Noam's elementary renewal adds the reviewed G3-T10 edition.
  // Removing only editions/defaultEditionId restores every prior catalog field;
  // worksheet-editions.test.ts binds the refreshed snapshot to the real registry.
  // This is an intentional content addition; deployment still needs PR approval.
  // Noam's explicit 8 November publication scope disables the elementary
  // edition viewer; all old fields and PDFs remain covered by edition tests.
  // Noam, 2026-11-09: new grade 8 topic 67 (statistics: collecting and reading data,
  // frequency and relative frequency), three levels; Noam prefix G8-T67 once its
  // whole-question manifests were mapped, so the levels open in the viewer.
  'src/data/catalog.v1.json': '5c41c0f0948ebb64f8688b1ece02979eeff699febd171c9a3ea5fd7c06bedfd7',
  // 2026-11-07: Noam's elementary worksheet renewal adds published editions
  // alongside every legacy PDF. worksheet-editions.test.ts verifies the empty
  // registry leaves the full snapshot and all 507 elementary links unchanged,
  // rejects unpublished/duplicate identities and keeps level siblings together.
  // This intentionally extends catalog behavior, not a presentation-only edit.
  'src/lib/catalog/loadCatalog.ts': '4c05a7c373e7bef46f47d8a5dd74a152eab160de7d46957dcb377ebeb2fdb786',
  // Viewer links forward the c2 sibling as pc2.
  // Explicit edition links are additive; omitted edition preserves legacy URLs.
  'src/lib/worksheetLinks.ts': '1ed2a623c2dc08d23b9ecfedc9f89120d240dfd72e01d55b93f84614e670826b',
  // Four additive elementary films restored from main (30 October 2026).
  // Existing baseline films and kite rendering remain intact.
  // kite-construct film added for /kite-grade-9 (explicit content, not a design regen).
  'src/lib/conceptLoops.ts': '4bb9672e19a77ed3cb21e33b8592d26156a9edca19f831cc32cf41e689c7e634',
  // Brave motion: site opt-in overrides prefers-reduced-motion inside the film.
  // Kite caption says חלקי 2 instead of a slash fraction.
  'src/components/ConceptLoop.astro': '4c616613dede35dc1deb60d11941e4b3b0aa051c3b20b5239b23ec7582036767',
  // HeroLoop.astro is the homepage shell (which loops are emitted). The engine
  // above stays byte-identical; the home hero may lazy-load existing loops.
  // One readout line only: S = (a · h) : 2 school notation, PR #40 via PR #41.
  'src/components/TriangleAreaExplorer.astro': 'b2760424b5735dcf4340e5fe95aa306d19e2dd7043e841c5d12092c0fa6a01b6',
  'src/lib/homePage.ts': '26a884245860716a5b6dd3aa6189c9d07fcd99e21dc50fca8cf70116a3ba67fb',
  'src/data/home-page.json': 'af14191d863d623cfb95e65f28ca258663d4b8be01a1ef07d520c8b1e47ff73b',
  // Head favicon/manifest/theme-color tags (b7eab08, PR #34) + noam-site-companion.js (20d0ad0f, PR #82).
  // Noam, 2026-11-02: add site header/nav, footer, fonts and /noam-accessibility.js on learning.html.
  // Noam, 2026-11-09: the למורים menu badge reads Beta instead of חדש, as in SiteHeader.astro.
  'public/learning.html': '9b2cdda6f98ea6967be33829c0d6826e85c51b85cd24d3283fd661b483c9235e',
  'public/noam-learning-config.js': '90228359e65a99300b7d5017ddc58edce650b0b1a403a13b40c22608330f4ca7',
  // Lazy Supabase: guest learning no longer downloads the SDK. Google sign-in
  // and an existing session still load it, then recreate the engine.
  'public/noam-learning.js': 'c6d55b6c39e0a5c5d99ae7b14d5a53fecaf92ad21e80e86ecd5d71013a39cdba',
  'public/noam-learning-boot.js': '8a4976b19a32a4e1820b4c8aa391004973988a3126337fe2b3355406220d8cd1',
  'public/noam-learning-auth-redirect.js': '8fcd0ee6ef88a5816bb220b5a23b63821b65d0b3574dbcbfdcda6fc73cc34147',
  // Elementary editions: keyset pagination preserves progress beyond 1,000 rows.
  // Dedicated tests cover complete reads, partial failure and account switching.
  'public/noam-learning-core.js': '47024e91c4d9f7c12f85038abe029a336aa312bddc2191a83a23643f8f889264',
  'src/pages/sitemap-index.xml.ts': 'a37b33d949ab71b22bb4672aa646bfd4233cc370874c931cf66602ee23ac08c8',
  'src/pages/sitemap-pages.xml.ts': '08fc6902c46261d6e259c04441ff26822bdb42ffaf380c570f1b40fffff073cf',
  'src/pages/sitemap-blog.xml.ts': '6e43bead2349fb12450625e9e825b612db4e4a601e0a12a6838ad061bb42f3f2',
};

describe('exact-design protected live-baseline boundaries', () => {
  for (const [file, expected] of Object.entries(protectedFiles)) {
    it(`preserves ${file}`, () => {
      let content = read(file);
      if (file === 'src/data/catalog.v1.json') {
        // Noam's elementary renewal adds exactly these four grade-one editions.
        // Strip only that reviewed addition, then require the complete prior
        // snapshot hash below, including the already released grade-three edition.
        const catalog = JSON.parse(content);
        const grade = catalog.grades.find((g: any) => g.grade === 1);
        for (const id of [11, 12, 14, 15]) {
          const topic = grade.topics.find((t: any) => t.id === id);
          assert.equal(topic.defaultEditionId, 'elementary-20261108-r1');
          assert.equal(topic.editions.length, 1);
          assert.equal(topic.editions[0].editionId, 'elementary-20261108-r1');
          assert.equal(topic.editions[0].routing.usesViewer, false);
          assert.equal(topic.editions[0].routing.aiHintShown, false);
          delete topic.editions;
          delete topic.defaultEditionId;
        }
        // Noam's 13 November PDF-first work adds four initial focused sets,
        // plus two separately reviewed parallelogram follow-ups (not PR456).
        // Bind every byte of each reviewed addition, strip only those overlays,
        // and keep the original complete legacy catalog hash below unchanged.
        const middleAdditions = [
          [7, 17, ['ms-20261113-trn-r1'], '3e3929a160636aabc2e27f8dedff16dbff4eda435b6c4155f50cb61134c5381c'],
          [8, 14, ['ms-20261113-cyl-r1'], '3f476e3666dbb952773355bbb8b98d1a03d2ad3733cac819c0b210d0a792edbb'],
          [8, 15, ['ms-20261113-con-r1'], 'e3e8dfde45ca70dbf15c20a264cf34cb329d9700f9e361917da796e454a9cc3d'],
          [9, 7, ['ms-20261113-par-r1', 'ms-20261113-par-02-r1', 'ms-20261113-par-03-r1'], '659b7c7c0b509660b7ad814a9c99c41adab03a3b32036d1c0d4538e916273bf6'],
        ] as const;
        for (const [gradeId, topicId, editionIds, additionSha256] of middleAdditions) {
          const topic = catalog.grades.find((g: any) => g.grade === gradeId).topics.find((t: any) => t.id === topicId);
          assert.equal(topic.defaultEditionId, 'legacy');
          assert.deepEqual(topic.editions.map((edition: any) => edition.editionId), editionIds);
          for (const edition of topic.editions) {
            assert.equal(edition.publicationMode, 'pdf-only');
            assert.equal(edition.routing.usesViewer, false);
            assert.equal(edition.routing.aiHintShown, false);
          }
          assert.equal(sha256(JSON.stringify(topic.editions)), additionSha256);
          delete topic.editions;
          delete topic.defaultEditionId;
        }
        content = JSON.stringify(catalog, null, 2) + '\n';
      }
      if (file === 'public/noam-learning.js') {
        // Noam's private teacher access adds exactly one same-origin JSON POST
        // logout bridge to the existing learning auth listener (PR448). Reverse
        // this reviewed addition, including its line breaks, then retain the
        // pre-teacher c6d55b6c hash. Every other learning byte stays protected.
        // teacher-session/client tests exercise the new logout behavior.
        const approvedListener =
          "  client.auth.onAuthStateChange(function(event,session){\n" +
          "   if(event==='SIGNED_OUT')fetch('/api/teacherSession',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'}),credentials:'same-origin',cache:'no-store'}).catch(function(){});\n" +
          "   setTimeout(function(){engine.setUser(session&&session.user).catch(fail);},0);\n" +
          "  });";
        const priorListener =
          "  client.auth.onAuthStateChange(function(event,session){setTimeout(function(){engine.setUser(session&&session.user).catch(fail);},0);});";
        assert.equal(content.split(approvedListener).length, 2, 'exactly one approved JSON logout bridge');
        content = content.replace(approvedListener, priorListener);
      }
      if (file === 'public/noam-learning-boot.js') {
        // Noam approved PDF-only elementary publication, without new DB/auth
        // activity. Removing this exact early exit restores the old boot.
        const guard = '  if (window.NOAM_ELEMENTARY_PDF_ONLY) return;\n';
        assert.equal(content.split(guard).length, 2);
        content = content.replace(guard, '');
        // The authorized teacher logout bridge requires a new client version.
        // Normalize only that exact query; SDK loading, guest behavior and the
        // existing elementary early exit remain independently fenced.
        const approvedScript = "    s.src = 'noam-learning.js?v=20261111-teacher-post-session';";
        const priorScript = "    s.src = 'noam-learning.js?v=20261002-lazy-supabase';";
        assert.equal(content.split(approvedScript).length, 2, 'exactly one approved learning client version');
        content = content.replace(approvedScript, priorScript);
      }
      assert.equal(sha256(content), expected, `${file} is outside the approved presentation-only scope`);
    });
  }

  it('preserves the shared head exactly, including SEO, canonical, fonts and robots', () => {
    const head = read('src/layouts/BaseLayout.astro').match(/<head(?:\s[^>]*)?>[\s\S]*?<\/head>/i)?.[0];
    assert.ok(head, 'BaseLayout must retain its head');
    // SEO cut-over (issue): one title/description/canonical, full OG+Twitter,
    // and a wider Wix-duplicate strip. Reviewed on purpose; not a design tweak.
    // SEO stage 4: title/description/OG/breadcrumb read approvedSeoProposal(seoPath)
    // (only rows with approved: true). Reviewed on purpose; not a design tweak.
    // Noam, 2026-11-10: explicitly approved fixing and publishing duplicate SEO.
    // Authored metadata gains ownership markers; server-seo.test.ts verifies
    // removal of matching Wix defaults before delivery instead of client JS.
    // Existing fonts, icons, schema and metadata values remain protected here.
    assert.equal(sha256(head), 'dc55bfedb5005d62e74aa6bd198f92ef02eaeeadf1f9a5002e1c8d5d2cc242d8');
  });

  it('preserves viewer head and every existing script, including AI answers and storage', () => {
    // Noam requested preview-to-production navigation on 2026-10-27.
    // Its early guard has a dedicated behavioral suite. Exclude only that
    // addition so the original head/script hashes continue protecting the
    // unchanged viewer, AI answers, authentication and storage.
    const elementaryExit = 'if (window.NOAM_ELEMENTARY_PDF_ONLY) {\n' +
      '  document.body.textContent = window.NOAM_ELEMENTARY_PDF_URL\n' +
      '    ? "פותחים את דף העבודה…" : "הקישור לדף העבודה אינו תקין.";\n' +
      '  return;\n}\n\n';
    // PR461 deliberately adds measured cards/feedback and a selection announcement.
    // Reverse only the 12 reviewed, exact byte hunks; keep every pre-existing
    // head/script SHA below. An edited/new/missing hunk or unrelated byte fails.
    const deltaText = read('tests/fixtures/measured-viewer-reviewed-delta.json');
    assert.equal(sha256(deltaText), '5263c24c35ea4fab909d6da593a365976778f7b75f82b276fa9e85da0c2d0482');
    const delta = JSON.parse(deltaText);
    let currentViewer = read('public/worksheet-viewer-noam.html');
    for (const hunk of delta.hunks) {
      assert.equal(currentViewer.split(hunk.after).length, 2, 'one exact reviewed viewer hunk');
      currentViewer = currentViewer.replace(hunk.after, hunk.before);
    }
    assert.equal(sha256(currentViewer), delta.baseline_sha256, 'all bytes outside the reviewed delta retain the baseline');
    assert.equal(currentViewer.split(elementaryExit).length, 2);
    // The scoped exit is covered behaviorally; all prior middle-school script
    // bytes must still match their historical hashes after removing only it.
    const viewerWithNativeRelease = currentViewer.replace(elementaryExit, '').replace(
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
      '<script src="noam-native-visual.js?v=20261029-angles1"></script>',
      '<script src="noam-source-panels.js?v=20261102-answers1"></script>',
      '<script src="noam-authored-geometry.js?v=20261028-square1"></script>',
      '<script src="noam-authored-visual.js?v=20261028-source5"></script>',
      '<script src="noam-visual-data.js?v=20261028-source3"></script>',
      '<script src="noam-visual-plan.js?v=20261028-source3"></script>',
      '<script src="noam-source-data-visual.js?v=20261028-source-data3"></script>',
      '<script src="noam-source-scaffold.js?v=20261029-scaffold1"></script>',
      // Noam, 2026-10-31: source-bound public catalog supplies all three standard hints.
      '<script src="noam-curated-hints.js?v=20261107-edition-bindings1"></script>',
    ];
    const allScripts = [...viewerWithNativeRelease.matchAll(/<script\b[^>]*>[\s\S]*?<\/script>/gi)].map(match => match[0]);
    assert.equal(allScripts.length, 27, 'The release adds its ten exact dependencies and curated hints');
    assert.deepEqual(allScripts.slice(7,15),nativeAdditions.slice(2,10),'Typed compilers follow their native source consumer in dependency order');
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
    // 31 October: author CSS must not reveal the policy-hidden drawing control.
    assert.equal(sha256(head), '54e2cebfd2250f27cf459dbb0702cf2b077c9e38dff36ea9777c4cf49749b6f0');
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
    // 2026-10-28: only the manifest cache key changes, so multi-panel items that
    // now name their own source panel never pair a cached manifest with a newer
    // package digest. ramzi-multi-panel-source tests cover the remapped sections.
    // 2026-10-28: verified multi-panel source groups retain full reviewed PDF
    // captions and all source SVGs, including rehydration and clone-only zoom.
    // Dedicated group tests bind every panel/crop; auth/storage namespaces stay fixed.
    // 2026-10-28: ordinary hint context now starts with verified visible dot-array
    // counts/rows from complete source groups. No stage, formula or answer is
    // inferred; source bytes, model calls, auth and storage remain unchanged.
    // 2026-10-28: fit each source panel vertically; explicit zoom scales its cap.
    // No source math, network, security or conversation behavior changes.
    // 2026-10-28: four printed part-only illustration scopes correct 15 links;
    // only those PDFs rotate OCR, while chat keys and PDF/SVG bytes stay fixed.


    // Noam, 2026-10-28: explicit drawing can invoke existing operation/table
    // compilers from exact native source; no answer data or new math family.
    // Verified initial numeric labels on flat source nets enrich the existing hint request;
    // cached OCR, conversations, auth and model-call count remain unchanged.
    // Exact worksheet-image read errors may offer an independently validated original table.
    // This source-only recovery retains the error and never invokes a protected endpoint.
    // The reviewed glossary distinguishes shapes, powers and pronouns; refresh its asset only.
    assert.match(viewerWithNativeRelease, /noam-glossary\.js\?v=20261029-context6/);
    assert.match(readFileSync(join(root, '../../worksheet-viewer-noam.html'), 'utf8'), /noam-glossary\.js\?v=20261029-context6/);
    // Privately verified source facts add a bounded priority/no-disclosure instruction to the existing request.
    // 2026-10-29: image-read hints with fully verified native aids send a canonical source
    // analysis instead of OCR; the endpoint, auth, cache and request count are unchanged.
    // The ten requested source scaffolds join the explicit drawing path; glossary wording is versioned.
    // Automatic hints, original source assets and endpoint security retain their existing contracts.
    // 2026-10-29: explicit printed last-part-only figure scope proves independent canonical text.
    // The whole reviewed framing must match; any extra scope qualification keeps the image reader.
    // The attachment-origin flag and reader use one request snapshot; cleanup retains newly added photos.
    // Reviewed from the prior 61152b5e1 fence through live baseline 5ad709533:
    // 3474fd6b7 enforces Noam's geometry-only drawing policy, and PR285
    // (97fab9745) binds analysis/solve payloads and OCR caches to the selected
    // source revision. The viewer head and the other 13 released scripts are
    // byte-identical. drawing-hint-topic, ramzi-drawing-intent-source and
    // ramzi-analyzer-source-binding cover the policy and source/cache guards.
    // Keep the entire script fence, including the migrated behavior, protected.
    // Noam, 2026-10-30: cap the full hint operation at 55s, fence expired
    // requests/cache callbacks and release retry controls. Dedicated operation-
    // deadline tests cover timeout, body aborts and generation races; the bot
    // client, security protocol, source assets and conversation storage stay fixed.
    // Noam, 2026-10-30: source-verified first-hint probes skip OCR only for a
    // server-authorized printed-text cue. SDK preparation overlaps source reads;
    // only the source phase uses25s; normal requests keep55s from the click.
    // Canonical source retains priority over image/manifest caches.
    // Fast-hint/deadline tests preserve token checks, source scope and late fences.
    // Noam, 2026-10-31: all three standard hints come from the approved public
    // Supabase catalog bound to exact exercise/PDF/native SHA. Missing rows fail
    // closed without OCR/model fallback; retry keeps its exact index, attachments
    // remain, and a thread cannot mix ladder revisions. Freeform keeps the protected
    // client and55s deadline. Catalog/fast-hint/deadline tests exercise these rules.
    // Noam, 2026-10-30: הבנתי answers locally and never opens the next hint or asks the
    // model for the next step; לא הבנתי, «רמז», auth and storage are unchanged. The guides
    // asset is versioned 20261030-understood1; ramzi-understanding tests cover the flow.
    // noamAnswerUnderstood adds the הבנתי exchange to the exercise thread in order and
    // leaves the draft and attachments alone; no request is sent. The adapter reaches it
    // through window.noamAnswerUnderstood, the main script's only new global. The exchange
    // is marked understood: it stays out of the model history and is never a drawing target.
    // Noam, 2026-10-31 review: understood/closing replies have no check pair;
    // catalog config+body share4s, confirmed misses focus the question composer,
    // and unbound historical guides cannot answer or steer additional questions.
    // DOM/catalog/deadline/freeform regressions cover the source and UI fences.
    // 31 October: busy-state resets retain the three-hint exhaustion guard.
    // ramzi-hint-exhaustion tests exercise both released viewer copies.
    // 1 November: a fresh source-bound catalog revision clears only stale
    // prepared hint turns; revision/DOM tests preserve additional conversation.
    // The glossary also protects the actual hint row/button above the composer;
    // separate live hint/composer bounds and post-focus/scroll remeasurement
    // are pinned by the positioning fixture.
    // 1 November: only the shared bot-client cache query is refreshed for the
    // approved SDK lifecycle fix. Reversing that query restores the exact
    // 41ad576e released scripts; the separate companion URL is also cache-busted.
    // PR333 hints, content and presentation stay intact.
    // 3 November, Noam-authorized additional-question latency repair: the main
    // script uses one protected image solve, narrowly verified substitution text,
    // and no artificial answer delay. The head and other13 scripts are identical
    // to240f2363; canonical/image/attachment/deadline tests cover the new contract.
    // Prepared Supabase hints and the current bot SDK remain unchanged.
    // 3 November, phone verification: keep a focused composer from blurring on
    // primary Send pointerdown so its layout cannot move before native click.
    // Only main script 7 changes from c356ab7b; no submit on down or cancelled
    // gestures. ramzi-send-focus covers both viewers and keyboard/desktop paths.
    // 7 November: edition hints bind URL/PDF/source/item SHA and isolate saved
    // state. Elementary editions are prepared-only; legacy server paths, bot
    // protection, math helpers and drawing-topic lists stay intact. Edition,
    // curated/revision, deadline and drawing tests cover the separate branches.
    assert.equal(sha256(JSON.stringify(releasedScripts)), '0f5a6030710a5caaab1baa19361f16e84d2c62e399cdbc8e97002de46485a68d');
    const priorSdkScripts = releasedScripts.map(script => script.replace(
      './noam-bot-client.js?v=20261101-sdk-lifecycle',
      './noam-bot-client.js?v=20261025-execute-ready-guard',
    ));
    assert.equal(sha256(JSON.stringify(priorSdkScripts)), '94f82f91dd302eb284b9a6c9f8eee6aa5e4abf9a3c2e228bce71a96980548764');
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
