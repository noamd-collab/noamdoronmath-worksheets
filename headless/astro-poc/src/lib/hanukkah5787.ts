/**
 * Hanukkah 5787 on the home page, Israel civil time.
 * December 2026 is Asia/Jerusalem winter time, UTC+2, the same offset the
 * Kislev strip uses. The strip replaces Kislev for these days and is gone
 * from 13 Dec 2026 00:00. The check runs in the browser.
 */
import { isKislev5787 } from './kislev5787';

export const HANUKKAH_5787_START_MS = Date.parse('2026-12-03T00:00:00+02:00');
export const HANUKKAH_5787_END_MS = Date.parse('2026-12-13T00:00:00+02:00');

export function isHanukkah5787(now = Date.now()): boolean {
  return now >= HANUKKAH_5787_START_MS && now < HANUKKAH_5787_END_MS;
}

/** One home greeting at a time. Hanukkah takes the strip for its own dates. */
export function homeHolidayStrip(now = Date.now()): 'hanukkah' | 'kislev' | null {
  if (isHanukkah5787(now)) return 'hanukkah';
  if (isKislev5787(now)) return 'kislev';
  return null;
}
