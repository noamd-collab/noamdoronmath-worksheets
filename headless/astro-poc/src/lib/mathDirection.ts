/**
 * Keep math runs left-to-right inside RTL Hebrew paragraphs.
 * Unicode LRI (U+2066) … PDI (U+2069) isolates the run without changing the
 * stored JSON or the markup in TopicPage.astro.
 */
import type {
  BlogBodyBlock,
  BlogInlineSegment,
  BlogListItem,
  BlogPostContent,
} from './blogPosts';

const LRI = '\u2066';
const PDI = '\u2069';
const ISOLATE = /[\u2066\u2067\u2068\u2069]/g;

/** Digits, variables, and operators that are enough to mark a real math run. */
function isCore(ch: string): boolean {
  if (/[0-9A-Za-z]/.test(ch)) return true;
  if ('⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻ⁿ₀₁₂₃₄₅₆₇₈₉'.includes(ch)) return true;
  return '−+×÷=≠<>≤≥±√∞%*'.includes(ch);
}

/** Symbols that may sit inside a math run (parentheses, degree, dashes, …). */
function isMathSymbol(ch: string): boolean {
  if (isCore(ch)) return true;
  return '()[]{}|∥⊥∠^/~·∙′″⁄–—:+'.includes(ch) || ch === '-';
}

function isGlue(ch: string): boolean {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\u00a0' || ch === ',';
}

function isDecimalPoint(text: string, i: number): boolean {
  return (
    text[i] === '.' &&
    i > 0 &&
    i + 1 < text.length &&
    /[0-9]/.test(text[i - 1]!) &&
    /[0-9]/.test(text[i + 1]!)
  );
}

function isMathAt(text: string, i: number): boolean {
  return isMathSymbol(text[i]!) || isDecimalPoint(text, i);
}

/**
 * Wrap math runs in LRI…PDI. A paragraph that is only math (optional
 * surrounding whitespace) is wrapped as one isolate.
 */
export function isolateMathRuns(input: string): string {
  if (!input) return input;
  const text = input.replace(ISOLATE, '');
  if (!text) return input;

  const core = text.trim();
  const spanEnd = mathSpanEnd(core, 0);
  if (spanEnd === core.length && [...core].some(isCore)) {
    return LRI + text + PDI;
  }

  let out = '';
  let i = 0;
  while (i < text.length) {
    if (!isMathAt(text, i)) {
      out += text[i];
      i += 1;
      continue;
    }
    const end = mathSpanEnd(text, i);
    const slice = text.slice(i, end);
    if ([...slice].some(isCore)) out += LRI + slice + PDI;
    else out += slice;
    i = end;
  }
  return out;
}

/** End index (exclusive) of the math span that starts at `start`. */
function mathSpanEnd(text: string, start: number): number {
  let j = start;
  while (j < text.length) {
    if (isMathAt(text, j)) {
      j += 1;
      continue;
    }
    if (isGlue(text[j]!)) {
      let k = j;
      while (k < text.length && isGlue(text[k]!)) k += 1;
      if (k < text.length && isMathAt(text, k)) {
        j = k;
        continue;
      }
    }
    break;
  }
  return j;
}

function isolateSegment(seg: BlogInlineSegment): BlogInlineSegment {
  return { ...seg, text: isolateMathRuns(seg.text) };
}

function isolateListItem(item: BlogListItem): BlogListItem {
  return {
    ...item,
    text: isolateMathRuns(item.text),
    linkText: item.linkText ? isolateMathRuns(item.linkText) : item.linkText,
    segments: item.segments?.map(isolateSegment),
  };
}

function isolateBlogBlock(block: BlogBodyBlock): BlogBodyBlock {
  if (block.type === 'h2' || block.type === 'h3' || block.type === 'h4' || block.type === 'blockquote') {
    return { ...block, text: isolateMathRuns(block.text) };
  }
  if (block.type === 'p') {
    return {
      ...block,
      text: isolateMathRuns(block.text),
      segments: block.segments?.map(isolateSegment),
    };
  }
  if (block.type === 'ul' || block.type === 'ol') {
    return { ...block, items: block.items.map(isolateListItem) };
  }
  if (block.type === 'figure') {
    return {
      ...block,
      alt: isolateMathRuns(block.alt),
      caption: block.caption ? isolateMathRuns(block.caption) : block.caption,
    };
  }
  if (block.type === 'img') return { ...block, alt: isolateMathRuns(block.alt) };
  if (block.type === 'table') {
    return { ...block, rows: block.rows.map((row) => row.map((cell) => isolateMathRuns(cell))) };
  }
  if (block.type === 'a') return { ...block, text: isolateMathRuns(block.text) };
  return block;
}

/** Visible blog prose only. JSON-LD and hrefs stay as stored. */
export function isolateBlogPostDisplay(post: BlogPostContent): BlogPostContent {
  return {
    ...post,
    h1: isolateMathRuns(post.h1),
    blocks: post.blocks.map(isolateBlogBlock),
    faq: post.faq
      ? {
          ...post.faq,
          heading: isolateMathRuns(post.faq.heading),
          items: post.faq.items.map((item) => ({
            question: isolateMathRuns(item.question),
            answer: isolateMathRuns(item.answer),
          })),
        }
      : post.faq,
    whatsapp: post.whatsapp
      ? {
          ...post.whatsapp,
          heading: isolateMathRuns(post.whatsapp.heading),
          body: isolateMathRuns(post.whatsapp.body),
          ctaLabel: post.whatsapp.ctaLabel
            ? isolateMathRuns(post.whatsapp.ctaLabel)
            : post.whatsapp.ctaLabel,
          note: post.whatsapp.note ? isolateMathRuns(post.whatsapp.note) : post.whatsapp.note,
        }
      : post.whatsapp,
    recentPosts: post.recentPosts
      ? {
          ...post.recentPosts,
          heading: isolateMathRuns(post.recentPosts.heading),
          items: post.recentPosts.items.map((item) => ({
            ...item,
            title: isolateMathRuns(item.title),
            description: item.description ? isolateMathRuns(item.description) : item.description,
          })),
        }
      : post.recentPosts,
    authorEditor: post.authorEditor
      ? { ...post.authorEditor, text: isolateMathRuns(post.authorEditor.text) }
      : post.authorEditor,
    related: post.related.map((rel) => ({ ...rel, text: isolateMathRuns(rel.text) })),
  };
}
