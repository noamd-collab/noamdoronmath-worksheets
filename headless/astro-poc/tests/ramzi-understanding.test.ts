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
const guides = (
  globalThis as typeof globalThis & {
    NoamDidacticGuides: {
      notUnderstoodLead: string;
      notUnderstoodLeads: string[];
      understoodLead: string;
      closingText: string;
      resetUnderstanding: (key: string) => void;
      noteCheck: (decision: string) => void;
      needsCheck: (text: string, kind: string, question: string) => boolean;
      offlineUnderstanding: (decision: string, opts?: Record<string, unknown>) => string;
      fallbackUnderstanding: (decision: string, steps: string[], index: number) => string;
      respond: (
        key: string,
        opts: Record<string, unknown>
      ) => { text: string; focusKey?: string; understandingPrompt?: boolean };
      planUnderstanding: (
        key: string,
        decision: string,
        opts?: Record<string, unknown>
      ) => {
        action: string;
        display: string;
        hintsOpened: number;
        text?: string;
        prompt?: string;
        fallback?: string;
        instruction?: string;
        fallbackText?: string;
        stepIndex?: number;
        understandingPrompt?: boolean;
      };
    };
  }
).NoamDidacticGuides;
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
  it('opens the next hint after לא הבנתי with one short neutral lead', () => {
    reset();
    const first = hint(0);
    assert.match(first.text, /∠EBD/);
    assert.doesNotMatch(first.text, /זה בסדר גמור|שמח/);

    const plan = guides.planUnderstanding(proof, 'not-understood', {});
    assert.equal(plan.action, 'hint');
    assert.equal(plan.display, 'לא הבנתי');
    assert.equal(plan.hintsOpened, 2);
    assert.equal(guides.planUnderstanding(proof, 'not-understood', {}).hintsOpened, 2);

    const softer = guides.respond(proof, {
      helpKind: 'free_question',
      studentMessage: 'לא הבנתי',
      hintIndex: 0,
      progress: 1,
    });
    assert.match(softer.text, /^זה בסדר גמור, בואו ננסה אחרת\.\n/);
    assert.equal(softer.text.split(guides.notUnderstoodLead).length - 1, 1);
    assert.match(softer.text, /∠EBD = ∠DBC/);
    assert.doesNotMatch(softer.text, /שמח|בוא ננסה/);
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
    assert.match(latest.text, /^זה בסדר גמור, בואו ננסה אחרת\.\n/);
    assert.match(latest.text, /E נמצאת על AB/);
    assert.match(latest.text, /\n/);
    assert.doesNotMatch(latest.text, /DE ∥ BC|כל הצעד/);
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
      assert.ok(next.text.length < 280);
      seen.add(next.text);
      latest = next;
    }
    assert.ok(seen.size >= 4);
    const again = guides.planUnderstanding(proof, 'not-understood', { progress: 3, hintsDone: true });
    assert.equal(again.action, 'ai');
    assert.equal(again.display, 'לא הבנתי');
    assert.match(again.prompt ?? '', /זווית אחרת/);
    assert.equal((again.prompt ?? '').includes('תסבירו מחדש'), false);
    assert.match(again.fallback ?? '', /בואו ננסה אחרת/);
    assert.match(again.fallback ?? '', /לקרוא שוב/);
    assert.doesNotMatch(again.fallback ?? '', /רמז|הצעד הבא/);
    assert.equal(guides.respond(proof, { helpKind: 'free_question', studentMessage: 'לא הבנתי', progress: 3 }), null);
    const openings: string[] = [];
    guides.resetUnderstanding(proof);
    for (let index = 0; index < 3; index += 1) hint(index);
    for (let index = 0; index < 4; index += 1) {
      const varied = guides.respond(proof, {
        helpKind: 'free_question',
        studentMessage: 'לא הבנתי',
        progress: 3,
      });
      assert.ok(varied);
      openings.push(varied.text.split('\n')[0]);
    }
    assert.equal(openings[0], guides.notUnderstoodLead);
    assert.equal(openings[2], guides.notUnderstoodLead);
    assert.notEqual(openings[3], guides.notUnderstoodLead);
    assert.equal(guides.notUnderstoodLeads.includes(openings[3]), true);
    assert.doesNotMatch(openings[3], /שמח|בוא ננסה/);
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
    const again = guides.planUnderstanding(proof, 'not-understood', { progress: 3, hintsDone: true });
    assert.equal(again.action, 'ai');
    assert.equal(again.display, 'לא הבנתי');
    assert.match(again.prompt ?? '', /הצעד האחרון/);
    assert.match(again.prompt ?? '', /זווית אחרת/);
    assert.match(again.prompt ?? '', /E נמצאת על AB|הקרן BE/);
    assert.equal((again.prompt ?? '').includes('תסבירו מחדש את הצעד האחרון'), true);
    const stay = guides.planUnderstanding(proof, 'understood', { progress: 3, hintsDone: true });
    assert.equal(stay.action, 'local');
    assert.match(stay.text ?? '', /אפשר לעבור לסעיף הבא/);
    assert.equal(guides.needsCheck(guides.closingText, '', ''), true);
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
    assert.equal(missed.display, 'לא הבנתי');
    assert.match(missed.prompt ?? '', /תסבירו מחדש/);
    assert.match(missed.prompt ?? '', /פשטות|צעדים קטנים/);
    assert.match(missed.prompt ?? '', /שאלה קצרה/);
    assert.doesNotMatch(missed.display, /תסבירו/);
    assert.match(missed.fallback ?? '', /^זה בסדר גמור, בואו ננסה אחרת/);
    assert.match(missed.fallback ?? '', /רמז/);
    assert.doesNotMatch(missed.fallback ?? '', /קודם מסמנים|הצעד הבא/);
    const got = guides.planUnderstanding(plain, 'understood', {});
    assert.equal(got.action, 'ai');
    assert.equal(got.display, 'הבנתי');
    assert.match(got.prompt ?? '', /תנו רק את הצעד הבא/);
    assert.match(got.fallback ?? '', /הצעד הבא/);
    assert.doesNotMatch(got.fallback ?? '', /שמח|בואו ננסה|הסבר חדש/);
    const offline = guides.offlineUnderstanding('not-understood');
    const understoodDown = guides.offlineUnderstanding('understood');
    assert.match(offline, /רמז/);
    assert.doesNotMatch(offline, /הצעד הבא/);
    assert.match(understoodDown, /הצעד הבא/);
    assert.doesNotMatch(understoodDown, /הסבר חדש|בואו ננסה/);
    const noHint = guides.offlineUnderstanding('not-understood', { hintsDone: true });
    const noHintYes = guides.offlineUnderstanding('understood', { hintsDone: true });
    assert.doesNotMatch(noHint, /רמז/);
    assert.match(noHint, /לקרוא שוב/);
    assert.doesNotMatch(noHintYes, /רמז/);
    assert.match(noHintYes, /סעיף הבא/);
    assert.equal(
      guides.fallbackUnderstanding('not-understood', ['קודם מסמנים את הזווית. אחר כך משווים.'], 1),
      offline,
    );
    const fourth = guides.offlineUnderstanding('not-understood', { hintsDone: true, repeat: 4 });
    assert.match(fourth, /^אין בעיה, בואו נסתכל על זה אחרת/);
    assert.doesNotMatch(fourth, /רמז|שמח|בוא ננסה/);
    assert.equal(guides.needsCheck('הסבר בלי שאלה.', '', 'השאלה שלך: הסבר כללי'), true);
    assert.equal(guides.needsCheck('רמזי חושב…', '', ''), false);
    assert.equal(guides.needsCheck(guides.closingText, '', ''), true);
    assert.equal(guides.needsCheck('מה אפשר לומר על המשולש?', '', ''), true);
  });

  it('shows the short phrase, one button group, and rtl math runs', () => {
    const adapter = viewer.match(/<script id="exact-viewer-adapter">([\s\S]*?)<\/script>/)?.[1] || '';
    const style = viewer.match(/<style id="exact-viewer-presentation">([\s\S]*?)<\/style>/)?.[1] || '';
    assert.match(adapter, /planUnderstanding/);
    assert.match(adapter, /noteCheck/);
    assert.match(adapter, /veiledHints/);
    assert.match(adapter, /inferCheckIntent/);
    assert.match(adapter, /תסבירו מחדש/);
    assert.match(adapter, /content\.textContent='לא הבנתי'/);
    assert.match(adapter, /input\.value=''/);
    assert.match(adapter, /hintFloors/);
    assert.match(adapter, /Math\.max\(released,floor\)/);
    assert.match(adapter, /hintsDone:opened>=3/);
    assert.match(adapter, /createElement\('bdi'\)/);
    assert.match(adapter, /bdi\.dir='ltr'/);
    assert.match(adapter, /p\.dir='rtl'/);
    assert.match(adapter, /ramzi-line/);
    assert.match(adapter, /querySelectorAll\('\.ramzi-check'\)\.forEach/);
    assert.match(adapter, /!rowQualifies\(last\)/);
    assert.match(adapter, /ramziSoftened/);
    assert.match(adapter, /removeChild\(node\)/);
    assert.match(adapter, /noam-retry-action/);
    assert.match(adapter, /openingFor/);
    assert.match(adapter, /noam-bubble\.thinking/);
    assert.doesNotMatch(adapter, /isClosing\(text\)/);
    assert.doesNotMatch(adapter, /exact-error'\)\{return false\}/);
    assert.doesNotMatch(adapter, /שמח|בוא ננסה/);
    assert.match(adapter, /זה בסדר גמור, בואו ננסה אחרת/);
    assert.match(style, /\.exact-viewer \.ramzi-check button\{[\s\S]*min-height:44px/);
    assert.match(style, /font-family:Heebo,'Heebo Fallback',sans-serif/);
    assert.match(style, /\.exact-viewer \.ramzi-check\{[\s\S]*direction:rtl/);
    assert.match(style, /outline:3px solid #22305a/);
    assert.match(style, /bdi\[dir="ltr"\]\{unicode-bidi:isolate;direction:ltr\}/);
    assert.match(style, /\.exact-viewer \.ramzi-line\{margin:0;direction:rtl\}/);
    assert.match(style, /white-space:pre-wrap/);
    assert.doesNotMatch(adapter, /ramzi-check-no[\s\S]{0,80}disabled\s*=/);
  });
});
