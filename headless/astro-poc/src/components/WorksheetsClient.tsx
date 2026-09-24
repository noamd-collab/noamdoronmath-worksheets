import { useMemo, useState, useId, useCallback, useEffect, useRef } from 'react';
import type { CatalogGrade, CatalogGroup, CatalogTopic, CatalogV1 } from '../lib/catalog/types';
import {
  familyOf,
  familySearchLabel,
  otherFamily,
  otherFamilyJumpLabel,
  schoolFamilyOf,
  type GradeNum,
} from '../lib/grades';
import { GradeNav } from './GradeNav';
import {
  buildTopicHaystack,
  topicMatchesQuery,
} from '../lib/search';
import { buildWorksheetHref } from '../lib/worksheetLinks';
import {
  buildWorksheetsHref,
  parseWorksheetsUrlState,
  worksheetsBackPath,
  worksheetsHrefForGrade,
  type TrackMode,
  type WorksheetsUrlState,
} from '../lib/worksheetsUrlState';

export interface WorksheetsClientProps {
  catalog: CatalogV1;
  grade: GradeNum;
  gradeEntry: CatalogGrade;
  /** All grades in the active school family (for cross-grade search scope). */
  familyGrades: CatalogGrade[];
  /** Optional catalog topic id from ?topic= for highlight/scroll (M18). */
  highlightTopicId?: number | null;
  /** SSR-parsed URL state (q/group/cross/track) — client re-reads on popstate. */
  initialUrlState?: Partial<Omit<WorksheetsUrlState, 'grade'>>;
}

function levelClass(key: string): string {
  if (key === 'c') return 'lvl lvl--c';
  if (key === 'b') return 'lvl lvl--b';
  if (key === 'one') return 'lvl lvl--a lvl--one';
  return 'lvl lvl--a';
}

function isReducedGroup(g: CatalogGroup): boolean {
  return !!g.reducedProgram;
}

function readBrowserState(grade: GradeNum): WorksheetsUrlState {
  if (typeof window === 'undefined') {
    return { grade, q: '', group: 'all', cross: false, track: 'reg', topic: null };
  }
  return parseWorksheetsUrlState(new URL(window.location.href).searchParams, grade);
}

