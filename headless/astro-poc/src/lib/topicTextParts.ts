/**
 * Split topic prose into the parts TopicPage renders.
 *
 * Each LRI…PDI math isolate is one part. isolateMathRuns now keeps a stored
 * fraction ⟨numerator¦denominator⟩ inside its formula's isolate, so
 * TopicInline sees whole markers and draws stacked fractions. Before that, a
 * marker became ⟨⁦2⁩¦⁦3⁩⟩, was cut into five parts here, and the page showed
 * the raw ⟨2¦3⟩ (live on /fraction-multiplication-apply-grade-6, 2.11.2026).
 *
 * A formula that holds a fraction stays on one line (AGENTS.md: keep a
 * formula on one line when it would break). The longest such formula in the
 * topic pages is about 21 visible characters, so it fits a 390px screen.
 */
const LRI = '\u2066';
const PDI = '\u2069';
const ISOLATED_RUN = new RegExp(`${LRI}([^${PDI}]*)${PDI}`, 'g');
const FRACTION_MARKER = /⟨[^⟨⟩¦]+¦[^⟨⟩]+⟩/;

export type TopicTextPart = { text: string; nowrap: boolean };

export function topicTextParts(text: string, nowrapMath: ReadonlySet<string> = new Set()): TopicTextPart[] {
  const parts: TopicTextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(ISOLATED_RUN)) {
    const index = match.index ?? 0;
    const inner = match[1] ?? '';
    if (index > last) parts.push({ text: text.slice(last, index), nowrap: false });
    parts.push({ text: match[0], nowrap: nowrapMath.has(inner) || FRACTION_MARKER.test(inner) });
    last = index + match[0].length;
  }
  if (last < text.length || parts.length === 0) parts.push({ text: text.slice(last), nowrap: false });
  return parts;
}
