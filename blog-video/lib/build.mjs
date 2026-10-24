// Renders every package file from script.json + glossary + the source post, and the
// manifest and inventory. Returns the files; bin/build.mjs writes them and the tests
// compare them with what is committed.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { VIDEO_ROOT, canonicalUrl, loadPosts, sha256, sourceBlocks } from './source.mjs';
import { CAPTION_DIFF_REASONS, RATE, checkPackage, listPackages, loadGlossary, PACKAGES_DIR } from './pipeline.mjs';
import { checkFormula } from './mathcheck.mjs';
import { removeIsolates } from './hebrew.mjs';
import { buildInventory } from './inventory.mjs';

export function buildAll() {
const files = new Map();
const errors = [];
const warnings = [];
const glossary = loadGlossary();
const posts = new Map(loadPosts().map(({ file, post }) => [post.fileSlug, { file, post }]));
const manifestPath = join(VIDEO_ROOT, 'manifest.json');
const prev = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};
const prevVideos = new Map((prev.videos || []).map((v) => [v.id, v]));
const NETWORKS = ['instagram', 'facebook', 'youtubeShorts'];
const write = (p, s) => files.set(p, s.endsWith('\n') ? s : `${s}\n`);
const fmt = (sec) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;
const LTR = (f) => `\`${f}\``;

