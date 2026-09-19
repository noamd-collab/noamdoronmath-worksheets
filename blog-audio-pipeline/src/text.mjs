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
const MATH_SPAN = /\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]|\$\$[\s\S]*?\$\$/g;

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

// Split only on explicit delimiters supported by the blog renderer.  Keeping
// formulae as atomic segments prevents Markdown cleanup and chunking from
// changing commands such as \sqrt, subscripts, exponents, or unary minus.
export function splitMathSegments(raw) {
  const text = String(raw || '');
  const out = [];
  let cursor = 0;
  MATH_SPAN.lastIndex = 0;
  for (const match of text.matchAll(MATH_SPAN)) {
    if (match.index > cursor) out.push({ math: false, text: text.slice(cursor, match.index) });
    out.push({ math: true, text: match[0] });
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) out.push({ math: false, text: text.slice(cursor) });
  return out;
}

function mapProse(text, transform) {
  return splitMathSegments(text).map((part) => part.math ? part.text : transform(part.text)).join('');
}

export function normalizeForSpeech(raw) {
  let t = String(raw || '')
    .replace(NBSP, ' ')
    .replace(ZERO_WIDTH, '')
    .replace(NIQQUD, '')
    .replace(/\r\n?/g, '\n');

  // Keep a Markdown link's label (which may itself contain delimited LaTeX), but
  // remove its destination. Bare URLs and markup cleanup apply to prose only.
  t = t.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
  t = mapProse(t, (prose) => {
    let p = prose.replace(/https?:\/\/\S+/g, '');

    // Operator and unit rewrites run before markup stripping, so comparison
    // signs in ordinary prose become words. Delimited LaTeX stays untouched.
    for (const [re, to] of REPLACEMENTS) p = p.replace(re, to);

    // Leftover Markdown characters. '>' is only a quote marker at line start.
    p = p.replace(/^[ \t]*>+[ \t]*/gm, '');
    p = p.replace(/[*_`#]{1,3}/g, '');
    return p;
  });

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
  for (const segment of splitMathSegments(par)) {
    if (segment.math) {
      buf += segment.text;
      continue;
    }
    for (let i = 0; i < segment.text.length; i++) {
      const ch = segment.text[i];
      buf += ch;
      if (/[.!?׃]/.test(ch)) {
        const next = segment.text[i + 1];
        const prev = segment.text[i - 1] || buf[buf.length - 2];
        const isDecimal = ch === '.' && /\d/.test(prev || '') && /\d/.test(next || '');
        if (!isDecimal && (next === undefined || /\s/.test(next))) {
          parts.push(buf.trim());
          buf = '';
        }
      }
    }
  }
  if (buf.trim()) parts.push(buf.trim());
  return parts;
}

// Last-resort splitting for a very long sentence.  Formula segments are one
// indivisible unit; an unusually large single formula is allowed to exceed the
// target rather than being corrupted in the middle.
function splitLongSentence(sentence, maxChars) {
  const units = [];
  for (const part of splitMathSegments(sentence)) {
    if (part.math) {
      units.push(part.text);
      continue;
    }
    const words = part.text.match(/\S+\s*/g) || [];
    for (const word of words) {
      if (word.length <= maxChars) {
        units.push(word);
      } else {
        for (let i = 0; i < word.length; i += maxChars) units.push(word.slice(i, i + maxChars));
      }
    }
  }

  const pieces = [];
  let current = '';
  for (const unit of units) {
    if (current && current.length + unit.length > maxChars) {
      pieces.push(current.trim());
      current = '';
    }
    if (!current && unit.length > maxChars) {
      pieces.push(unit.trim());
    } else {
      current += unit;
    }
  }
  if (current.trim()) pieces.push(current.trim());
  return pieces;
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
        // Last resort: split prose on word boundaries, never inside LaTeX.
        if (sbuf.length) {
          chunks.push(sbuf.join(' '));
          sbuf = [];
          slen = 0;
        }
        chunks.push(...splitLongSentence(sent, chunkMaxChars));
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
