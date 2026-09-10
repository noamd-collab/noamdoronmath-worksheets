// Turns a published post into a narration script, then into chunks.
//
// Input is the post's own title + body (from the Wix Blog API, fieldset RICH_CONTENT
// with CONTENT_TEXT as fallback), so site chrome - menus, footers, CSS, buttons -
// never reaches the model.
//
// Post content is treated strictly as data. Nothing inside a post is ever executed
// or obeyed as an instruction; the text is only ever concatenated after the style
// instruction and sent as narration input.

const NBSP = / /g;
const ZERO_WIDTH = /[​-‏‪-‮⁦-⁩]/g;
const NIQQUD = /[֑-ׇֽֿׁׂׅׄ]/g;

// Hebrew abbreviations and symbols that a TTS model reads badly in raw form.
const REPLACEMENTS = [
  [/(\d)\s*%/g, '$1 אחוזים'],
  [/(?<![\w֐-׿])%(?![\w֐-׿])/g, ' אחוזים'],
  [/₪/g, ' שקלים'],
  [/\$(\d)/g, '$1 דולר'],
  [/(\d)\s*\$/g, '$1 דולר'],
  [/€/g, ' יורו'],
  [/(?<![֐-׿])ס״מ|ס"מ/g, 'סנטימטר'],
  [/סמ״ר|סמ"ר/g, 'סנטימטר מרובע'],
  [/מ״ר|מ"ר/g, 'מטר מרובע'],
  [/ק״ג|ק"ג/g, 'קילוגרם'],
  [/ק״מ|ק"מ/g, 'קילומטר'],
  [/מ״מ|מ"מ/g, 'מילימטר'],
  [/וכו׳|וכו'/g, 'וכולי'],
  [/לדוג׳|לדוג'/g, 'לדוגמה'],
  [/עמ׳|עמ'/g, 'עמוד'],
  [/בע״מ|בע"מ/g, 'בעמ'],
  [/\bוכד׳/g, 'וכדומה'],
  // Arithmetic and comparison operators, read as words.
  [/(\d)\s*[×✕✖]\s*(\d)/g, '$1 כפול $2'],
  [/(\d)\s*[·]\s*(\d)/g, '$1 כפול $2'],
  [/(\d)\s*[x](\s*\d)/g, '$1 כפול$2'],
  [/(\d)\s*[:÷]\s*(\d)/g, '$1 חלקי $2'],
  [/(\d)\s*\/\s*(\d)/g, '$1 חלקי $2'],
  [/(\d)\s*\+\s*(\d)/g, '$1 ועוד $2'],
  [/(\d)\s*[-−]\s*(\d)/g, '$1 פחות $2'],
  [/(\d)\s*=\s*(\d)/g, '$1 שווה $2'],
  [/(\d)\s*(?:≥|>=)\s*(\d)/g, '$1 גדול או שווה ל-$2'],
  [/(\d)\s*(?:≤|<=)\s*(\d)/g, '$1 קטן או שווה ל-$2'],
  [/(\d)\s*>\s*(\d)/g, '$1 גדול מ-$2'],
  [/(\d)\s*<\s*(\d)/g, '$1 קטן מ-$2'],
  // Hebrew maqaf glued to a digit reads better with a space.
  [/([֐-׿])־(\d)/g, '$1 $2'],
  // Thousands separators would otherwise be read as separate numbers.
  [/(\d),(\d{3})(?!\d)/g, '$1$2'],
];

export function normalizeForSpeech(raw) {
  let t = String(raw || '')
    .replace(NBSP, ' ')
    .replace(ZERO_WIDTH, '')
    .replace(NIQQUD, '')
    .replace(/\r\n?/g, '\n');

  // Drop link markup residue and bare URLs - a read-aloud URL is noise.
  t = t.replace(/https?:\/\/\S+/g, '');
  t = t.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');

  // Operator and unit rewrites run before markup stripping, so that comparison
  // signs are turned into words instead of being deleted as markup.
  for (const [re, to] of REPLACEMENTS) t = t.replace(re, to);

  // Leftover markup characters. '>' is only removed at the start of a line
  // (blockquote marker); elsewhere it has already been rewritten above.
  t = t.replace(/^[ \t]*>+[ \t]*/gm, '');
  t = t.replace(/[*_`#]{1,3}/g, '');

  // Collapse whitespace but keep paragraph boundaries.
  t = t.split('\n').map((l) => l.replace(/[ \t]+/g, ' ').trim()).join('\n');
  t = t.replace(/\n{3,}/g, '\n\n');
  // A heading without terminal punctuation should still get a pause.
  t = t.split('\n\n').map((par) => {
    const one = par.trim();
    if (!one) return '';
    return /[.!?:;׃]$/.test(one) ? one : one + '.';
  }).filter(Boolean).join('\n\n');

  return t.trim();
}

// Builds the full narration script: title, then a pause, then the body.
export function buildScript({ title, body }) {
  const t = normalizeForSpeech(title);
  const b = normalizeForSpeech(body);
  const head = t ? (/[.!?]$/.test(t) ? t : t + '.') : '';
  return [head, b].filter(Boolean).join('\n\n');
}

// Splits a paragraph into sentences without breaking Hebrew abbreviations or decimals.
function splitSentences(par) {
  const parts = [];
  let buf = '';
  for (let i = 0; i < par.length; i++) {
    const ch = par[i];
    buf += ch;
    if (/[.!?׃]/.test(ch)) {
      const next = par[i + 1];
      const prev = par[i - 1];
      const isDecimal = ch === '.' && /\d/.test(prev || '') && /\d/.test(next || '');
      if (!isDecimal && (next === undefined || /\s/.test(next))) {
        parts.push(buf.trim());
        buf = '';
      }
    }
  }
  if (buf.trim()) parts.push(buf.trim());
  return parts;
}

// Chunks the script on paragraph boundaries first, sentence boundaries second.
// A chunk never splits mid-sentence unless a single sentence exceeds chunkMaxChars.
export function chunkScript(script, { chunkTargetChars = 1200, chunkMaxChars = 1800 } = {}) {
  const paragraphs = script.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
  const chunks = [];
  let cur = [];
  let curLen = 0;

  const flush = () => {
    if (cur.length) chunks.push(cur.join('\n\n'));
    cur = [];
    curLen = 0;
  };

  for (const par of paragraphs) {
    if (curLen && curLen + par.length + 2 > chunkTargetChars) flush();

    if (par.length <= chunkMaxChars) {
      cur.push(par);
      curLen += par.length + 2;
      continue;
    }

    // Oversized paragraph: pack sentences.
    flush();
    let sbuf = [];
    let slen = 0;
    for (const sent of splitSentences(par)) {
      if (slen && slen + sent.length + 1 > chunkTargetChars) {
        chunks.push(sbuf.join(' '));
        sbuf = [];
        slen = 0;
      }
      if (sent.length > chunkMaxChars) {
        // Last resort: hard split on a comma or space near the limit.
        let rest = sent;
        while (rest.length > chunkMaxChars) {
          let cut = rest.lastIndexOf(',', chunkMaxChars);
          if (cut < chunkMaxChars * 0.5) cut = rest.lastIndexOf(' ', chunkMaxChars);
          if (cut < chunkMaxChars * 0.5) cut = chunkMaxChars;
          chunks.push(rest.slice(0, cut + 1).trim());
          rest = rest.slice(cut + 1).trim();
        }
        if (rest) { sbuf.push(rest); slen += rest.length + 1; }
        continue;
      }
      sbuf.push(sent);
      slen += sent.length + 1;
    }
    if (sbuf.length) chunks.push(sbuf.join(' '));
  }
  flush();

  const out = chunks.map((c) => c.trim()).filter(Boolean);
  // Completeness guard: every non-space character of the script must survive chunking.
  const strip = (s) => s.replace(/\s+/g, '');
  if (strip(out.join('')) !== strip(script)) {
    throw new Error('chunking lost or duplicated characters - refusing to continue');
  }
  return out;
}

// Ricos rich content -> reading-order plain text. Used by the Wix backend copy of
// this logic; kept here so the local worker can process a rich-content payload too.
export function richContentToText(rc) {
  if (!rc || !Array.isArray(rc.nodes)) return '';
  const SKIP = new Set(['IMAGE', 'VIDEO', 'GIF', 'EMBED', 'HTML', 'DIVIDER', 'FILE', 'GALLERY', 'AUDIO', 'MAP', 'APP_EMBED', 'CODE_BLOCK', 'BUTTON', 'LINK_PREVIEW', 'POLL']);
  const out = [];
  const walkText = (nodes) => (nodes || []).map((n) => {
    if (n.type === 'TEXT') return n.textData?.text || '';
    return walkText(n.nodes);
  }).join('');
  const walk = (nodes) => {
    for (const n of nodes || []) {
      if (SKIP.has(n.type)) continue;
      if (n.type === 'PARAGRAPH' || n.type === 'HEADING' || n.type === 'BLOCKQUOTE') {
        const t = walkText(n.nodes).trim();
        if (t) out.push(t);
        continue;
      }
      if (n.type === 'BULLETED_LIST' || n.type === 'ORDERED_LIST') {
        for (const li of n.nodes || []) {
          const t = walkText(li.nodes).trim();
          if (t) out.push(t);
        }
        continue;
      }
      if (n.type === 'TABLE') {
        for (const row of n.nodes || []) {
          const cells = (row.nodes || []).map((c) => walkText(c.nodes).trim()).filter(Boolean);
          if (cells.length) out.push(cells.join(', ') + '.');
        }
        continue;
      }
      if (n.type === 'COLLAPSIBLE_LIST') { walk(n.nodes); continue; }
      walk(n.nodes);
    }
  };
  walk(rc.nodes);
  return out.join('\n\n');
}