const videos = [];
for (const pkg of listPackages()) {
  const src = posts.get(pkg.postId);
  if (!src) { errors.push(`${pkg.postId}: no source post`); continue; }
  const { post, file } = src;
  const res = checkPackage(pkg, post, glossary);
  const { script, render: r, hashes } = res;
  const blocks = new Map(sourceBlocks(post).map((b) => [b.id, b]));
  const head = (title) => [
    `# ${title}`,
    '',
    `- פוסט: ${post.title}`,
    `- קישור קנוני: ${r.canonical}`,
    `- מקור: \`${file}\``,
    `- source hash: \`${hashes.sourceHash.slice(0, 16)}\` · script hash: \`${hashes.scriptHash.slice(0, 16)}\``,
    `- גרסה: ${script.variant} (יעד ${script.target.minSec}–${script.target.maxSec} שניות)`,
    `- משך משוער: ${r.est.mid} שניות (${r.est.byWords} לפי ${RATE.wordsPerSec} מילים לשנייה, ${r.est.byChars} לפי ${RATE.charsPerSec} תווים לשנייה). **לא נמדד.**`,
    '',
  ];

  // script-source.md: unpointed text, source references, edits, directions — all separate.
  const src_md = [...head(`תסריט מקור — ${pkg.postId} · ${pkg.variant}`), `## רעיון מרכזי`, '', script.mainIdea, ''];
  src_md.push('## מקטעים', '');
  script.segments.forEach((s, i) => {
    src_md.push(`### ${i + 1}. ${s.id} (${s.role})`, '');
    src_md.push(`**נאמר (ללא ניקוד):** ${s.spoken}`, '');
    if (s.caption !== undefined) src_md.push(`**כתובית:** ${removeIsolates(r.captions[i])}`, '', `**הבדל דיבור/כתובית:** ${CAPTION_DIFF_REASONS[s.captionDiff] || '—'}`, '');
    if (s.refs?.length) {
      src_md.push('**מקור:**', '');
      for (const ref of s.refs) { const b = blocks.get(ref); src_md.push(`> [${ref} · ${b?.hash ?? 'missing'}] ${(b?.text ?? 'MISSING').replace(/\n/g, ' / ')}`, ''); }
    } else src_md.push('**מקור:** קריאה לפעולה (אין טענה תוכנית).', '');
    src_md.push(`**עריכת קיצור:** ${s.edit || '—'}`, '');
    if (s.math?.length) src_md.push(`**בדיקת מתמטיקה:** ${s.math.map((m) => `${m.display}${m.manual ? ' (ידני)' : ' (מכני: דיבור = תצוגה)'}`).join('; ')}`, '');
  });
  src_md.push('## הוראות בימוי', '', ...script.segments.map((s) => `- **${s.id}:** ${s.direction || '—'}`), '');
  src_md.push('## מה הושמט מהפוסט', '', ...script.omitted.map((o) => `- ${o}`), '', '## הצעה לפרק המשך', '', script.followUp, '');
  write(join(pkg.dir, 'script-source.md'), src_md.join('\n'));

  // narration: spoken words only, pointed per the glossary. One segment per line.
  write(join(pkg.dir, 'narration.he.niqqud.txt'), r.narration.join('\n'));
  // captions: the same content without niqqud; formulas isolated LTR (U+2066…U+2069).
  write(join(pkg.dir, 'captions.he.txt'), r.captions.join('\n'));
  write(join(pkg.dir, 'captions.segments.json'), JSON.stringify({
    timing: 'ESTIMATE ONLY — spread by word count over an unmeasured duration. Not a final SRT. Re-time against the rendered video before upload.',
    estTotalSeconds: r.est.mid,
    segments: r.cueSegments,
  }, null, 2));

  const sb = [...head(`Storyboard — ${pkg.postId} · ${pkg.variant}`), '| # | זמן משוער | הכפיל אומר | על המסך | בימוי |', '|---|---|---|---|---|'];
  r.cueSegments.forEach((c, i) => {
    const s = script.segments[i];
    const screen = (s.screen || []).map((x) => x.kind === 'formula' ? `נוסחה ${LTR(x.text)}` : x.kind === 'list' ? x.items.join(' / ') : x.text).join('<br>') || '—';
    sb.push(`| ${i + 1} | ${fmt(c.estStart)}–${fmt(c.estEnd)} | ${s.spoken} | ${screen} | ${s.direction || '—'} |`);
  });
  sb.push('', 'הזמנים משוערים לפי מספר המילים ואינם מדידה.', '');
  write(join(pkg.dir, 'storyboard.md'), sb.join('\n'));

  const st = [...head(`טקסטים למסך — ${pkg.postId} · ${pkg.variant}`),
    'כללי תצוגה: כל נוסחה מוצגת כאובייקט נפרד בכיוון LTR (לא בתוך שורת טקסט עברית), עם מינוס U+2212, כפל ×, חילוק בנקודתיים, וחזקות כמעריך עילי. אין להקליד חצים בתוך טקסט עברי.', '',
    '| # | מקטע | סוג | טקסט מדויק | בדיקה |', '|---|---|---|---|---|'];
  let n = 0;
  for (const s of script.segments) for (const x of s.screen || []) {
    const txt = x.kind === 'list' ? x.items.join(' / ') : x.text;
    const chk = x.kind === 'formula' && /\d/.test(x.text) ? (() => { const c = checkFormula(x.text.replace(/\?/g, '').trim()); return x.expect === 'false' ? `טעות מכוונת שמוצגת כטעות (${c.status}: ${c.detail})` : `${c.status}: ${c.detail}`; })() : '—';
    st.push(`| ${++n} | ${s.id} | ${x.kind} | ${x.kind === 'formula' ? LTR(txt) : txt} | ${chk} |`);
  }
  write(join(pkg.dir, 'screen-text.md'), st.join('\n'));

  const id = `${pkg.postId}--${pkg.variant}`;
  const old = prevVideos.get(id) || {};
  const narrationHash = sha256(r.narration.join('\n'));
  const captionsHash = sha256(r.captions.join('\n'));
  const scriptChanged = old.scriptHash && old.scriptHash !== hashes.scriptHash;
  const production = old.production || { status: 'not-started', jobKey: null, videoId: null, attempts: 0, history: [] };
  if (scriptChanged && production.status !== 'not-started') production.stale = true;
  videos.push({
    id,
    postId: pkg.postId,
    variant: pkg.variant,
    sourcePath: file,
    canonicalUrl: canonicalUrl(post),
    sourceHash: hashes.sourceHash,
    refsHash: hashes.refsHash,
    scriptHash: hashes.scriptHash,
    narrationHash,
    captionsHash,
    estSeconds: r.est,
    measuredSeconds: old.measuredSeconds ?? null,
    review: res.review,
    contentStatus: res.errors.length ? 'draft-has-errors'
      : res.review !== 'current' ? `needs-review (${res.review})`
      : scriptChanged || !old.contentStatus || old.contentStatus.startsWith('needs-review') || old.contentStatus === 'draft-has-errors' ? 'awaiting-noam-review'
      : old.contentStatus,
    qa: { errors: res.errors.length, warnings: res.warnings.length },
    niqqud: {
      policy: 'targeted (glossary)',
      tokensPointed: [...new Set(r.narration.join(' ').split(/\s+/).filter((t) => /[\u05B0-\u05BC]/.test(t)).map((t) => t.replace(/[^\u05B0-ת]/g, '')))],
      listened: old.niqqud?.listened ?? false,
    },
    voice: old.voice ?? { id: null, status: 'missing: Noam\'s own HeyGen voice not identified' },
    avatar: old.avatar ?? { id: null, status: 'missing: Noam\'s own HeyGen avatar not identified' },
    production,
    publish: old.publish ?? Object.fromEntries(NETWORKS.map((k) => [k, { status: 'not-published', url: null, confirmedBy: null }])),
  });
  errors.push(...res.errors);
  warnings.push(...res.warnings);
}

