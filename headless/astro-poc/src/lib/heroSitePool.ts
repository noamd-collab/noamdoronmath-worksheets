/**
 * Homepage hero pool across the whole site (Noam, 4.11.2026: "random from all
 * the site", not only the nine HERO_ROTATION films). Every loop the grade hubs
 * already show (gradeLoopMap, grades 1–9), plus the HERO_ROTATION films. Labels
 * and topic links come from those existing maps; a loop with no topic page for
 * its grade links to /worksheets?grade=N, as on the grade hub. Nothing new is
 * drawn or invented. HERO_ROTATION itself is unchanged (no-JS order, tests).
 */
import { gradeLoopMap } from './gradeLoopPools';
import { HERO_ROTATION, heroPanel, type HeroRotationEntry } from './heroRotation';

const GRADE_LETTERS = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];

function gradeLabel(gradeNum: number): string {
  return `${GRADE_LETTERS[gradeNum] ?? ''}\u05F3`;
}

function buildSitePool(): HeroRotationEntry[] {
  const byVariant = new Map<string, HeroRotationEntry>();
  for (const entry of HERO_ROTATION) byVariant.set(entry.variant, entry);
  for (const loop of gradeLoopMap()) {
    if (byVariant.has(loop.variant)) continue;
    const gradeNum = Number(loop.grade);
    byVariant.set(loop.variant, {
      variant: loop.variant,
      grade: gradeLabel(gradeNum),
      gradeNum,
      label: loop.label,
      href: loop.topic ?? `/worksheets?grade=${gradeNum}`,
      panel: heroPanel(gradeNum),
    });
  }
  return [...byVariant.values()];
}

/** Every homepage-eligible loop on the site. HERO_ROTATION entries keep their own chip and link. */
export const HERO_SITE_POOL: readonly HeroRotationEntry[] = buildSitePool();

const siteVariants = new Set(HERO_SITE_POOL.map((entry) => entry.variant));

/** A loop from the site pool, or undefined (path segments and unknown names are rejected). */
export function heroSiteVariant(value: string | undefined): string | undefined {
  if (!value || !siteVariants.has(value)) return undefined;
  return value;
}
