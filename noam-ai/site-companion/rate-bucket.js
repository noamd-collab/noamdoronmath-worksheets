/**
 * One counter per visitor, stored under a hash.
 * A query of freshly inserted rows does not see them on Wix Data, so the
 * length stayed under 12 and every request was allowed. The decision is the
 * count on one item, read before any write.
 */
import { createHash } from "node:crypto";

export function rateBucketId(key) {
  return "r" + createHash("sha256").update(String(key)).digest("hex").slice(0, 32);
}

export function readRateCount(row) {
  if (!row || typeof row !== "object") return { count: 0, windowStart: 0 };
  const data = row.data && typeof row.data === "object" ? row.data : row;
  const count = Number(data.count);
  const windowStart = Number(data.windowStart);
  return {
    count: Number.isFinite(count) && count > 0 ? count : 0,
    windowStart: Number.isFinite(windowStart) && windowStart > 0 ? windowStart : 0,
  };
}

/** Null means the request is blocked and nothing may be written. */
export function nextRateWrite(row, now, max, windowMs) {
  const when = typeof now === "number" ? now : Date.now();
  const limit = typeof max === "number" ? max : 12;
  const span = typeof windowMs === "number" ? windowMs : 60 * 1000;
  const current = readRateCount(row);
  const fresh = current.windowStart > 0 && when - current.windowStart < span;
  const count = fresh ? current.count : 0;
  if (count >= limit) return null;
  return {
    count: count + 1,
    windowStart: fresh ? current.windowStart : when,
  };
}

/** Shared count map. The 13th take returns false and does not write. */
export function countRateBackend(rows) {
  const store = rows || new Map();
  return {
    writes: 0,
    async take(key, now, max, windowMs) {
      const id = rateBucketId(key);
      const write = nextRateWrite(store.get(id) || null, now, max, windowMs);
      if (!write) return false;
      store.set(id, write);
      this.writes += 1;
      return true;
    },
  };
}
