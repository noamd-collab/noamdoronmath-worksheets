/** /search URL state: q (as typed) and grade (1–9, absent = all grades). */

export interface SearchUrlState {
  q: string;
  grade: number | null;
}

export function parseSearchUrl(params: URLSearchParams): SearchUrlState {
  const q = (params.get('q') || '').slice(0, 200);
  const g = params.get('grade');
  const grade = g && /^[1-9]$/.test(g) ? Number(g) : null;
  return { q, grade };
}

export function searchHref(state: SearchUrlState): string {
  const params = new URLSearchParams();
  if (state.q.trim()) params.set('q', state.q);
  if (state.grade) params.set('grade', String(state.grade));
  const qs = params.toString();
  return qs ? `/search?${qs}` : '/search';
}
