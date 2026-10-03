import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type MouseEvent } from 'react';
import '../styles/exact-catalog.css';
import '../styles/site-search.css';
import type { PreparedIndex } from '../lib/siteSearch/engine';
import type { SearchResponse, SearchResult } from '../lib/siteSearch/types';
import { parseSearchUrl, searchHref, type SearchUrlState } from '../lib/siteSearch/url';

export interface SiteSearchProps {
  /** Answer computed on the server for the URL the page was opened with. */
  initial: SearchResponse;
  initialState: SearchUrlState;
  gradeLabels: Record<string, string>;
}

const KIND_LABEL = { topic: 'דפי עבודה', page: 'הסבר', post: 'מאמר בבלוג' } as const;
const EXAMPLES = ['שברים', 'פיתגורס', 'משוואות', 'שטח משולש', 'לוח הכפל', 'אחוזים'];

type Engine = { prepared: PreparedIndex; search: typeof import('../lib/siteSearch/engine').search };

/** Same level colours as the catalog cards. */
function levelClass(key: string): string {
  if (key === 'c') return 'lvl lvl--c';
  if (key === 'b') return 'lvl lvl--b';
  if (key === 'one') return 'lvl lvl--a lvl--one';
  return 'lvl lvl--a';
}

function statusText(r: SearchResponse, labels: Record<string, string>): string {
  const where = r.grade ? ` ב${labels[String(r.grade)] || `כיתה ${r.grade}`}` : '';
  if (r.empty) return r.grade ? `חיפוש${where}: הקלידו נושא או מושג` : 'הקלידו נושא, מושג או כיתה';
  if (!r.results.length) return `לא נמצאו תוצאות${where}`;
  return r.results.length === 1 ? `נמצאה תוצאה אחת${where}` : `נמצאו ${r.results.length} תוצאות${where}`;
}

