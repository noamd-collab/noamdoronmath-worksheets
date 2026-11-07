// Native Word text and Office Math. No HTML import, equation images or macros.
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
const xml = (s) => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' + s;
const ns = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const symbols = { tri: '△', angle: '∠', leq: '≤', geq: '≥', neq: '≠', pm: '±', cdot: '·', times: '×', div: '÷', perp: '⊥', parallel: '∥', pi: 'π', alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', degree: '°', circ: '°', infty: '∞', approx: '≈', sim: '∼', cong: '≅', to: '→', in: '∈', cup: '∪', emptyset: '∅' };
const mr = (s, plain = false) => `<m:r>${plain ? '<m:rPr><m:nor/></m:rPr>' : ''}<w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/><w:rtl w:val="0"/></w:rPr><m:t xml:space="preserve">${esc(s)}</m:t></m:r>`;

export function mathXml(input) {
  let s = String(input), i = 0;
  if (s.length > 12000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(s)) throw new Error('WORD_MATH_INVALID');
  const group = () => {
    while (s[i] === ' ') i++;
    if (s[i] !== '{') return atom();
    i++; const out = sequence('}');
    if (s[i++] !== '}') throw new Error('WORD_MATH_GROUP');
    return out;
  };
  const atom = () => {
    if (i >= s.length) throw new Error('WORD_MATH_INCOMPLETE');
    const c = s[i++];
    if (c === '{') { i--; return group(); }
    if (c === '\\') {
      const name = /^[A-Za-z]+/.exec(s.slice(i))?.[0];
      if (!name) {
        const literal = s[i++];
        if (!['{', '}', '%', ',', ';', ' ', '_'].includes(literal)) throw new Error('WORD_MATH_MACRO');
        return mr([',', ';', ' '].includes(literal) ? ' ' : literal);
      }
      i += name.length;
      if (name in symbols) return mr(symbols[name]);
      if (name === 'para') return mr('∥');
      if (name === 'f' || name === 'frac' || name === 'd') return `<m:f><m:num>${group()}</m:num><m:den>${group()}</m:den></m:f>`;
      if (name === 'sqrt') return `<m:rad><m:radPr><m:degHide m:val="1"/></m:radPr><m:deg/><m:e>${group()}</m:e></m:rad>`;
      if (name === 'g') return `<m:d><m:dPr><m:begChr m:val="("/><m:endChr m:val=")"/></m:dPr><m:e>${group()}</m:e></m:d>`;
      if (name === 'rat') return group() + mr(':') + group();
      if (name === 'text' || name === 'mathrm') {
        while (s[i] === ' ') i++;
        if (s[i++] !== '{') throw new Error('WORD_MATH_TEXT');
        const end = s.indexOf('}', i);
        if (end < 0 || /[{}\\]/.test(s.slice(i, end))) throw new Error('WORD_MATH_TEXT');
        const value = s.slice(i, end); i = end + 1; return mr(value, true);
      }
      if (name === 'left' || name === 'right') return '';
      throw new Error('WORD_MATH_UNSUPPORTED_' + name);
    }
    if (c === '/' || c === '⁄') throw new Error('WORD_SLASH_FRACTION');
    if (c === '}' || c === '^' || c === '_') throw new Error('WORD_MATH_SYNTAX');
    return mr(c);
  };
  const sequence = (end = '') => {
    const out = [];
    while (i < s.length && (!end || s[i] !== end)) {
      if (s.startsWith('__', i)) {
        const blank = /^_+/.exec(s.slice(i))[0]; i += blank.length; out.push(mr(blank)); continue;
      }
      if (s[i] === '^' || s[i] === '_') {
        const op = s[i++];
        while (out.at(-1) === mr(' ')) out.pop();
        const base = out.pop(); if (!base) throw new Error('WORD_MATH_SCRIPT');
        const part = group();
        out.push(op === '^' ? `<m:sSup><m:e>${base}</m:e><m:sup>${part}</m:sup></m:sSup>` : `<m:sSub><m:e>${base}</m:e><m:sub>${part}</m:sub></m:sSub>`);
      } else out.push(atom());
    }
    return out.join('').replaceAll('</m:t></m:r>' + mr('').slice(0, -'</m:t></m:r>'.length), '');
  };
  return `<m:oMath>${sequence()}</m:oMath>`;
}

function textRun(text, { bold = false, size = 24 } = {}) {
  return `<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>${bold ? '<w:b/><w:bCs/>' : ''}<w:color w:val="000000"/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/><w:rtl/><w:lang w:val="he-IL" w:bidi="he-IL"/></w:rPr>${String(text).split('\n').map((s) => `<w:t xml:space="preserve">${esc(s)}</w:t>`).join('<w:br/>')}</w:r>`;
}

export function richXml(text, options = {}) {
  const chunks = String(text).replace(/\$\.\s*$/, '$').split('$');
  if (chunks.length % 2 === 0) throw new Error('WORD_UNBALANCED_MATH');
  return chunks.map((s, i) => i % 2 ? mathXml(s) : textRun(i && /^[.,;:!?]/.test(s) ? '\u2060' + s : s, options)).join('');
}

function para(text, { heading = false, title = false, keep = false, pageBreak = false, literal = false } = {}) {
  // Word interprets left/right relative to bidi. Logical left is the RTL start.
  // Avoid "start", whose compatibility behavior differs in older readers.
  // pPr children follow the OOXML sequence: keep, page-break, bidi, spacing, jc.
  return `<w:p><w:pPr>${title ? '<w:pStyle w:val="Title"/>' : heading ? '<w:pStyle w:val="Heading1"/>' : ''}${keep || heading ? '<w:keepNext/>' : ''}<w:keepLines/>${pageBreak ? '<w:pageBreakBefore/>' : ''}<w:bidi/><w:spacing w:before="${heading ? 180 : 0}" w:after="120" w:line="300" w:lineRule="auto"/><w:jc w:val="left"/></w:pPr>${literal ? textRun(text) : richXml(text, { bold: heading || title, size: title ? 36 : heading ? 28 : 24 })}</w:p>`;
}

function tableXml(table) {
  if (!table || !Array.isArray(table.head) || !Array.isArray(table.rows) || !table.head.length || table.head.length > 10) throw new Error('WORD_TABLE');
  const rows = [table.head, ...table.rows];
  if (rows.some((row) => !Array.isArray(row) || row.length !== table.head.length)) throw new Error('WORD_TABLE_COLUMNS');
  const weights = table.head.map((_, i) => Math.max(4, ...rows.map(row => String(row[i]).replace(/\\[A-Za-z]+|[${}\s]/g, '').length)));
  const total = weights.reduce((a,b) => a+b, 0), widths = weights.map(w => Math.floor(9780*w/total));
  return `<w:tbl><w:tblPr><w:bidiVisual/><w:tblW w:w="9780" w:type="dxa"/><w:jc w:val="left"/><w:tblBorders>${['top','left','bottom','right','insideH','insideV'].map((s) => `<w:${s} w:val="single" w:sz="4" w:color="999999"/>`).join('')}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="80" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${widths.map(w => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${rows.map((row, index) => `<w:tr><w:trPr><w:cantSplit/>${!index ? '<w:tblHeader/>' : ''}</w:trPr>${row.map((cell, i) => `<w:tc><w:tcPr><w:tcW w:w="${widths[i]}" w:type="dxa"/></w:tcPr>${para(String(cell), { keep: true })}</w:tc>`).join('')}</w:tr>`).join('')}</w:tbl>${para('', { keep: true })}`;
}

function imageXml(index, image, label) {
  const width = Math.min(480, image.width), height = image.height * width / image.width;
  if (!(width > 0 && height > 0 && height < 700)) throw new Error('WORD_FIGURE_SIZE');
  const cx = Math.round(width * 9525), cy = Math.round(height * 9525);
  return `<w:p><w:pPr><w:keepNext/><w:keepLines/><w:bidi/><w:spacing w:after="120"/><w:jc w:val="center"/></w:pPr><w:r><w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${index}" name="Figure ${index}" descr="${esc(label)}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${index}" name="figure.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="image${index}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
}

// Deterministic ZIP (stored entries). Small selected worksheets need no library.
export function zipFiles(files) {
  const enc = new TextEncoder(), chunks = [], central = []; let offset = 0;
  const crc32 = (bytes) => { let c = 0xffffffff; for (const b of bytes) { c ^= b; for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return (c ^ 0xffffffff) >>> 0; };
  const header = (length) => { const bytes = new Uint8Array(length); return [bytes, new DataView(bytes.buffer)]; };
  for (const [path, value] of Object.entries(files)) {
    const name = enc.encode(path), data = typeof value === 'string' ? enc.encode(value) : value, crc = crc32(data);
    const [local, l] = header(30); l.setUint32(0, 0x04034b50, true); l.setUint16(4, 20, true); l.setUint16(6, 0x800, true); l.setUint16(12, 33, true); l.setUint32(14, crc, true); l.setUint32(18, data.length, true); l.setUint32(22, data.length, true); l.setUint16(26, name.length, true);
    const [cd, d] = header(46); d.setUint32(0, 0x02014b50, true); d.setUint16(4, 20, true); d.setUint16(6, 20, true); d.setUint16(8, 0x800, true); d.setUint16(14, 33, true); d.setUint32(16, crc, true); d.setUint32(20, data.length, true); d.setUint32(24, data.length, true); d.setUint16(28, name.length, true); d.setUint32(42, offset, true);
    chunks.push(local, name, data); central.push(cd, name); offset += local.length + name.length + data.length;
  }
  const centralSize = central.reduce((n, a) => n + a.length, 0), count = Object.keys(files).length;
  const [end, e] = header(22); e.setUint32(0, 0x06054b50, true); e.setUint16(8, count, true); e.setUint16(10, count, true); e.setUint32(12, centralSize, true); e.setUint32(16, offset, true);
  const out = new Uint8Array(offset + centralSize + 22); let at = 0;
  for (const chunk of [...chunks, ...central, end]) { out.set(chunk, at); at += chunk.length; }
  return out;
}

export async function createTeacherDocx({ questions, title = 'דף עבודה במתמטיקה', note = '', showLevel = true, includeAnswers = true }, loadImage) {
  if (!Array.isArray(questions) || !questions.length || questions.length > 100 || note.length > 600) throw new Error('WORD_SELECTION');
  const numbered = new Map(questions.map((q,i) => [q.id, i+1]));
  questions = questions.map(q => {
    const pdfId = String(q.id).split(':')[0];
    if ((q.requiredQuestions || []).some(n => !numbered.has(pdfId + ':' + n))) throw new Error('WORD_CONTEXT_REQUIRED');
    const renumber = part => ({ ...part, text: String(part.text || '').replace(/((?:ב|מ|ל)?שאלה\s+)(\d+)/g,
      (whole, prefix, n) => numbered.has(pdfId + ':' + n) ? prefix + numbered.get(pdfId + ':' + n) : whole) });
    return { ...renumber(q), items: q.items?.map(renumber) };
  });
  const ids = new Set(), files = {}, images = [], body = [];
  body.push(para(title, { title: true }), para('שם התלמיד או התלמידה ____________________    תאריך ______________', { literal: true }));
  if (note) body.push(para(note, { literal: true }));
  const appendContent = async (part, seen) => {
    if (part.example) {
      if (part.example.title) body.push(para(part.example.title, { keep: true }));
      for (const line of part.example.lines || []) body.push(para(line, { keep: true }));
    }
    if (part.text) body.push(para(part.text, { keep: true }));
    if (part.table) body.push(tableXml(part.table));
    if (part.figure && !seen.has(part.figure.url)) {
      seen.add(part.figure.url);
      const image = await loadImage(part.figure); const index = images.length + 1;
      images.push(index); files[`word/media/figure${index}.png`] = image.bytes;
      body.push(imageXml(index, image, 'השרטוט המקורי של השאלה'));
    }
  };
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (!q.id || ids.has(q.id) || !Array.isArray(q.items) || !q.items.length || (includeAnswers && q.items.some((p) => !p.answer?.trim()))) throw new Error('WORD_INCOMPLETE_ANSWERS');
    ids.add(q.id);
    body.push(para([`שאלה ${i + 1}`, q.topic, showLevel ? q.levelLabel : ''].filter(Boolean).join(' · '), { heading: true }));
    const seen = new Set(); await appendContent(q, seen);
    for (const part of q.items) await appendContent({ ...part, text: part.label ? part.label + '. ' + part.text : part.text }, seen);
    body.push(para('________________________________________________________________', { literal: true }));
  }
  if (includeAnswers) {
    body.push(para('תשובות סופיות', { title: true, pageBreak: true }));
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]; body.push(para([`שאלה ${i + 1}`, q.topic, showLevel ? q.levelLabel : ''].filter(Boolean).join(' · '), { heading: true }));
      for (const [index, part] of q.items.entries()) body.push(para((part.label ? part.label + '. ' : '') + part.answer, { keep: index < q.items.length - 1 }));
    }
  }
  const rel = (id, type, target) => `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}"/>`;
  files['[Content_Types].xml'] = xml('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/>' + ['document','styles','settings','header1','footer1'].map((name) => `<Override PartName="/word/${name}.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.${{document:'document.main',styles:'styles',settings:'settings',header1:'header',footer1:'footer'}[name]}+xml"/>`).join('') + '</Types>');
  files['_rels/.rels'] = xml('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + rel('document', 'officeDocument', 'word/document.xml') + '</Relationships>');
  files['word/_rels/document.xml.rels'] = xml('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + rel('styles','styles','styles.xml') + rel('settings','settings','settings.xml') + rel('header','header','header1.xml') + rel('footer','footer','footer1.xml') + images.map((n) => rel('image' + n,'image',`media/figure${n}.png`)).join('') + '</Relationships>');
  files['word/document.xml'] = xml(`<w:document ${ns}><w:body>${body.join('')}<w:sectPr><w:headerReference w:type="default" r:id="header"/><w:footerReference w:type="default" r:id="footer"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="907" w:right="1020" w:bottom="907" w:left="1020" w:header="400" w:footer="400"/><w:bidi/></w:sectPr></w:body></w:document>`);
  files['word/styles.xml'] = xml(`<w:styles ${ns}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:rtl/><w:lang w:val="he-IL" w:bidi="he-IL"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:bidi/><w:jc w:val="left"/></w:pPr></w:pPrDefault></w:docDefaults>${[['Normal','Normal'],['Title','Title'],['Heading1','heading 1']].map(([id,name]) => `<w:style w:type="paragraph" w:styleId="${id}"${id === 'Normal' ? ' w:default="1"' : ''}><w:name w:val="${name}"/>${id !== 'Normal' ? '<w:basedOn w:val="Normal"/>' : ''}<w:qFormat/><w:pPr><w:bidi/><w:jc w:val="left"/></w:pPr></w:style>`).join('')}</w:styles>`);
  files['word/settings.xml'] = xml(`<w:settings ${ns}><w:defaultTabStop w:val="720"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat><m:mathPr><m:mathFont m:val="Cambria Math"/></m:mathPr><w:themeFontLang w:val="he-IL" w:bidi="he-IL"/></w:settings>`);
  files['word/header1.xml'] = xml(`<w:hdr ${ns}>${para('בס״ד   מתמטיקה · נועם דורון', { literal: true })}</w:hdr>`);
  files['word/footer1.xml'] = xml(`<w:ftr ${ns}><w:p><w:pPr><w:bidi/><w:jc w:val="center"/></w:pPr>${textRun('נועם דורון · מתמטיקה  |  ')}<w:fldSimple w:instr="PAGE">${textRun('1')}</w:fldSimple></w:p></w:ftr>`);
  return zipFiles(files);
}

export async function loadWordFigure(figure) {
  const png = /^\/teachers\/word-figures\/([a-f0-9]{64})\.png$/.exec(figure.url);
  const svg = /^\/noam-ai\/native\/[A-Za-z0-9_-]+\/[abc]\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]+\.svg$/.test(figure.url);
  if ((!svg && (!png || png[1] !== figure.sha256)) || !/^[a-f0-9]{64}$/.test(figure.sha256)) throw new Error('WORD_FIGURE_SOURCE');
  const response = await fetch(figure.url, { credentials: 'same-origin', signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error('WORD_FIGURE_FETCH');
  const bytes = await response.arrayBuffer();
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (n) => n.toString(16).padStart(2, '0')).join('');
  if (digest !== figure.sha256) throw new Error('WORD_FIGURE_CHANGED');
  const url = URL.createObjectURL(new Blob([bytes], { type: png ? 'image/png' : 'image/svg+xml' }));
  try {
    const image = new Image(); image.src = url; await image.decode();
    const width = image.naturalWidth, height = image.naturalHeight;
    if (!(width > 0 && height > 0) || width * height > 4000000) throw new Error('WORD_FIGURE_SIZE');
    const canvas = document.createElement('canvas'); canvas.width = width * 2; canvas.height = height * 2;
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve, reject) => canvas.toBlob((b) => b ? resolve(b) : reject(new Error('WORD_FIGURE_ENCODE')), 'image/png'));
    const displayWidth = Math.min(width, Number(figure.displayWidthPx) || width);
    return { bytes: new Uint8Array(await blob.arrayBuffer()), width: displayWidth, height: height * displayWidth / width };
  } finally { URL.revokeObjectURL(url); }
}
