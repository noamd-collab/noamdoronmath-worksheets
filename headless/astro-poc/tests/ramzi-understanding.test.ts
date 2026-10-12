/**
 * After a hint or a question, Ramzi offers הבנתי / לא הבנתי.
 * לא הבנתי stays available and always returns another explanation
 * from the guide that already exists for the exercise.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const guides = require(join(root, 'public/noam-didactic-guides.js'));
const viewer = readFileSync(join(root, 'public/worksheet-viewer-noam.html'), 'utf8');
const proof = 'G9-T15-E-Q04א';

function reset() {
  guides.resetUnderstanding(proof);
}

describe('Ramzi understanding checks', () => {
  it('keeps the first hint, then unpacks the next existing hint after לא הבנתי', () => {
    reset();
    const first = guides.respond(proof, { helpKind: 'hint', hintIndex: 0, progress: 0 });
    assert.match(first.text, /∠EBD/);
    assert.equal(first.text.includes(guides.notUnderstoodLead), false);

    const softer = guides.respond(proof, {
      helpKind: 'free_question',
      studentMessage: 'לא הבנתי',
      hintIndex: 0,
      progress: 1,
    });
    assert.match(softer.text, /^זה בסדר גמור, בוא ננסה אחרת/);
    assert.match(softer.text, /∠EBD = ∠DBC/);
    assert.equal(softer.focusKey, 'q4a-bisector');
    assert.doesNotMatch(softer.text, /כל הצעד/);
  });

  it('explains the whole step once the hints are finished, and still answers again', () => {
    reset();
    for (let index = 0; index < 3; index += 1) {
      guides.respond(proof, { helpKind: 'hint', hintIndex: index, progress: index });
    }
    const full = guides.respond(proof, {
      helpKind: 'free_question',
      studentMessage: 'לא הבנתי',
      progress: 3,
    });
    assert.match(full.text, /זה בסדר גמור, בוא ננסה אחרת/);
    assert.match(full.text, /כל הצעד:/);
    assert.match(full.text, /ED = EB/);
    const again = guides.respond(proof, {
      helpKind: 'free_question',
      studentMessage: '«לא הבנתי»',
      progress: 3,
    });
    assert.match(again.text, /זה בסדר גמור, בוא ננסה אחרת/);
    assert.match(again.text, /כל הצעד:/);
    assert.equal(guides.needsCheck(again.text, '', ''), true);
  });

  it('acknowledges הבנתי and moves to the next hint, then the next step', () => {
    reset();
    guides.respond(proof, { helpKind: 'hint', hintIndex: 0, progress: 0 });
    const next = guides.respond(proof, {
      helpKind: 'free_question',
      studentMessage: 'הבנתי',
      progress: 1,
    });
    assert.match(next.text, /^יופי, שמח שזה ברור/);
    assert.match(next.text, /מקבילים/);
    guides.respond(proof, { helpKind: 'hint', hintIndex: 2, progress: 2 });
    const step = guides.respond(proof, {
      helpKind: 'free_question',
      studentMessage: 'הבנתי',
      progress: 3,
    });
    assert.match(step.text, /יופי, שמח שזה ברור/);
    assert.match(step.text, /∠EBD = ∠DBC/);
    const goal = guides.respond(proof, {
      helpKind: 'free_question',
      studentMessage: 'הבנתי.',
      progress: 3,
    });
    assert.match(goal.text, /אפשר לנסות עכשיו/);
    assert.match(goal.text, /ED = EB/);
  });

  it('does not steal a longer question that merely contains the words', () => {
    reset();
    const angle = guides.respond(proof, {
      helpKind: 'free_question',
      studentMessage: 'לא הבנתי איפה הזווית ∠EDB',
    });
    assert.match(angle.text, /∠EDB/);
    assert.equal(angle.text.includes(guides.notUnderstoodLead), false);
    const follow = guides.respond(proof, {
      helpKind: 'free_question',
      studentMessage: 'הבנתי, ואז מה?',
    });
    assert.match(follow.text, /השלב|∠EBD|מקביל/);
    assert.equal(follow.text.startsWith(guides.understoodLead), false);
  });

  it('marks hints, questions, and check replies, including a worksheet with no guide', () => {
    assert.equal(guides.needsCheck('חפשו שתי זוויות.', 'רמז 1', ''), true);
    assert.equal(guides.needsCheck('מה אפשר לומר על המשולש?', '', ''), true);
    assert.equal(guides.needsCheck('הסבר בלי שאלה.', '', 'השאלה שלך: הסבר כללי'), false);
    assert.equal(guides.needsCheck('יופי, שמח שזה ברור.\nנמשיך.', '', 'השאלה שלך: הבנתי'), true);
    const fallback = guides.fallbackUnderstanding('not-understood', ['קודם מסמנים את הזווית. אחר כך משווים.'], 0);
    assert.match(fallback, /זה בסדר גמור/);
    const fuller = guides.fallbackUnderstanding('not-understood', ['קודם מסמנים את הזווית. אחר כך משווים.'], 1);
    assert.match(fuller, /כל הצעד, לאט/);
    assert.match(guides.fallbackUnderstanding('understood', [], 0), /יופי, שמח שזה ברור/);
  });

  it('renders both buttons in the viewer, with לא הבנתי always present', () => {
    const adapter = viewer.match(/<script id="exact-viewer-adapter">([\s\S]*?)<\/script>/)?.[1] || '';
    const style = viewer.match(/<style id="exact-viewer-presentation">([\s\S]*?)<\/style>/)?.[1] || '';
    assert.match(adapter, /הבנתי/);
    assert.match(adapter, /לא הבנתי/);
    assert.match(adapter, /aria-label','אחרי ההסבר של רמזי'/);
    assert.match(adapter, /ramzi-check-no/);
    assert.doesNotMatch(adapter, /ramzi-check-no[\s\S]{0,80}disabled\s*=/);
    assert.match(style, /\.exact-viewer \.ramzi-check button\{[\s\S]*min-height:44px/);
    assert.match(style, /font-family:Heebo,'Heebo Fallback',sans-serif/);
    assert.match(style, /\.exact-viewer \.ramzi-check\{[\s\S]*direction:rtl/);
    assert.match(style, /outline:3px solid #22305a/);
  });
});
