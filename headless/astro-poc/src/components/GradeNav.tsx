import type { KeyboardEvent } from 'react';
import { useCallback, useRef } from 'react';
import {
  ALL_GRADES,
  ELEMENTARY_GRADES,
  MIDDLE_GRADES,
  worksheetsHref,
  type GradeNum,
} from '../lib/grades';

export interface GradeNavProps {
  activeGrade: GradeNum;
  gradeNames: Record<string, string>;
  gradeEmojis: Record<string, string>;
  listId: string;
  showEmojis?: boolean;
  /** Optional href builder so search/filter/cross survive grade tabs (M32). */
  hrefForGrade?: (grade: GradeNum) => string;
}

function TabRow(props: {
  label: string;
  emoji: string;
  grades: readonly GradeNum[];
  activeGrade: GradeNum;
  gradeNames: Record<string, string>;
  gradeEmojis: Record<string, string>;
  listId: string;
  showEmojis: boolean;
  hrefForGrade: (grade: GradeNum) => string;
  onKeyNav: (from: GradeNum, e: KeyboardEvent) => void;
}) {
  const {
    label,
    emoji,
    grades,
    activeGrade,
    gradeNames,
    gradeEmojis,
    listId,
    showEmojis,
    hrefForGrade,
    onKeyNav,
  } = props;
  return (
    <div className="tabrow">
      <span className="tabrow-label">
        {emoji ? `${emoji} ` : ''}
        {label}
      </span>
      <div className="tabrow-btns" role="presentation">
        {grades.map((g) => {
          const selected = g === activeGrade;
          return (
            <a
              key={g}
              id={`grade-tab-${g}`}
              href={hrefForGrade(g)}
              role="tab"
              className="grade-tab"
              aria-selected={selected}
              aria-controls={listId}
              tabIndex={selected ? 0 : -1}
              data-grade={g}
              onKeyDown={(e) => onKeyNav(g, e)}
            >
              {showEmojis ? (
                <span aria-hidden="true">{gradeEmojis[String(g)] || ''} </span>
              ) : null}
              {gradeNames[String(g)] || `כיתה ${g}`}
            </a>
          );
        })}
      </div>
    </div>
  );
}

/** Accessible grade navigation — URL-backed anchors (no Next.js Link). */
export function GradeNav(props: GradeNavProps) {
  const {
    activeGrade,
    gradeNames,
    gradeEmojis,
    listId,
    showEmojis = true,
    hrefForGrade = worksheetsHref,
  } = props;
  const navRef = useRef<HTMLDivElement>(null);

  const onKeyNav = useCallback((from: GradeNum, e: KeyboardEvent) => {
    const key = e.key;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    let index = ALL_GRADES.indexOf(from);
    if (key === 'ArrowLeft') index = (index + 1) % ALL_GRADES.length;
    else if (key === 'ArrowRight') index = (index + ALL_GRADES.length - 1) % ALL_GRADES.length;
    else if (key === 'Home') index = 0;
    else if (key === 'End') index = ALL_GRADES.length - 1;
    else return;
    e.preventDefault();
    const next = ALL_GRADES[index];
    const el = navRef.current?.querySelector<HTMLAnchorElement>(`#grade-tab-${next}`);
    if (!el) return;
    el.focus({ preventScroll: true });
    el.click();
  }, []);

  return (
    <nav
      ref={navRef}
      className="grades"
      aria-label="בחירת כיתה"
      role="tablist"
      aria-orientation="horizontal"
    >
      <TabRow
        label="בית ספר יסודי"
        emoji={showEmojis ? '🎒' : ''}
        grades={ELEMENTARY_GRADES}
        activeGrade={activeGrade}
        gradeNames={gradeNames}
        gradeEmojis={gradeEmojis}
        listId={listId}
        showEmojis={showEmojis}
        hrefForGrade={hrefForGrade}
        onKeyNav={onKeyNav}
      />
      <TabRow
        label="חטיבת ביניים"
        emoji=""
        grades={MIDDLE_GRADES}
        activeGrade={activeGrade}
        gradeNames={gradeNames}
        gradeEmojis={gradeEmojis}
        listId={listId}
        showEmojis={false}
        hrefForGrade={hrefForGrade}
        onKeyNav={onKeyNav}
      />
    </nav>
  );
}