// social.md per post (from social.json), with the real link and related posts.
for (const postId of new Set(videos.map((v) => v.postId))) {
  const p = join(PACKAGES_DIR, postId, 'social.json');
  if (!existsSync(p)) { errors.push(`${postId}: social.json missing`); continue; }
  const s = JSON.parse(readFileSync(p, 'utf8'));
  const url = canonicalUrl(posts.get(postId).post);
  const rel = (s.related || []).map((r) => { const rp = posts.get(r.postId); if (!rp) { errors.push(`${postId}: related ${r.postId} not found`); return null; } return { title: rp.post.title, url: canonicalUrl(rp.post), why: r.why }; }).filter(Boolean);
  const md = [`# טקסטים לפרסום — ${postId}`, '', `קישור לפוסט: ${url}`, '', '**סטטוס: טיוטה. לא פורסם. אין לסמן uploaded/published בלי אישור מפורש וביצוע מאומת.**', '',
    '## Cover', '', s.cover, '',
    '## Instagram (Reels)', '', s.instagram.replace('{{url}}', url), '',
    '## Facebook', '', s.facebook.replace('{{url}}', url), '',
    '## YouTube Shorts', '', `**כותרת:** ${s.youtube.title}`, '', s.youtube.description.replace('{{url}}', url), '',
    '## פוסטים קשורים', '', ...(rel.length ? rel.map((r) => `- ${r.title}: ${r.url} (${r.why})`) : ['—']), ''];
  for (const k of ['instagram', 'facebook']) if (!s[k].includes('{{url}}')) errors.push(`${postId}: ${k} text has no {{url}} placeholder`);
  if (!s.youtube.description.includes('{{url}}')) errors.push(`${postId}: youtube description has no {{url}}`);
  write(join(PACKAGES_DIR, postId, 'social.md'), md.join('\n'));
}

// LISTENING-CHECKLIST.md: every pointed word, where it is said, and what to listen for.
const uses = new Map();
for (const pkg of listPackages()) {
  const sc = JSON.parse(readFileSync(pkg.scriptPath, 'utf8'));
  for (const seg of sc.segments) for (const w of seg.spoken.split(/\s+/)) {
    const bare = w.replace(/[^\u05D0-\u05EA]/g, '');
    if (!glossary.byToken.has(bare)) continue;
    const u = uses.get(bare) || { videos: new Set(), example: `${seg.spoken}` };
    u.videos.add(`${pkg.postId}--${pkg.variant}`);
    uses.set(bare, u);
  }
}
const order = [...glossary.entries].sort((a, b) => (a.status === b.status ? 0 : a.status === 'needs-listening-priority' ? -1 : 1));
const lc = ['# רשימת האזנה', '', 'לבדיקה בקול של נועם ב־HeyGen. ניקוד אינו הוכחה להגייה; רק האזנה מאמתת. סימון: ✓ נשמע נכון, ✗ שגוי (לרשום מה נשמע).', '',
  '| עדיפות | מילה | ניקוד | צריך להישמע | למה | בשימוש ב־ | עם ניקוד | בלי ניקוד |', '|---|---|---|---|---|---|---|---|'];