export function SiteSearch({ initial, initialState, gradeLabels }: SiteSearchProps) {
  const [state, setState] = useState<SearchUrlState>(initialState);
  const [response, setResponse] = useState<SearchResponse>(initial);
  const [loadError, setLoadError] = useState(false);
  const engine = useRef<Engine | null>(null);
  const loading = useRef<Promise<Engine> | null>(null);
  /** The current history entry holds a finished search; the next keystroke starts a new entry. */
  const committed = useRef(true);
  const inputId = useId();
  const statusId = useId();
  const hintId = useId();

  const ensureEngine = useCallback((): Promise<Engine> => {
    if (engine.current) return Promise.resolve(engine.current);
    loading.current ??= import('../lib/siteSearch/client').then(async (m) => {
      const prepared = await m.loadSearchIndex();
      engine.current = { prepared, search: m.search };
      return engine.current;
    });
    loading.current.catch(() => {
      loading.current = null;
      setLoadError(true);
    });
    return loading.current;
  }, []);

  const run = useCallback(
    async (next: SearchUrlState, live: boolean) => {
      const e = await ensureEngine();
      setLoadError(false);
      setResponse(e.search(e.prepared, next.q, { grade: next.grade, live }));
    },
    [ensureEngine]
  );

  const writeUrl = (next: SearchUrlState, push: boolean) => {
    const href = searchHref(next);
    if (`${location.pathname}${location.search}` === href) return;
    if (push) history.pushState(null, '', href);
    else history.replaceState(null, '', href);
  };

  // Back/forward: the URL is the state.
  useEffect(() => {
    const onPop = () => {
      const next = parseSearchUrl(new URL(location.href).searchParams);
      committed.current = true;
      setState(next);
      void run(next, false).catch(() => undefined);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [run]);

  // Live search while typing, debounced.
  const timer = useRef<number | undefined>(undefined);
  function onInput(value: string) {
    const next = { ...state, q: value };
    setState(next);
    writeUrl(next, committed.current);
    committed.current = false;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void run(next, true).catch(() => undefined), 120);
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    // Without the engine (still loading or unavailable) the form submits to the server.
    if (!engine.current) return;
    e.preventDefault();
    window.clearTimeout(timer.current);
    writeUrl(state, committed.current);
    committed.current = true;
    void run(state, false);
  }

  /** Links inside the page that only change q/grade are handled here (and still work without JS). */
  function follow(e: MouseEvent<HTMLAnchorElement>, next: SearchUrlState) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    window.clearTimeout(timer.current);
    setState(next);
    writeUrl(next, true);
    committed.current = true;
    void run(next, false).catch(() => {
      location.href = searchHref(next);
    });
  }

  const r = response;
  const queryGrade = r.gradeSource === 'query' ? r.grade : null;
  const activeGrade = r.grade ?? state.grade;
  /** Grade chips replace a grade written in the query, so it is taken out of q. */
  const chipQ = queryGrade ? r.textWithoutGrade : state.q;

  return (
    <div className="exact-catalog site-search" data-site-search>
      <header className="exact-catalog-heading">
        <h1>חיפוש באתר</h1>
        <p>מחפשים נושא, מושג או כיתה? כאן מוצאים את דפי העבודה, ההסברים והמאמרים המתאימים.</p>
      </header>

      <form className="toolbar" role="search" action="/search" method="get" onSubmit={onSubmit}>
        <div className="search">
          <span className="exact-search-icon" aria-hidden="true">⌕</span>
          <label className="sr-only" htmlFor={inputId}>
            חיפוש באתר
          </label>
          <input
            id={inputId}
            type="search"
            name="q"
            value={state.q}
            onChange={(e) => onInput(e.target.value)}
            onFocus={() => void ensureEngine().catch(() => undefined)}
            placeholder="למשל: שברים כיתה ה, פיתגורס, שטח משולש"
            autoComplete="off"
            enterKeyHint="search"
            maxLength={200}
            aria-describedby={`${hintId} ${statusId}`}
            data-site-search-input
          />
          {state.grade ? <input type="hidden" name="grade" value={state.grade} /> : null}
          <button type="submit" className="site-search__submit">
            חיפוש
          </button>
        </div>
        <p id={hintId} className="site-search__hint">
          אפשר לכתוב כיתה בחיפוש (״כיתה ה״) או לבחור כיתה למטה. החיפוש מציג רק את הכיתה שנבחרה.
        </p>
        <nav className="chips" aria-label="סינון לפי כיתה">
          <a
            className="chip"
            href={searchHref({ q: chipQ, grade: null })}
            aria-current={activeGrade === null ? 'page' : undefined}
            onClick={(e) => follow(e, { q: chipQ, grade: null })}
          >
            כל הכיתות
          </a>
          {Object.entries(gradeLabels).map(([g, label]) => {
            const n = Number(g);
            return (
              <a
                key={g}
                className="chip"
                href={searchHref({ q: chipQ, grade: n })}
                aria-current={activeGrade === n ? 'page' : undefined}
                onClick={(e) => follow(e, { q: chipQ, grade: n })}
              >
                {label}
              </a>
            );
          })}
        </nav>
      </form>

      <p id={statusId} className="status" role="status" aria-live="polite" data-site-search-status>
        {statusText(r, gradeLabels)}
        {queryGrade ? <span className="site-search__note"> · הכיתה נלקחה מהחיפוש</span> : null}
      </p>
      {loadError ? (
        <p className="site-search__notice" role="alert">
          החיפוש המיידי לא נטען. אפשר ללחוץ על ״חיפוש״ ולקבל תוצאות מהשרת.
        </p>
      ) : null}

      {r.corrections.length ? (
        <p className="site-search__notice" data-site-search-correction>
          {r.corrections.map((c, i) => (
            <span key={i}>
              {i ? ' ' : ''}לא מצאנו באתר את המילה „{c.from}”. מוצגות תוצאות עבור „{c.to}” — ייתכן שלזה התכוונתם.
            </span>
          ))}
        </p>
      ) : null}

      {r.empty ? (
        <EmptyQuery r={r} follow={follow} gradeLabels={gradeLabels} />
      ) : r.results.length ? (
        <ol className="site-search__results" aria-label="תוצאות החיפוש" data-site-search-results>
          {r.results.map((res) => (
            <li key={res.key}>
              <ResultCard res={res} />
            </li>
          ))}
        </ol>
      ) : (
        <NoResults r={r} state={state} follow={follow} />
      )}

      {r.otherGrades.length && r.results.length ? (
        <OtherGrades r={r} follow={follow} heading="יש תוצאות גם בכיתות אחרות" />
      ) : null}
    </div>
  );
}

