/**
 * Hebrew-aware local search — ported from index.html searchNorm / stemsOf /
 * tokenHits / topicHaystack / topicMatches (student catalog search).
 * No network / AI.
 */

export function searchNorm(s: string): string {
  return String(s)
    .replace(/[\u0591-\u05C7]/g, '')
    .replace(/[״"'׳]/g, '')
    .replace(/ך/g, 'כ')
    .replace(/ם/g, 'מ')
    .replace(/ן/g, 'נ')
    .replace(/ף/g, 'פ')
    .replace(/ץ/g, 'צ')
    .replace(/גיאו/g, 'גאו')
    .replace(/[^\u05D0-\u05EA0-9a-zA-Z]+/g, ' ')
    .toLowerCase()
    .trim();
}

export function stemsOf(tok: string): string[] {
  const out = [tok];
  for (const p of ['וה', 'שה', 'מה', 'כש', 'ב', 'ה', 'ל', 'ו', 'מ', 'ש', 'כ']) {
    if (tok.length > p.length + 2 && tok.indexOf(p) === 0) out.push(tok.slice(p.length));
  }
  const more: string[] = [];
  for (const t of out) {
    for (const sf of ['יות', 'ות', 'ים', 'י']) {
      if (t.length > sf.length + 2 && t.slice(-sf.length) === sf) {
        more.push(t.slice(0, -sf.length));
      }
    }
  }
  return out.concat(more);
}

export function tokenHits(qtok: string, hayToks: string[]): boolean {
  const stems = stemsOf(qtok);
  for (const h of hayToks) {
    for (const st of stems) {
      if (st.length < 2) continue;
      if (h.indexOf(st) === 0) return true;
      if (st.indexOf(h) === 0 && h.length >= 3) return true;
    }
  }
  return false;
}

export interface SearchableTopic {
  id: number;
  title: string;
  description?: string;
  group: string;
  parent?: number;
}

export function buildTopicHaystack(
  topic: SearchableTopic,
  groupLabel: string,
  searchExtra: string,
  childTexts: string[]
): string[] {
  const extra = [searchExtra, groupLabel, ...childTexts].join(' ');
  const base = searchNorm(topic.title + ' ' + (topic.description || '') + ' ' + extra)
    .split(' ')
    .filter(Boolean);
  const ex: string[] = [];
  for (const w of base) ex.push(...stemsOf(w));
  return ex;
}

export function topicMatchesQuery(haystack: string[], q: string): boolean {
  const qToks = searchNorm(q).split(' ').filter(Boolean);
  if (!qToks.length) return true;
  return qToks.every((tok) => tokenHits(tok, haystack));
}