for (const e of order) {
  const u = uses.get(e.token);
  lc.push(`| ${e.status === 'needs-listening-priority' ? 'גבוהה' : 'רגילה'} | ${e.token} | ${e.niqqud} | ${e.say} | ${e.rationale} | ${u ? [...u.videos].join('<br>') : 'לא בשימוש'} | ☐ | ☐ |`);
}
lc.push('', '## מילים שלא נוקדו בכוונה', '', ...(glossary.rejected || []).map((r) => `- **${r.token}:** ${r.reason}`), ...(glossary.unpointedOk || []).map((r) => `- **${r.token}:** ${r.reason}`), '',
  '## ביטויים שההקראה לבדה אינה מבהירה', '',
  '- "מינוס שלוש בריבוע" יכול להתפרש כ־(−3)² = 9 או כ־−3² = −9. בתסריטים הביטוי מוצג על המסך לפני שהוא נאמר, והדיבור מפרק אותו ל"מינוס שלוש כפול מינוס שלוש".',
  '- "חמש כפול, בסוגריים, שבע פחות שלוש": בדיבור צריך לשמוע הפסקה אחרי "כפול". התרגיל מוצג על המסך לפני שהוא נאמר.', '');
write(join(VIDEO_ROOT, 'LISTENING-CHECKLIST.md'), lc.join('\n'));

const inventory = buildInventory(posts, videos);
write(join(VIDEO_ROOT, 'inventory.json'), JSON.stringify(inventory, null, 2));
const cols = ['postId', 'decodedSlug', 'canonicalUrl', 'sourcePath', 'title', 'grade', 'audienceExplicit', 'categories', 'contentKind', 'chars', 'formulaLines', 'sourceHash', 'inArchiveSnapshot', 'audioOnMain', 'readStatus', 'videoStatus', 'mainIdea'];
const csv = (v) => `"${String(Array.isArray(v) ? v.join('|') : v ?? '').replace(/"/g, '""')}"`;
write(join(VIDEO_ROOT, 'inventory.csv'), [cols.join(','), ...inventory.posts.map((p) => cols.map((c) => csv(p[c])).join(','))].join('\n'));

const manifest = {
  schema: 1,
  note: 'Generated by bin/build.mjs. Human decisions (format, pilot approval, avatar/voice IDs, contentStatus "noam-approved", publish confirmations) are recorded here by hand or by bin/produce.mjs and are preserved across builds.',
  format: prev.format ?? { decision: null, options: ['short (45–60s)', 'long (90–120s)'], decidedBy: null, note: 'Not decided. Pilot scripts exist in both lengths; that is not approval to render both.' },
  networks: prev.networks ?? { targets: ['instagram', 'facebook', 'youtubeShorts'], decidedBy: 'Noam (relayed)', accounts: null, schedule: null },
  pilot: prev.pilot ?? { approved: false, approvedBy: null, sampleVideoApproved: false, note: 'Noam requires approval of a sample video before the series is produced.' },
  heygen: prev.heygen ?? { avatarId: null, voiceId: null, contractVerified: false, status: 'missing: Noam\'s avatar and voice IDs; API contract not verified from official docs (blocked from this environment)' },
  videos,
};
write(manifestPath, JSON.stringify(manifest, null, 2));
return { files, errors, warnings, manifest, inventory };
}