function ResultCard({ res }: { res: SearchResult }) {
  const childLevels = res.levels.filter((l) => l.of);
  const ownLevels = res.levels.filter((l) => !l.of);
  const titleId = `r-${res.key.replace(/[^a-z0-9]+/gi, '-')}`;
  return (
    <article className={`card site-search__card site-search__card--${res.kind}`} aria-labelledby={titleId} data-result-key={res.key}>
      <div className="site-search__meta">
        <span className={`site-search__kind site-search__kind--${res.kind}`}>{KIND_LABEL[res.kind]}</span>
        {res.gradeLabel ? <span className="site-search__grade">{res.gradeLabel}</span> : null}
        {res.group ? <span className="site-search__group">{res.group}</span> : null}
        {res.reduced ? <span className="site-search__group">רמה מצומצמת</span> : null}
      </div>
      <h3 id={titleId}>
        <a href={res.href}>
          {res.titleParts.map((part, i) => (part.hit ? <mark key={i}>{part.text}</mark> : <span key={i}>{part.text}</span>))}
        </a>
      </h3>
      {res.description ? <p className="exact-card-description">{res.description}</p> : null}
      {res.kind === 'topic' ? (
        <>
          {childLevels.length ? (
            <div className="site-search__bundle">
              {[...new Set(childLevels.map((l) => l.of))].map((of) => (
                <div key={of} className="site-search__sub">
                  <span className="site-search__subtitle">{of}</span>
                  <div className="levels" role="group" aria-label={`${of} — דפי עבודה לפי רמה`}>
                    {childLevels
                      .filter((l) => l.of === of)
                      .map((l) => (
                        <a key={l.href} className={levelClass(l.key)} href={l.href} target="_blank" rel="noopener noreferrer" aria-label={`${of} — ${l.label}, נפתח בלשונית חדשה`}>
                          {l.label}
                        </a>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          {ownLevels.length ? (
            <div className="levels" role="group" aria-label={`${res.title} — דפי עבודה לפי רמה`}>
              {ownLevels.map((l) => (
                <a key={l.href} className={levelClass(l.key)} href={l.href} target="_blank" rel="noopener noreferrer" aria-label={`${res.title} — ${l.label}, נפתח בלשונית חדשה`}>
                  {l.label}
                </a>
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <p className="site-search__action">
          <a href={res.href}>{res.kind === 'page' ? 'לקריאת ההסבר' : 'לקריאת המאמר'}</a>
        </p>
      )}
      {res.explainers.length || res.posts.length ? (
        <ul className="site-search__related" aria-label="עוד על הנושא">
          {res.explainers.map((x) => (
            <li key={x.href}>
              <span className="site-search__kind site-search__kind--page">הסבר</span> <a href={x.href}>{x.title}</a>
            </li>
          ))}
          {res.posts.map((x) => (
            <li key={x.href}>
              <span className="site-search__kind site-search__kind--post">מאמר</span> <a href={x.href}>{x.title}</a>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

type Follow = (e: MouseEvent<HTMLAnchorElement>, next: SearchUrlState) => void;

function OtherGrades({ r, follow, heading }: { r: SearchResponse; follow: Follow; heading: string }) {
  const q = r.gradeSource === 'query' ? r.textWithoutGrade : r.query;
  const total = r.otherGrades.reduce((n, g) => n + g.count, 0);
  return (
    <section className="site-search__other" aria-label={heading} data-site-search-other>
      <h2>{heading}</h2>
      <p>
        {r.otherGrades.map((g) => (
          <a key={g.grade} className="chip" href={searchHref({ q, grade: g.grade })} onClick={(e) => follow(e, { q, grade: g.grade })}>
            {g.label} ({g.count})
          </a>
        ))}
        <a className="chip" href={searchHref({ q, grade: null })} onClick={(e) => follow(e, { q, grade: null })}>
          בכל הכיתות ({total + r.results.length})
        </a>
      </p>
    </section>
  );
}

function NoResults({ r, state, follow }: { r: SearchResponse; state: SearchUrlState; follow: Follow }) {
  return (
    <div className="empty site-search__empty" data-site-search-empty>
      <img src="/design-exact/assets/doodles/snail.webp" alt="" />
      <h2>לא מצאנו תוצאות{r.grade ? ' בכיתה הזו' : ''}</h2>
      <p>בדקו את האיות, נסו מילה אחרת או חפשו מילה אחת בכל פעם.</p>
      {r.suggestions.length ? (
        <p className="site-search__suggest">
          אפשר לחפש רק:{' '}
          {r.suggestions.map((s) => (
            <a key={s.query} className="chip" href={searchHref({ q: s.query, grade: state.grade })} onClick={(e) => follow(e, { q: s.query, grade: state.grade })}>
              {s.query} ({s.count})
            </a>
          ))}
        </p>
      ) : null}
      {r.otherGrades.length ? <OtherGrades r={r} follow={follow} heading="נמצאו תוצאות בכיתות אחרות" /> : null}
      <p className="site-search__suggest">
        {state.grade ? (
          <a className="chip" href={searchHref({ q: state.q, grade: null })} onClick={(e) => follow(e, { q: state.q, grade: null })}>
            ניקוי סינון הכיתה
          </a>
        ) : null}
        <a className="chip" href={searchHref({ q: '', grade: null })} onClick={(e) => follow(e, { q: '', grade: null })}>
          ניקוי החיפוש
        </a>
        <a className="chip" href={r.grade ? `/worksheets?grade=${r.grade}` : '/worksheets'}>
          לכל דפי העבודה
        </a>
      </p>
    </div>
  );
}

function EmptyQuery({ r, follow, gradeLabels }: { r: SearchResponse; follow: Follow; gradeLabels: Record<string, string> }) {
  return (
    <div className="site-search__start">
      {r.grade ? (
        <p>
          <a href={`/worksheets?grade=${r.grade}`}>לכל הנושאים של {gradeLabels[String(r.grade)]}</a>
        </p>
      ) : null}
      <p className="site-search__suggest">
        דוגמאות:{' '}
        {EXAMPLES.map((q) => (
          <a key={q} className="chip" href={searchHref({ q, grade: r.grade })} onClick={(e) => follow(e, { q, grade: r.grade })}>
            {q}
          </a>
        ))}
      </p>
    </div>
  );
}