export function WorksheetsClient(props: WorksheetsClientProps) {
  const { catalog, grade, gradeEntry, familyGrades, highlightTopicId = null, initialUrlState } =
    props;

  const boot = {
    q: initialUrlState?.q ?? '',
    group: initialUrlState?.group ?? 'all',
    cross: !!initialUrlState?.cross,
    track: (grade === 9 ? initialUrlState?.track ?? 'reg' : 'reg') as TrackMode,
  };

  const [q, setQ] = useState(boot.q);
  const [group, setGroup] = useState(boot.group);
  const [track, setTrack] = useState<TrackMode>(boot.track);
  const [cross, setCross] = useState(boot.cross);
  const searchId = useId();
  const statusId = useId();
  const listId = 'topic-list';
  const crossId = useId();
  const skipUrlWrite = useRef(false);

  const gradeNames = catalog.config.gradeNames;
  const gradeEmojis = catalog.config.gradeEmojis;
  const gradeLabel = gradeEntry.label;
  const gradeEmoji = gradeEntry.emoji || gradeEmojis[String(grade)] || '';

  const showTrack = grade === 9;

  const catalogState: WorksheetsUrlState = useMemo(
    () => ({
      grade,
      q,
      group,
      cross,
      track: showTrack ? track : 'reg',
      topic: highlightTopicId,
    }),
    [grade, q, group, cross, track, showTrack, highlightTopicId]
  );

  const gradeHref = useCallback(
    (g: GradeNum) =>
      worksheetsHrefForGrade(g, {
        q,
        cross,
        track: showTrack ? track : 'reg',
      }),
    [q, cross, track, showTrack]
  );

  // Sync React filter state → URL (replaceState so grade-tab history keeps prior q).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (skipUrlWrite.current) {
      skipUrlWrite.current = false;
      return;
    }
    const next = buildWorksheetsHref(catalogState);
    const cur = `${window.location.pathname}${window.location.search}`;
    if (cur === next) return;
    window.history.replaceState(window.history.state, '', next);
  }, [catalogState]);

  // Browser Back/Forward within same document (rare) or bfcache restore.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onPop = () => {
      const s = readBrowserState(grade);
      skipUrlWrite.current = true;
      setQ(s.q);
      setGroup(s.group);
      setCross(s.cross);
      if (showTrack) setTrack(s.track);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [grade, showTrack]);

  useEffect(() => {
    if (highlightTopicId == null) return;
    const el = document.querySelector(`[data-topic-id="${highlightTopicId}"]`);
    if (!(el instanceof HTMLElement)) return;
    el.classList.add('is-topic-target');
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightTopicId, grade]);

  // Preserve catalog scroll when returning from viewer via `back=` (new document load).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const KEY = 'noam-worksheets-scroll-v1';
    try {
      const raw = sessionStorage.getItem(KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { href?: string; y?: number; t?: number };
      const cur = `${window.location.pathname}${window.location.search}`;
      if (!saved || saved.href !== cur || typeof saved.y !== 'number') return;
      if (typeof saved.t === 'number' && Date.now() - saved.t > 30 * 60 * 1000) {
        sessionStorage.removeItem(KEY);
        return;
      }
      sessionStorage.removeItem(KEY);
      const y = saved.y;
      requestAnimationFrame(() => {
        window.scrollTo(0, y);
      });
    } catch {
      /* ignore */
    }
  }, [grade, q, group, cross, track]);

  const activeGroups = useMemo(() => {
    if (!showTrack) return gradeEntry.groups;
    return gradeEntry.groups.filter((g) =>
      track === 'red' ? isReducedGroup(g) : !isReducedGroup(g)
    );
  }, [gradeEntry.groups, showTrack, track]);

  // If URL group key is not in this grade/track, fall back to all.
  useEffect(() => {
    if (group === 'all') return;
    if (!activeGroups.some((g) => g.key === group)) {
      setGroup('all');
    }
  }, [activeGroups, group]);

  const groupLabelMaps = useMemo(() => {
    const maps = new Map<number, Map<string, string>>();
    for (const g of familyGrades) {
      const m = new Map<string, string>();
      for (const gr of g.groups) m.set(gr.key, gr.label);
      maps.set(g.grade, m);
    }
    return maps;
  }, [familyGrades]);

  const childrenByParentByGrade = useMemo(() => {
    const out = new Map<number, Map<number, CatalogTopic[]>>();
    for (const g of familyGrades) {
      const map = new Map<number, CatalogTopic[]>();
      for (const t of g.topics) {
        if (t.parent === undefined) continue;
        const list = map.get(t.parent) || [];
        list.push(t);
        map.set(t.parent, list);
      }
      out.set(g.grade, map);
    }
    return out;
  }, [familyGrades]);

  const haystacksByGrade = useMemo(() => {
    const out = new Map<number, Map<number, string[]>>();
    for (const g of familyGrades) {
      const searchTerms = catalog.searchTerms[String(g.grade)] || {};
      const childrenMap = childrenByParentByGrade.get(g.grade) || new Map();
      const labels = groupLabelMaps.get(g.grade) || new Map();
      const m = new Map<number, string[]>();
      for (const t of g.topics) {
        if (t.parent !== undefined) continue;
        const children: CatalogTopic[] = childrenMap.get(t.id) || [];
        const childTexts = children.map((c: CatalogTopic) => c.title + ' ' + (c.description || ''));
        m.set(
          t.id,
          buildTopicHaystack(
            t,
            labels.get(t.group) || '',
            searchTerms[String(t.id)] || '',
            childTexts
          )
        );
      }
      out.set(g.grade, m);
    }
    return out;
  }, [familyGrades, catalog.searchTerms, childrenByParentByGrade, groupLabelMaps]);

  const topicAllowedByTrack = useCallback(
    (gNum: number, topic: CatalogTopic, mode: TrackMode): boolean => {
      if (gNum !== 9) return true;
      const grp = familyGrades
        .find((x) => x.grade === gNum)
        ?.groups.find((gr) => gr.key === topic.group);
      const isTrack = !!(grp && isReducedGroup(grp));
      return mode === 'red' ? isTrack : !isTrack;
    },
    [familyGrades]
  );

  const crossActive = cross && q.trim().length > 0;

  const visibleBlocks = useMemo(() => {
    const runMatches = (
      gEntry: CatalogGrade,
      useGroup: boolean,
      mode: TrackMode,
      query: string
    ): CatalogTopic[] => {
      const hay = haystacksByGrade.get(gEntry.grade) || new Map();
      return gEntry.topics.filter((t) => {
        if (t.parent !== undefined) return false;
        if (!topicAllowedByTrack(gEntry.grade, t, mode)) return false;
        if (useGroup && group !== 'all' && t.group !== group) return false;
        return topicMatchesQuery(hay.get(t.id) || [], query);
      });
    };

    if (crossActive) {
      return familyGrades
        .map((gEntry) => ({
          gradeEntry: gEntry,
          topics: runMatches(gEntry, false, gEntry.grade === 9 ? track : 'reg', q),
        }))
        .filter((b) => b.topics.length > 0);
    }
    const topics = runMatches(gradeEntry, true, track, q);
    return topics.length ? [{ gradeEntry, topics }] : [];
  }, [
    crossActive,
    familyGrades,
    gradeEntry,
    track,
    q,
    group,
    haystacksByGrade,
    topicAllowedByTrack,
  ]);

  const visibleCount = visibleBlocks.reduce((n, b) => n + b.topics.length, 0);

  const otherFamilyHint = useMemo(() => {
    if (!q.trim() || crossActive) return '';
    let other = 0;
    for (const g of familyOf(grade)) {
      if (g === grade) continue;
      const entry = familyGrades.find((x) => x.grade === g);
      if (!entry) continue;
      const hay = haystacksByGrade.get(entry.grade) || new Map();
      const mode: TrackMode = g === 9 ? track : 'reg';
      other += entry.topics.filter((t) => {
        if (t.parent !== undefined) return false;
        if (!topicAllowedByTrack(entry.grade, t, mode)) return false;
        return topicMatchesQuery(hay.get(t.id) || [], q);
      }).length;
    }
    return other ? `יש עוד ${other} תוצאות בכיתות אחרות באותה שכבה` : '';
  }, [q, crossActive, grade, familyGrades, track, haystacksByGrade, topicAllowedByTrack]);

  const statusText = (() => {
    if (q.trim()) {
      if (!visibleCount) return 'לא נמצאו נושאים תואמים';
      if (crossActive) return `${visibleCount} נושאים תואמים בחיפוש בין כיתות השכבה`;
      return `${visibleCount} נושאים תואמים לחיפוש`;
    }
    if (group === 'all') return `${visibleCount} נושאים בכיתה זו`;
    return `${visibleCount} נושאים בקבוצה שנבחרה`;
  })();

  function clearSearch() {
    setQ('');
    setGroup('all');
    setCross(false);
    if (showTrack) setTrack('reg');
  }

  function onTrackChange(next: TrackMode) {
    setTrack(next);
    setGroup('all');
  }

  const backPath = worksheetsBackPath(catalogState);

  function renderLevelButtons(topic: CatalogTopic, gNum: number) {
    return topic.levels.map((level) => {
      const href = buildWorksheetHref({
        catalog,
        grade: gNum,
        topic,
        levelKey: level.key,
        backPath,
      });
      return (
        <a
          key={topic.id + '-' + level.key + '-' + gNum}
          className={levelClass(level.key)}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${topic.title} — ${level.label}, קובץ PDF`}
          onClick={() => {
            try {
              sessionStorage.setItem(
                'noam-worksheets-scroll-v1',
                JSON.stringify({
                  href: `${window.location.pathname}${window.location.search}`,
                  y: window.scrollY || 0,
                  t: Date.now(),
                })
              );
            } catch {
              /* ignore */
            }
          }}
        >
          {level.label}
        </a>
      );
    });
  }

  function renderTopicCard(topic: CatalogTopic, gEntry: CatalogGrade) {
    const childrenMap = childrenByParentByGrade.get(gEntry.grade) || new Map<number, CatalogTopic[]>();
    const children: CatalogTopic[] = childrenMap.get(topic.id) || [];
    const icons = catalog.icons;
    const ico = icons[topic.icon] || icons.star || '';
    return (
      <article
        key={`${gEntry.grade}-${topic.id}`}
        className={`card${highlightTopicId === topic.id ? ' is-topic-target' : ''}`}
        data-g={topic.group}
        data-topic-id={topic.id}
      >
        <div className="card-main">
          <span className="tico" aria-hidden="true">
            <svg viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: ico }} />
          </span>
          <div className="card-text">
            <h3>{topic.title}</h3>
            {topic.description ? <p>{topic.description}</p> : null}
            {topic.note ? <p className="note">{topic.note}</p> : null}
            {topic.routing.aiHintShown ? (
              <span className="aihint">נועם AI זמין בדף הזה</span>
            ) : null}
          </div>
        </div>
        <div className={`levels${children.length ? ' levels--bundle' : ''}`}>
          {children.length ? (
            <>
              <div className="worksheet-links">
                {children.flatMap((child: CatalogTopic) => renderLevelButtons(child, gEntry.grade))}
              </div>
              <details className="more-worksheets">
                <summary>תרגול נוסף לפי רמות</summary>
                <div className="worksheet-links">{renderLevelButtons(topic, gEntry.grade)}</div>
              </details>
            </>
          ) : (
            renderLevelButtons(topic, gEntry.grade)
          )}
        </div>
      </article>
    );
  }

  function renderGrouped(gEntry: CatalogGrade, list: CatalogTopic[]) {
    const groups =
      gEntry.grade === 9
        ? gEntry.groups.filter((g) =>
            track === 'red' ? isReducedGroup(g) : !isReducedGroup(g)
          )
        : gEntry.groups;
    return groups
      .map((g) => ({
        group: g,
        topics: list.filter((t) => t.group === g.key),
      }))
      .filter((block) => block.topics.length > 0)
      .map(({ group: g, topics: listTopics }) => (
        <section
          key={`${gEntry.grade}-${g.key}`}
          className="group"
          aria-labelledby={`group-${gEntry.grade}-${g.key}`}
        >
          <div className="group-head">
            <h2 id={`group-${gEntry.grade}-${g.key}`}>{g.label}</h2>
            <span className="rule" aria-hidden="true" />
            <span className="count">{listTopics.length}</span>
          </div>
          {listTopics.map((topic) => renderTopicCard(topic, gEntry))}
        </section>
      ));
  }

  const jumpGrades = otherFamily(grade);
  const jumpLabel = otherFamilyJumpLabel(grade);
  const searchFamilyLabel = familySearchLabel(grade);
  const topLevelCount = gradeEntry.topics.filter((t) => t.parent === undefined).length;
  const family = schoolFamilyOf(grade);
  const showEmojiAccent = family === 'elementary';

  return (
    <div
      className={`wrap wrap--${family}`}
      data-grade={grade}
      data-family={family}
      data-catalog-q={q}
      data-catalog-cross={cross ? '1' : '0'}
      data-catalog-group={group}
    >
      <GradeNav
        activeGrade={grade}
        gradeNames={gradeNames}
        gradeEmojis={gradeEmojis}
        listId={listId}
        showEmojis={showEmojiAccent}
        hrefForGrade={gradeHref}
      />

      <header className="banner">
        <h1>
          {showEmojiAccent ? <span aria-hidden="true">{gradeEmoji} </span> : null}
          דפי עבודה ל{gradeLabel}
        </h1>
        <p>
          {topLevelCount} נושאים לפי תכנית הלימודים. בחרו דף והוא ייפתח בלשונית חדשה.
        </p>
        <p className="proto-note">
          {family === 'elementary'
            ? 'יסודי — דפי עבודה, תרגול והסברים בדרך מהנה וברורה.'
            : 'חטיבה — דפי עבודה וצופה (כולל נועם AI) במראה רגוע וברור.'}
        </p>
      </header>

      <div className="toolbar">
        <div className="search">
          <label className="sr-only" htmlFor={searchId}>
            חיפוש נושאים
          </label>
          <input
            id={searchId}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="חיפוש נושא, למשל משוואות או שברים…"
            autoComplete="off"
            aria-controls={listId}
            aria-describedby={statusId}
            data-catalog-search
          />
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="10.5" cy="10.5" r="6" />
            <path d="M15 15l6 6" />
          </svg>
        </div>

        {showTrack ? (
          <div className="trackbar" role="group" aria-label="מסלול לימוד">
            <button
              type="button"
              className="track"
              data-track="reg"
              aria-pressed={track === 'reg'}
              aria-controls={listId}
              onClick={() => onTrackChange('reg')}
            >
              רמה רגילה
            </button>
            <button
              type="button"
              className="track"
              data-track="red"
              aria-pressed={track === 'red'}
              aria-controls={listId}
              onClick={() => onTrackChange('red')}
            >
              רמה מצומצמת
            </button>
            <span className="tracknote">
              {track === 'red'
                ? 'מסלול נפרד לקראת 3 יח״ל — 162 שעות, לפי פריסת תשפ״ז'
                : 'לפי פריסת תשפ״ז — רמה רגילה'}
            </span>
          </div>
        ) : null}

        {!crossActive ? (
          <div className="chips" role="group" aria-label="סינון לפי תחום">
            <button
              type="button"
              className="chip"
              aria-pressed={group === 'all'}
              onClick={() => setGroup('all')}
            >
              כל הנושאים
            </button>
            {activeGroups.map((g) => (
              <button
                key={g.key}
                type="button"
                className="chip"
                aria-pressed={group === g.key}
                onClick={() => setGroup(g.key)}
              >
                {g.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="cross">
        <label htmlFor={crossId}>
          <input
            id={crossId}
            type="checkbox"
            checked={cross}
            onChange={(e) => setCross(e.target.checked)}
            data-catalog-cross-input
          />{' '}
          {searchFamilyLabel}
        </label>
        {otherFamilyHint ? <span className="crosshint">{otherFamilyHint}</span> : null}
        {crossActive ? (
          <span id="results-scope" className="crosshint">
            תוצאות מוגבלות לשכבת בית הספר הפעילה — לא לכל תשע הכיתות
          </span>
        ) : null}
      </div>

      <p id={statusId} className="status" role="status" aria-live="polite" data-catalog-status>
        {statusText}
      </p>

      <div id={listId} role="tabpanel" aria-labelledby={`grade-tab-${grade}`} tabIndex={0}>
        {visibleCount === 0 ? (
          <div className="empty" role="status">
            <h2>לא נמצאו נושאים</h2>
            <p>נסו מילה אחרת, או נקו את החיפוש והסינון כדי לראות את כל הנושאים.</p>
            <button type="button" onClick={clearSearch}>
              ניקוי חיפוש וסינון
            </button>
          </div>
        ) : (
          visibleBlocks.map(({ gradeEntry: gEntry, topics: list }) => (
            <div key={gEntry.grade} className="grade-block">
              {crossActive ? (
                <div className="grade-band">
                  <h2>{gEntry.label}</h2>
                  <span className="rule" aria-hidden="true" />
                  <span className="count">{list.length} נושאים</span>
                </div>
              ) : (
                <h2 className="sr-only">דפי העבודה</h2>
              )}
              {renderGrouped(gEntry, list)}
            </div>
          ))
        )}
      </div>

      <div className="jump" aria-label="מעבר לשכבה אחרת">
        <span className="jump-label">{jumpLabel}</span>
        <div className="jump-btns">
          {jumpGrades.map((g) => (
            <a key={g} className="jump-btn" href={gradeHref(g)} data-grade={g}>
              {gradeNames[String(g)] || `כיתה ${g}`}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
