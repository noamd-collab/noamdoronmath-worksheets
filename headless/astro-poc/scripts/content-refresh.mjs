#!/usr/bin/env node
/**
 * HEADLESS-MIGRATION-33 — safe, repeatable content-refresh orchestrator.
 *
 * Uses current source-of-truth adapters. Snapshots are NOT live SDK-backed.
 *
 * Modes:
 *   (default) dry-run  — report + stage proposed artifacts under reports/content-refresh/
 *   --apply            — copy staged proposals into live data paths (explicit)
 *   --check            — verify last-good sidecars still match live snapshots
 *
 * Safety:
 *   - No production writes
 *   - Failures preserve last-good snapshot (never overwrite on failed stage)
 *   - Catalog authority remains headless/catalog/catalog.v1.json
 *   - Wix Media PDF URLs stay absolute (not downloaded)
 *
 * Usage:
 *   node scripts/content-refresh.mjs
 *   node scripts/content-refresh.mjs --apply
 *   node scripts/content-refresh.mjs --check
 *   npm run refresh:content
 *   npm run refresh:content -- --apply
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { applyRecoverableBatch } from './lib/content-refresh-apply.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const args = new Set(process.argv.slice(2));
const mode = args.has('--apply') ? 'apply' : args.has('--check') ? 'check' : 'dry-run';

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const reportRoot = path.join(root, 'reports', 'content-refresh');
const runDir = path.join(reportRoot, stamp);
const proposedDir = path.join(runDir, 'proposed');
const lastGoodDir = path.join(reportRoot, 'last-good');
const applyLockPath = path.join(reportRoot, '.apply.lock');

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function readMaybe(p) {
  return fs.existsSync(p) ? fs.readFileSync(p) : null;
}

/** Adapters: each returns { id, ok, note, staged?: string[], error?: string } */
const adapters = [
  {
    id: 'catalog-snapshot',
    description:
      'Copy authoritative repo catalog (headless/catalog/catalog.v1.json) → staged snapshot. Not a live Wix CMS SDK.',
    run() {
      const source = path.resolve(root, '..', 'catalog', 'catalog.v1.json');
      if (!fs.existsSync(source)) {
        return {
          id: 'catalog-snapshot',
          ok: false,
          note: 'Authoritative catalog missing',
          error: source,
        };
      }
      const buf = fs.readFileSync(source);
      const hash = sha256(buf);
      const destJson = path.join(proposedDir, 'catalog', 'catalog.v1.json');
      const destHash = path.join(proposedDir, 'catalog', 'catalog.v1.json.sha256');
      const destMeta = path.join(proposedDir, 'catalog', 'catalog.snapshot.json');
      ensureDir(path.dirname(destJson));
      fs.writeFileSync(destJson, buf);
      fs.writeFileSync(destHash, hash + '  catalog.v1.json\n');
      fs.writeFileSync(
        destMeta,
        JSON.stringify(
          {
            generatedAt: new Date().toISOString(),
            sourcePath: 'headless/catalog/catalog.v1.json',
            sourceSha256: hash,
            bytes: buf.length,
            note: 'Staged snapshot from authoritative generated catalog. NOT live SDK-backed. Apply with content-refresh --apply.',
          },
          null,
          2
        ) + '\n'
      );
      const live = readMaybe(path.join(root, 'src/data/catalog.v1.json'));
      const liveHash = live ? sha256(live) : null;
      return {
        id: 'catalog-snapshot',
        ok: true,
        note:
          liveHash === hash
            ? 'catalog already matches authoritative'
            : `catalog drift: live=${liveHash?.slice(0, 12)} auth=${hash.slice(0, 12)}`,
        staged: [destJson, destHash, destMeta],
        applyMap: [
          { from: destJson, to: path.join(root, 'src/data/catalog.v1.json') },
          { from: destHash, to: path.join(root, 'src/data/catalog.v1.json.sha256') },
          { from: destMeta, to: path.join(root, 'src/data/catalog.snapshot.json') },
        ],
      };
    },
  },
  {
    id: 'terms-authoritative-html',
    description:
      'Re-fetch production filesusr legal HTML into staged authoritative file + rebuild legalBlocks. Read-only fetch; no production writes.',
    run() {
      const TERMS_URL =
        'https://36dd9544-acf9-4e85-a01a-798f3c1efbb9.filesusr.com/html/d8e7ad_6236f82cb4a3e832d983b6b086bcdaba.html';
      const liveHtmlPath = path.join(root, 'src/data/site-pages/authoritative/terms-legal.html');
      const liveTerms = path.join(root, 'src/data/site-pages/terms.json');
      try {
        const res = spawnSync('curl', ['-fsSL', TERMS_URL], { encoding: 'buffer', maxBuffer: 5e6 });
        if (res.status !== 0) {
          return {
            id: 'terms-authoritative-html',
            ok: false,
            note: 'fetch failed; last-good preserved',
            error: String(res.stderr || res.error || 'curl failed'),
          };
        }
        const htmlBuf = res.stdout;
        const stagedHtml = path.join(proposedDir, 'site-pages/authoritative/terms-legal.html');
        ensureDir(path.dirname(stagedHtml));
        fs.writeFileSync(stagedHtml, htmlBuf);

        // Rebuild terms.json legal body via small inline parser (same rules as M33)
        const html = htmlBuf.toString('utf8');
        const sheet = html.match(/<div class="sheet">([\s\S]*)<\/div>\s*<\/body>/)?.[1] || '';
        if (sheet.length < 400) {
          return {
            id: 'terms-authoritative-html',
            ok: false,
            note: 'fetched HTML missing .sheet; abort stage',
            error: 'structure mismatch',
          };
        }
        const blocks = parseTermsSheet(sheet);
        const current = JSON.parse(fs.readFileSync(liveTerms, 'utf8'));
        const next = {
          ...current,
          legalBlocks: blocks,
          legalIframeSrc: TERMS_URL,
          authoritativeHtmlPath: 'src/data/site-pages/authoritative/terms-legal.html',
          blocks: [
            { type: 'p', text: 'חשוב לקרוא ולהבין את תנאי השימוש באתר' },
            ...blocks,
          ],
          source: {
            ...current.source,
            legalSource: 'authoritative-html-file',
            legalSourceUrl: TERMS_URL,
            refreshedAt: new Date().toISOString(),
          },
        };
        const stagedTerms = path.join(proposedDir, 'site-pages/terms.json');
        fs.writeFileSync(stagedTerms, JSON.stringify(next, null, 2) + '\n');
        const liveHtml = readMaybe(liveHtmlPath);
        const changed = !liveHtml || sha256(liveHtml) !== sha256(htmlBuf);
        return {
          id: 'terms-authoritative-html',
          ok: true,
          note: changed
            ? `terms HTML changed (${htmlBuf.length} bytes); legalBlocks=${blocks.length}`
            : `terms HTML unchanged; legalBlocks=${blocks.length}`,
          staged: [stagedHtml, stagedTerms],
          applyMap: [
            { from: stagedHtml, to: liveHtmlPath },
            { from: stagedTerms, to: liveTerms },
          ],
        };
      } catch (e) {
        return {
          id: 'terms-authoritative-html',
          ok: false,
          note: 'exception; last-good preserved',
          error: String(e && e.stack ? e.stack : e),
        };
      }
    },
  },
  {
    id: 'aboutus-contact-form-status',
    description:
      'Read-only status of aboutus contact form + production Wix Forms evidence (no submit, no new backend).',
    run() {
      const about = JSON.parse(
        fs.readFileSync(path.join(root, 'src/data/site-pages/aboutus.json'), 'utf8')
      );
      const contact = about.blocks.find((b) => b.type === 'contact');
      const wf = contact?.wixForm || null;
      const report = {
        formSkipped: !!about.formSkipped,
        note: contact?.note || null,
        mailto: contact?.mailto || null,
        fields: contact?.fieldsShownAsLabels || [],
        wixForm: wf,
        backend:
          'Production Studio Wix Forms widget verified on live /aboutus. Form DOM id form-b8f7e551-… / component comp-mrxgdvcl lives on production metaSite 36dd9544-… (not Headless project df6b8141-…). Headless UI is dry-run/mock only — no real message submission.',
        action: 'No staged mutation — documentation + evidence adapter.',
      };
      const staged = path.join(proposedDir, 'aboutus-contact-form-status.json');
      ensureDir(path.dirname(staged));
      fs.writeFileSync(staged, JSON.stringify(report, null, 2) + '\n');
      const ok = !!(wf?.formId && (contact?.fieldsShownAsLabels || []).length >= 4);
      return {
        id: 'aboutus-contact-form-status',
        ok,
        note: ok
          ? `dry-run form wired; formId=${wf.formId}; schema readable via site-scoped CLI on production metaSite; live CreateSubmission not authorized`
          : 'missing form evidence on aboutus contact block',
        staged: [staged],
        applyMap: [],
      };
    },
  },
  {
    id: 'cms-catalog-status',
    description:
      'CMS-43 read-only catalog CMS readiness: snapshot vs live collectionId. Never writes CMS; never invents collection names.',
    run() {
      const r = spawnSync('npx', ['tsx', 'scripts/cms-catalog-status.ts'], {
        cwd: root,
        encoding: 'utf8',
      });
      const statusPath = path.join(root, 'reports', 'cms-43', 'catalog-cms-status.json');
      let status = null;
      try {
        if (fs.existsSync(statusPath)) status = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
      } catch {
        status = null;
      }
      const staged = path.join(proposedDir, 'cms-catalog-status.json');
      ensureDir(path.dirname(staged));
      const payload = status || {
        ok: false,
        note: 'cms-catalog-status failed to produce report',
        stdout: (r.stdout || '').slice(0, 500),
        stderr: (r.stderr || '').slice(0, 500),
      };
      fs.writeFileSync(staged, JSON.stringify(payload, null, 2) + '\n');
      const ok = r.status === 0 && !!status?.ok;
      return {
        id: 'cms-catalog-status',
        ok,
        note: status
          ? status.liveCmsConnected
            ? 'live CMS connected; collectionId present'
            : `SNAPSHOT_ONLY; prerequisites=${
                Array.isArray(status.missingPrerequisites) && status.missingPrerequisites.length
                  ? status.missingPrerequisites
                      .map((p) => String(p).split(':')[0])
                      .join(',')
                  : status.missingExternalInput
                    ? 'collectionId'
                    : 'none'
              }`
          : `cms status exit=${r.status}`,
        staged: [staged],
        applyMap: [],
      };
    },
  },
  {
    id: 'blog-archive-live-probe',
    description:
      'Probe production blog archive SSR (HTTP/ctype/card count). Stages diagnostic JSON only; never mutates fixtures on probe failure.',
    run() {
      const paths = [
        '/blog',
        '/blog/categories/elementary-math',
        '/blog/categories/middle-school-math',
        '/blog/categories/teachers-and-parents',
      ];
      const results = [];
      let ok = true;
      for (const p of paths) {
        const res = spawnSync(
          'curl',
          ['-fsSL', '-A', 'Mozilla/5.0 (compatible; m34-content-refresh)', '-w', '\n%{http_code}|%{content_type}|%{url_effective}|%{size_download}', p.startsWith('http') ? p : `https://www.noamdoronmath.co.il${p}`],
          { encoding: 'buffer', maxBuffer: 8e6 }
        );
        if (res.status !== 0) {
          ok = false;
          results.push({ path: p, ok: false, error: String(res.stderr || res.error || 'curl fail') });
          continue;
        }
        const raw = res.stdout.toString('utf8');
        const nl = raw.lastIndexOf('\n');
        const metaLine = nl >= 0 ? raw.slice(nl + 1) : '';
        const html = nl >= 0 ? raw.slice(0, nl) : raw;
        const [code, ctype, finalUrl, size] = metaLine.split('|');
        const cardHooks = (html.match(/data-hook="post-list-item"/gi) || []).length;
        const row = {
          path: p,
          ok: Number(code) === 200 && /html/i.test(ctype || '') && cardHooks > 0,
          http: Number(code),
          contentType: ctype,
          finalUrl,
          bytes: Number(size) || html.length,
          postListItemHooks: cardHooks,
        };
        if (!row.ok) ok = false;
        results.push(row);
      }
      const staged = path.join(proposedDir, 'blog-archive-live-probe.json');
      ensureDir(path.dirname(staged));
      fs.writeFileSync(
        staged,
        JSON.stringify(
          {
            probedAt: new Date().toISOString(),
            ok,
            results,
            note: 'Diagnostic only. Fixture apply is separate; failure here does not overwrite blog JSON.',
          },
          null,
          2
        ) + '\n'
      );
      return {
        id: 'blog-archive-live-probe',
        ok,
        note: ok
          ? `all ${results.length} archives returned HTML with post-list-item hooks`
          : 'one or more archive probes failed — see staged diagnostic; fixtures untouched',
        staged: [staged],
        applyMap: [],
      };
    },
  },
];

