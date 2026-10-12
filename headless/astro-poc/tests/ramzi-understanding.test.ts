/**
 * הבנתי / לא הבנתי stay available after every Ramzi reply.
 * לא הבנתי asks for a new simpler step. It never replays the same full text.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
require(join(root, 'public/noam-didactic-guides.js'));
const guides = globalThis.NoamDidacticGuides;
const viewer = readFileSync(join(root, 'public/worksheet-viewer-noam.html'), 'utf8');
const proof = 'G9-T15-E-Q04א';
const plain = 'G9-T15-E-Q01א';

function reset() {
  guides.resetUnderstanding(proof);
}

function hint(index: number) {
  return guides.respond(proof, { helpKind: 'hint', hintIndex: index, progress: index });
}

describe('Ramzi understanding checks', () => {
  it('opens the next hint after לא הבנתי without repeating the kind lead', () => {
    reset();
    const first = hint(0);
    assert.match(first.text, /∠EBD/);
    assert.doesNotMatch(first.text, /זה בסדר גמור|שמח/);

    const plan = guides.planUnderstanding(proof, 'not-understood', {});
    assert.equal(plan.action, 'hint');
    assert.equal(plan.hintsOpened, 2);
    assert.equal(guides.planUnderstanding(proof, 'not-understood', {}).hintsOpened, 2);

    const softer = guides.respond(proof, {
      helpKind: 'free_question',
      studentMessage: 'לא הבנתי',
      hintIndex: 0,
      progress: 1,
    });
    assert.match(softer.text, /∠EBD = ∠DBC/);
    assert.doesNotMatch(softer.text, /זה בסדר גמור|שמח|יופי, מעולה/);
    assert.equal(softer.focusKey, 'q4a-bisector');
  });

  it('breaks the full explanation into a new sub-step, then asks the AI for another angle', () => {
    reset();
    for (let index = 0; index < 3; index += 1) hint(index);
    const seen = new Set<string>();
    let latest = guides.respond(proof, {
      helpKind: 'free_question',
      studentMessage: 'לא הבנתי',
      progress: 3,
    });
    assert.ok(latest);
    assert.match(latest.text, /E נמצאת על AB/);
    assert.match(latest.text, /\n/);
    assert.doesNotMatch(latest.text, /DE ∥ BC|כל הצעד|זה בסדר גמור/);
    seen.add(latest.text);
    while (latest) {
      const next = guides.respond(proof, {
        helpKind: 'free_question',
        studentMessage: 'לא הבנתי',
        progress: 3,
      });
      if (!next) {
        latest = next;
        break;
      }
      assert.equal(seen.has(next.text), false);
      assert.ok(next.text.length < 220);
      seen.add(next.text);
      latest = next;
    }
    assert.ok(seen.size >= 4);
    const again = guides.planUnderstanding(proof, 'not-understood', { progress: 3 });
    assert.equal(again.action, 'ai');
    assert.match(again.prompt, /זווית אחרת/);
    assert.match(again.fallback, /רמז/);
    assert.doesNotMatch(again.fallback, /זה בסדר גמור/);
    assert.equal(guides.respond(proof, { helpKind: 'free_question', studentMessage: 'לא הבנתי', progress: 3 }), null);
  });

  it('uses a neutral lead for הבנתי, and closes after the explanation instead of nextStep', () => {
    reset();
    hint(0);
    guides.noteCheck('understood');
    const next = guides.respond(proof, { helpKind: 'hint', hintIndex: 1, progress: 1 });
    assert.match(next.text, /^יופי, מעולה שזה ברור/);
    assert.match(next.text, /∠EBD = ∠DBC/);
    assert.doesNotMatch(next.text, /שמח/);

    hint(2);
    const step = guides.respond(proof, {
      helpKind: 'free_question',
      studentMessage: 'הבנתי',
      progress: 3,
    });
    assert.match(step.text, /יופי, מעולה שזה ברור/);
    assert.match(step.text, /נכון שצריך להגיע/);
    guides.respond(proof, { helpKind: 'free_question', studentMessage: 'לא הבנתי', progress: 3 });
    const closing = guides.respond(proof, {
      helpKind: 'free_question',
      studentMessage: 'הבנתי',
      progress: 3,
    });
    assert.equal(closing.text, guides.closingText);
    assert.match(closing.text, /אפשר לעבור לסעיף הבא/);
    assert.doesNotMatch(closing.text, /נכון שצריך|שמח/);
  });

  it('does not steal a longer question that merely contains the words', () => {
    reset();
    const angle = guides.respond(proof, {
      helpKind: 'free_question',
      studentMessage: 'לא הבנתי איפה הזווית ∠EDB',
    });
    assert.match(angle.text, /∠EDB/);
    assert.doesNotMatch(angle.text, /זה בסדר גמור|יופי, מעולה/);
    const follow = guides.respond(proof, {
      helpKind: 'free_question',
      studentMessage: 'הבנתי, ואז מה?',
    });
    assert.match(follow.text, /השלב|∠EBD|מקביל/);
    assert.equal(follow.text.startsWith(guides.understoodLead), false);
  });

  it('asks for a new explanation when there is no guide, and never stitches old replies', () => {
    const missed = guides.planUnderstanding(plain, 'not-understood', {});
    assert.equal(missed.action, 'ai');
    assert.match(missed.prompt, /לא הבנתי/);
    assert.match(missed.prompt, /פשטות|צעדים קטנים/);
    assert.match(missed.prompt, /שאלה קצרה/);
    assert.match(missed.fallback, /רמז/);
    assert.doesNotMatch(missed.fallback, /קודם מסמנים|זה בסדר גמור/);
    const got = guides.planUnderstanding(plain, 'understood', {});
    assert.equal(got.action, 'ai');
    assert.match(got.prompt, /הצעד הבא/);
    assert.doesNotMatch(got.prompt, /שמח/);
    const offline = guides.offlineUnderstanding('not-understood');
    assert.match(offline, /רמז/);
    assert.equal(
      guides.fallbackUnderstanding('not-understood', ['קודם מסמנים את הזווית. אחר כך משווים.'], 1),
      offline,
    );
    assert.equal(guides.needsCheck('הסבר בלי שאלה.', '', 'השאלה שלך: הסבר כללי'), true);
    assert.equal(guides.needsCheck('רמזי חושב…', '', ''), false);
    assert.equal(guides.needsCheck('מה אפשר לומר על המשולש?', '', ''), true);
  });

  it('renders a check under every reply, keeps the hint counter, and isolates angle signs', () => {
    const adapter = viewer.match(/<script id="exact-viewer-adapter">([\s\S]*?)<\/script>/)?.[1] || '';
    const style = viewer.match(/<style id="exact-viewer-presentation">([\s\S]*?)<\/style>/)?.[1] || '';
    assert.match(adapter, /planUnderstanding/);
    assert.match(adapter, /noteCheck/);
    assert.match(adapter, /hintFloors/);
    assert.match(adapter, /Math\.max\(released,floor\)/);
    assert.match(adapter, /createElement\('bdi'\)/);
    assert.match(adapter, /bdi\.dir='ltr'/);
    assert.match(adapter, /noam-row\.assistant/);
    assert.doesNotMatch(adapter, /ramzi-check'\)\.forEach/);
    assert.doesNotMatch(adapter, /שמח|זה בסדר גמור|בוא ננסה/);
    assert.match(style, /\.exact-viewer \.ramzi-check button\{[\s\S]*min-height:44px/);
    assert.match(style, /font-family:Heebo,'Heebo Fallback',sans-serif/);
    assert.match(style, /\.exact-viewer \.ramzi-check\{[\s\S]*direction:rtl/);
    assert.match(style, /outline:3px solid #22305a/);
    assert.match(style, /bdi\[dir="ltr"\]\{unicode-bidi:isolate;direction:ltr\}/);
    assert.match(style, /white-space:pre-wrap/);
    assert.doesNotMatch(adapter, /ramzi-check-no[\s\S]{0,80}disabled\s*=/);
  });
});
