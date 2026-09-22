'use client';

import { useMemo, useState, useId } from 'react';
import type { CatalogGroup, CatalogTopic, CatalogV1 } from '@/lib/catalog/types';
import {
  buildTopicHaystack,
  topicMatchesQuery,
} from '@/lib/search';
import { buildWorksheetHref } from '@/lib/worksheetLinks';

export interface WorksheetsClientProps {
  catalog: CatalogV1;
  grade: number;
  gradeLabel: string;
  gradeEmoji: string;
  groups: CatalogGroup[];
  topics: CatalogTopic[];
  icons: Record<string, string>;
  searchTerms: Record<string, string>;
}

function levelClass(key: string): string {
  if (key === 'c') return 'lvl lvl--c';
  if (key === 'b') return 'lvl lvl--b';
  if (key === 'one') return 'lvl lvl--a lvl--one';
  return 'lvl lvl--a';
}

export function WorksheetsClient(props: WorksheetsClientProps) {
  const { catalog, grade, gradeLabel, gradeEmoji, groups, topics, icons, searchTerms } =
    props;
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('all');
  const searchId = useId();
  const statusId = useId();

  const childrenByParent = useMemo(() => {
    const map = new Map<number, CatalogTopic[]>();
    for (const t of topics) {
      if (t.parent === undefined) continue;
      const list = map.get(t.parent) || [];
      list.push(t);
      map.set(t.parent, list);
    }
    return map;
  }, [topics]);

  const groupLabelByKey = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of groups) m.set(g.key, g.label);
    return m;
  }, [groups]);

  const haystacks = useMemo(() => {
    const m = new Map<number, string[]>();
    for (const t of topics) {
      if (t.parent !== undefined) continue;
      const children = childrenByParent.get(t.id) || [];
      const childTexts = children.map((c) => c.title + ' ' + (c.description || ''));
      m.set(
        t.id,
        buildTopicHaystack(
          t,
          groupLabelByKey.get(t.group) || '',
          searchTerms[String(t.id)] || '',
          childTexts
        )
      );
    }
    return m;
  }, [topics, childrenByParent, groupLabelByKey, searchTerms]);

  const visible = useMemo(() => {
    return topics.filter((t) => {
      if (t.parent !== undefined) return false;
      if (group !== 'all' && t.group !== group) return false;
      const hay = haystacks.get(t.id) || [];
      return topicMatchesQuery(hay, q);
    });
  }, [topics, group, q, haystacks]);

  const byGroup = useMemo(() => {
    return groups
      .map((g) => ({
        group: g,
        topics: visible.filter((t) => t.group === g.key),
      }))
      .filter((block) => block.topics.length > 0);
  }, [groups, visible]);

  const statusText = q.trim()
    ? visible.length
      ? `${visible.length} נושאים תואמים לחיפוש`
      : 'לא נמצאו נושאים תואמים'
    : group === 'all'
      ? `${visible.length} נושאים בכיתה זו`
      : `${visible.length} נושאים בקבוצה שנבחרה`;

  function clearSearch() {
    setQ('');
    setGroup('all');
  }

  function renderLevelButtons(topic: CatalogTopic) {
    return topic.levels.map((level) => {
      const href = buildWorksheetHref({
        catalog,
        grade,
        topic,
        levelKey: level.key,
      });
      return (
        <a
          key={topic.id + '-' + level.key}
          className={levelClass(level.key)}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${topic.title} — ${level.label}, קובץ PDF`}
        >
          {level.label}
        </a>
      );
    });
  }

  return (
    <div className="wrap" data-grade={grade}>
      <header className="banner">
        <h1>
          <span aria-hidden="true">{gradeEmoji} </span>
          דפי עבודה ל{gradeLabel}
        </h1>
        <p>{visible.length} נושאים לפי תכנית הלימודים. בחרו דף והוא ייפתח בלשונית חדשה.</p>
        <p className="proto-note">
          אב־טיפוס Headless (Phase 1) — הקישורים נפתחים לחוויית הדף הקיימת באתר הציבורי, לא
          לכתובת המקומית.
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
            aria-controls="topic-list"
            aria-describedby={statusId}
          />
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="10.5" cy="10.5" r="6" />
            <path d="M15 15l6 6" />
          </svg>
        </div>

        <div className="chips" role="group" aria-label="סינון לפי תחום">
          <button
            type="button"
            className="chip"
            aria-pressed={group === 'all'}
            onClick={() => setGroup('all')}
          >
            כל הנושאים
          </button>
          {groups.map((g) => (
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
      </div>

      <p id={statusId} className="status" role="status" aria-live="polite">
        {statusText}
      </p>

      <div id="topic-list">
        {visible.length === 0 ? (
          <div className="empty" role="status">
            <h2>לא נמצאו נושאים</h2>
            <p>נסו מילה אחרת, או נקו את החיפוש והסינון כדי לראות את כל הנושאים.</p>
            <button type="button" onClick={clearSearch}>
              ניקוי חיפוש וסינון
            </button>
          </div>
        ) : (
          byGroup.map(({ group: g, topics: list }) => (
            <section key={g.key} className="group" aria-labelledby={`group-${g.key}`}>
              <div className="group-head">
                <h2 id={`group-${g.key}`}>{g.label}</h2>
                <span className="rule" aria-hidden="true" />
                <span className="count">{list.length}</span>
              </div>
              {list.map((topic) => {
                const children = childrenByParent.get(topic.id) || [];
                const ico = icons[topic.icon] || icons.star || '';
                return (
                  <article key={topic.id} className="card" data-g={topic.group}>
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
                            {children.flatMap((child) => renderLevelButtons(child))}
                          </div>
                          <details className="more-worksheets">
                            <summary>תרגול נוסף לפי רמות</summary>
                            <div className="worksheet-links">{renderLevelButtons(topic)}</div>
                          </details>
                        </>
                      ) : (
                        renderLevelButtons(topic)
                      )}
                    </div>
                  </article>
                );
              })}
            </section>
          ))
        )}
      </div>
    </div>
  );
}