function decode(s) {
  return (s || '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}
function stripTags(s) {
  return decode(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
}
function parseInline(inner) {
  const norm = inner.replace(/<\/?(b|strong|em|i|span|br)\b[^>]*>/gi, (m) =>
    /br/i.test(m) ? ' ' : ''
  );
  const segments = [];
  const re = /<a\s+[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>|([^<]+)/gi;
  let m;
  while ((m = re.exec(norm))) {
    if (m[1] != null) {
      const text = stripTags(m[2]);
      if (text) segments.push({ type: 'a', text, href: m[1] });
    } else if (m[3]) {
      const text = decode(m[3]).replace(/\s+/g, ' ');
      if (text.trim()) segments.push({ type: 'text', text });
    }
  }
  const merged = [];
  for (const s of segments) {
    if (s.type === 'text' && merged.length && merged[merged.length - 1].type === 'text') {
      merged[merged.length - 1].text += s.text;
    } else merged.push({ ...s });
  }
  if (merged[0]?.type === 'text') merged[0].text = merged[0].text.replace(/^\s+/, '');
  if (merged.at(-1)?.type === 'text')
    merged.at(-1).text = merged.at(-1).text.replace(/\s+$/, '');
  const full = merged.map((s) => s.text).join('');
  const hasLink = merged.some((s) => s.type === 'a');
  if (hasLink) return { type: 'p', text: full, segments: merged };
  return { type: 'p', text: full };
}
function parseTermsSheet(sheet) {
  const blocks = [];
  const tagRe = /<(h1|h2|p|ul)(\s[^>]*)?>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = tagRe.exec(sheet))) {
    const tag = m[1].toLowerCase();
    const inner = m[3];
    if (tag === 'h1' || tag === 'h2') blocks.push({ type: 'h2', text: stripTags(inner) });
    else if (tag === 'p') blocks.push(parseInline(inner));
    else if (tag === 'ul') {
      const items = [];
      const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi;
      let li;
      while ((li = liRe.exec(inner))) items.push({ text: stripTags(li[1]) });
      if (items.length) blocks.push({ type: 'ul', items });
    }
  }
  return blocks;
}

ensureDir(runDir);
ensureDir(proposedDir);

const report = {
  mode,
  startedAt: new Date().toISOString(),
  honesty:
    'This tool copies/stages authoritative repo catalog + re-fetches terms HTML from filesusr + probes production blog URLs + reports CMS-43 catalog readiness (snapshot vs collectionId). It does NOT use a live Wix CMS/Blog SDK write path. Blog probe is diagnostic-only (no fixture overwrite).',
  disclaimer:
    'Staged artifacts are captured/copied snapshots — not live Wix CMS/Blog SDK feeds. PDFs remain on Wix Media hosts. Live CMS requires an authorized collectionId in src/data/cms.connections.json (do not invent names).',
  adapters: [],
  ok: true,
};

if (mode === 'check') {
  // Verify last-good catalog sidecar if present; else live check:catalog
  const r = spawnSync('node', ['scripts/refresh-catalog-snapshot.mjs', 'check'], {
    cwd: root,
    encoding: 'utf8',
  });
  report.adapters.push({
    id: 'catalog-check',
    ok: r.status === 0,
    note: (r.stdout || r.stderr || '').trim().slice(0, 400),
  });
  if (r.status !== 0) report.ok = false;
  const termsHtml = path.join(root, 'src/data/site-pages/authoritative/terms-legal.html');
  const termsJson = path.join(root, 'src/data/site-pages/terms.json');
  report.adapters.push({
    id: 'terms-files-present',
    ok: fs.existsSync(termsHtml) && fs.existsSync(termsJson),
    note: fs.existsSync(termsHtml) ? 'authoritative HTML present' : 'missing HTML',
  });
  if (!fs.existsSync(termsHtml)) report.ok = false;
  const cms = spawnSync('npx', ['tsx', 'scripts/cms-catalog-status.ts'], {
    cwd: root,
    encoding: 'utf8',
  });
  let cmsNote = (cms.stdout || cms.stderr || '').trim().slice(0, 400);
  try {
    const st = JSON.parse(
      fs.readFileSync(path.join(root, 'reports', 'cms-43', 'catalog-cms-status.json'), 'utf8')
    );
    cmsNote = st.liveCmsConnected
      ? 'LIVE_CONNECTED'
      : `SNAPSHOT_ONLY; missingExternalInput=${st.missingExternalInput ? 'yes' : 'no'}`;
    report.adapters.push({
      id: 'cms-catalog-status',
      ok: cms.status === 0 && !!st.ok,
      note: cmsNote,
      liveCmsConnected: !!st.liveCmsConnected,
    });
    if (cms.status !== 0 || !st.ok) report.ok = false;
  } catch {
    report.adapters.push({
      id: 'cms-catalog-status',
      ok: false,
      note: cmsNote || 'cms status report missing',
    });
    report.ok = false;
  }
} else {
  // dry-run or apply: always stage first; each adapter isolated — failures do not wipe prior last-good
  const applyMaps = [];
  let anyFailed = false;
  for (const adapter of adapters) {
    let result;
    try {
      result = adapter.run();
    } catch (e) {
      result = {
        id: adapter.id,
        ok: false,
        note: 'adapter threw; last-good preserved',
        error: String(e && e.stack ? e.stack : e),
        staged: [],
        applyMap: [],
      };
    }
    report.adapters.push({
      id: result.id,
      description: adapter.description,
      ok: result.ok,
      note: result.note,
      error: result.error || undefined,
      staged: result.staged || [],
    });
    if (!result.ok) {
      report.ok = false;
      anyFailed = true;
    } else if (result.applyMap?.length) applyMaps.push(...result.applyMap);
  }
  report.partialFailureProtection = {
    anyFailed,
    applyMapsQueued: applyMaps.length,
    note: anyFailed
      ? 'At least one adapter failed — apply refused for all maps; last-good untouched'
      : 'All adapters ok — apply may copy applyMaps after last-good backup',
  };

  if (mode === 'apply') {
    if (!report.ok) {
      report.apply = {
        performed: false,
        atomic: false,
        recoverableBatch: true,
        reason: 'staging had failures — refusing apply; last-good untouched',
      };
    } else {
      // Recoverable batch (NOT cross-file atomic): pre-backup → temp stage → switch → journal.
      const stampDir = path.join(lastGoodDir, stamp);
      ensureDir(stampDir);
      const applyResult = applyRecoverableBatch({
        root,
        applyMaps,
        stampDir,
        lockPath: applyLockPath,
      });
      report.apply = applyResult;
      if (!applyResult.performed) report.ok = false;
    }
  } else {
    report.apply = {
      performed: false,
      atomic: false,
      recoverableBatch: true,
      reason: 'dry-run default — review proposed/ then re-run with --apply',
    };
  }
}

report.finishedAt = new Date().toISOString();
const reportPath = path.join(runDir, 'report.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
// Also write latest pointer
fs.writeFileSync(path.join(reportRoot, 'latest.json'), JSON.stringify({ runDir, reportPath, mode, ok: report.ok }, null, 2) + '\n');

console.log(JSON.stringify({ mode, ok: report.ok, reportPath, adapters: report.adapters.map((a) => ({ id: a.id, ok: a.ok, note: a.note })) }, null, 2));
process.exit(report.ok ? 0 : 1);
