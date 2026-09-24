/**
 * Grade families and URL parsing — mirrors index.html ELEMENTARY / MIDDLE / familyOf.
 */

export const ELEMENTARY_GRADES = [1, 2, 3, 4, 5, 6] as const;
export const MIDDLE_GRADES = [7, 8, 9] as const;
export const ALL_GRADES = [...ELEMENTARY_GRADES, ...MIDDLE_GRADES] as const;

export type GradeNum = (typeof ALL_GRADES)[number];
export type SchoolFamily = 'elementary' | 'middle';

export function isGradeNum(n: number): n is GradeNum {
  return Number.isInteger(n) && n >= 1 && n <= 9;
}

/** Absent / empty → default 7. Non-numeric or out of 1–9 → invalid (null). */
export function parseGradeParam(raw: string | undefined | null): {
  grade: GradeNum | null;
  defaulted: boolean;
  invalid: boolean;
  raw: string | null;
} {
  if (raw == null || String(raw).trim() === '') {
    return { grade: 7, defaulted: true, invalid: false, raw: null };
  }
  const trimmed = String(raw).trim();
  if (!/^[1-9]$/.test(trimmed)) {
    return { grade: null, defaulted: false, invalid: true, raw: trimmed };
  }
  const n = Number(trimmed);
  if (!isGradeNum(n)) {
    return { grade: null, defaulted: false, invalid: true, raw: trimmed };
  }
  return { grade: n, defaulted: false, invalid: false, raw: trimmed };
}

export function familyOf(grade: number): readonly GradeNum[] {
  return MIDDLE_GRADES.includes(grade as (typeof MIDDLE_GRADES)[number])
    ? MIDDLE_GRADES
    : ELEMENTARY_GRADES;
}

export function schoolFamilyOf(grade: number): SchoolFamily {
  return MIDDLE_GRADES.includes(grade as (typeof MIDDLE_GRADES)[number])
    ? 'middle'
    : 'elementary';

}

export function familySearchLabel(grade: number): string {
  return schoolFamilyOf(grade) === 'middle'
    ? 'חיפוש בכל כיתות חטיבת הביניים (ז׳–ט׳)'
    : 'חיפוש בכל כיתות היסודי (א׳–ו׳)';
}

export function otherFamily(grade: number): readonly GradeNum[] {
  return schoolFamilyOf(grade) === 'middle' ? ELEMENTARY_GRADES : MIDDLE_GRADES;
}

export function otherFamilyJumpLabel(grade: number): string {
  return schoolFamilyOf(grade) === 'middle'
    ? 'מחפשים דפי עבודה ליסודי?'
    : 'מחפשים דפי עבודה לחטיבת הביניים?';
}

export function worksheetsHref(grade: GradeNum): string {
  return `/worksheets?grade=${grade}`;
}

