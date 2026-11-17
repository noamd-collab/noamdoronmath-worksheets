/**
 * Kislev 5787 on the home page, Israel civil time (UTC+2, winter clock).
 * 1 Kislev 5787 is 11 Nov 2026. Hanukkah 5787 ends at nightfall on
 * 12 Dec 2026 (2 Tevet), so the strip stays through that calendar day
 * and is gone from 13 Dec 2026 00:00 IST. The check runs in the browser,
 * so the strip leaves by itself with no rebuild.
 */
export const KISLEV_5787_START_MS = Date.parse('2026-11-11T00:00:00+02:00');
export const KISLEV_5787_END_MS = Date.parse('2026-12-13T00:00:00+02:00');

export function isKislev5787(now = Date.now()): boolean {
  return now >= KISLEV_5787_START_MS && now < KISLEV_5787_END_MS;
}
