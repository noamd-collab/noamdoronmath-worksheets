/**
 * Legal terms hardening — guards the four clause fixes made ahead of payments.
 * Source: legal package 05-tikun-tnaim-kayamim.md, fixes 2-5.
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, it } from 'node:test';
import { loadSitePage } from '../src/lib/sitePages.ts';

function flatten(page: ReturnType<typeof loadSitePage>) {
  return page.blocks
    .map((b) => {
      if (b.type === 'ul' || b.type === 'ol') return b.items.map((i) => i.text).join('\n');
      if ('text' in b) return b.text;
      return '';
    })
    .join('\n');
}

const BANNED = [
  'סמכות השיפוט הבלעדית',
  'ייכנס לתוקף עם פרסומו',
  'ולא תהיה לי אחריות לנזק',
];

const REQUIRED = [
  '30 יום לאחר פרסומו',
  'בית המשפט לתביעות קטנות',
  'אין בו כדי לגרוע מזכויותיך כצרכן',
  'אין בהסכמה לתנאים כדי לוותר על זכות',
];

describe('terms hardening (payments readiness)', () => {
  it('removes the unfair clauses from the rendered terms page', () => {
    const flat = flatten(loadSitePage('terms'));
    for (const phrase of BANNED) {
      assert.ok(!flat.includes(phrase), `banned clause still present: ${phrase}`);
    }
  });

  it('keeps the replacement wording that protects the consumer', () => {
    const flat = flatten(loadSitePage('terms'));
    for (const phrase of REQUIRED) {
      assert.ok(flat.includes(phrase), `missing required wording: ${phrase}`);
    }
  });

  it('publishes no unresolved placeholder fields', () => {
    const dir = 'src/data/site-pages';
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
      const body = readFileSync(`${dir}/${file}`, 'utf8');
      assert.ok(!body.includes('[['), `${file} still contains a [[placeholder]]`);
    }
  });
});
