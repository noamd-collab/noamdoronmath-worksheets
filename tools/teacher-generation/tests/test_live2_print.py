"""Keys and print of the three grade-9 lessons that live round 2 did not deliver.

Every test reads questions exactly as the model wrote them in live round 2
(bench/corpus, cases L2-p1, L2-p2, L2-p3 and their second attempts) and sends
them through the engine's real compile path, and where the finding is about
the page, through the pinned middle skill's own printer. No model call, no
network.
"""
from __future__ import annotations

from contextlib import ExitStack
from copy import deepcopy
import json
import re
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from bench import engine, isolate  # noqa: E402
from test_live1_causes import lesson_of, question  # noqa: E402
import gate_policy  # noqa: E402
import skill_feedback  # noqa: E402

# Prints one level the way build.py does (emit_html, weasyprint) and reads its
# numbers twice: with the skill's deliver.pdf_numbers, and as the unpatched
# skill read them (get_text("text"), which glues an exponent to its base).
PRINT_AND_READ = r'''
import json, sys
skill, levels, pdf, extra = sys.argv[1:5]
sys.path.insert(0, skill)
import deliver as D, emit_html as E, weasyprint, pymupdf
L = json.load(open(levels, encoding="utf-8"))[0]
weasyprint.HTML(string=E.build_html(D.normalize(L)), base_url=skill).render().write_pdf(pdf)
if extra:
    doc = pymupdf.open(pdf)
    doc[0].insert_text((72, 72), extra)
    doc.saveIncr()
got, pages = D.pdf_numbers(pdf)
glued = []
for page in pymupdf.open(pdf):
    glued += [D._norm_num(t) for t in D._NUM_RE.findall(page.get_text("text").replace("−", "-"))]
print(json.dumps({"strays": D.stray_numbers(L, [], got, pages),
                  "glued": D.stray_numbers(L, [], [g for g in glued if g], pages)}))
'''


class Sheet:
    """Answer an author request with given questions in its slots, in order (practice, then challenges)."""

    def __init__(self, questions, title, rule):
        self.questions, self.title, self.rule = list(questions), title, rule

    def __call__(self, target, key, body, metadata, timeout):
        schema = body['response_format']['json_schema']['schema']
        flat, resolve = engine._question_object(schema)
        reply, queue = {}, iter(self.questions)
        for name in flat.get('required', list(flat['properties'])):
            spec = resolve(flat['properties'][name])
            if name in ('practice', 'challenges'):
                reply[name] = [deepcopy(next(queue)) for _ in range(spec.get('minItems', 1))]
            elif isinstance(spec, dict) and spec.get('type') == 'array':
                reply[name] = []  # reserves are optional on arrival
            else:
                reply[name] = self.title if name == 'title' else self.rule
        if isinstance(metadata, dict):
            metadata.update(responseReceived=True, usage={}, elapsedSeconds=0.0)
        return reply


class LiveTwoPrint(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.scratch = tempfile.mkdtemp(prefix='live2-print-')
        cls.skills = engine.skill_roots(cls.scratch)
        cls.stack = ExitStack()
        cls.stack.enter_context(engine.engine_environment(cls.skills))
        cls.refused = cls.stack.enter_context(engine.network_guard())
        cls.isolators = {}

    @classmethod
    def tearDownClass(cls):
        cls.stack.close()
        shutil.rmtree(cls.scratch, ignore_errors=True)

    def tearDown(self):
        self.assertEqual(self.refused, [])

    def isolator(self, case_id):
        if case_id not in self.isolators:
            self.isolators[case_id] = isolate.Isolator(lesson_of(case_id), self.skills)
        return self.isolators[case_id]

    def code(self, case_id, wire):
        failure = self.isolator(case_id).check(wire)
        return None if failure is None else failure['code']

    def printed(self, case_id, questions):
        """A four-question sheet of these questions as the trusted adapter writes it: (work folder, record)."""
        isolator = self.isolator(case_id)
        transport = Sheet(questions, isolator.frame['title'], isolator.frame['rule'])
        compiled = engine.compile_reply(isolator.lesson, transport, self.skills, context=isolator.context)
        self.assertTrue(compiled['ok'], compiled.get('code'))
        work = Path(tempfile.mkdtemp(dir=self.scratch))
        printed = engine.printed_questions(isolator.lesson, compiled['payload'], self.skills, work)
        self.assertTrue(printed['ok'], printed.get('code'))
        return work, printed['questions']

    def keys(self, case_id, wire):
        return [item['answer'] for item in self.printed(case_id, [wire] * 4)[1][0]['items']]

    def prompts(self, case_id, wire):
        return [item['text'] for item in self.printed(case_id, [wire] * 4)[1][0]['items']]

    # 3. A task printed after a prompt may not show an earlier item's answer.

    def test_a_task_that_shows_an_earlier_answer_is_withheld_and_the_prompt_asks_alone(self):
        # L2-p1 practice 3 (rhombus, ∡ABM = 28): "∡BAM" typed 90 - 28 after ∡AMB keyed 90, and
        # "∡BAD" typed 2 * 62 after ∡BAM keyed 62. Refused as PRINTED_ANSWER_LEAK in live round 2;
        # the prompts name what to find, so they print alone and the keys stay the kernel's values.
        wire = question('L2-p1', 'practice', 3)
        self.assertIsNone(self.code('L2-p1', wire))
        items = self.printed('L2-p1', [wire] * 4)[1][0]['items']
        self.assertNotIn('28', items[1]['text'])
        self.assertNotIn('62', items[2]['text'])
        self.assertIn('62', items[1]['answer'])
        self.assertIn('124', items[2]['answer'])
        # L1-p1 practice 17: "112 / 2" after the item keyed 112, under "חשבו את שטח המעוין".
        items = self.printed('L1-p1', [question('L1-p1', 'practice', 17)] * 4)[1][0]['items']
        self.assertNotIn('112', items[1]['text'])
        self.assertIn('56', items[1]['answer'])
        # L2-p2 practice 12: "מהו המספר העוקב לו?" typed 7 + 1 after the item keyed 7.
        self.assertIsNone(self.code('L2-p2', question('L2-p2', 'practice', 12)))

    def test_the_elementary_printer_withholds_the_same_task(self):
        # A-order practice 1 (grade 4, a table of results): item 6 typed 6 * 2 + 4 * 3 after the
        # item keyed 6. Under a prompt that names what to find, both printers leave the task out.
        wire = question('A-order', 'practice', 1)
        wire['items'][5]['prompt'] = 'חשבו את הסכום של שתי המכפלות.'
        self.assertIsNone(self.code('A-order', wire))
        items = self.printed('A-order', [wire] * 4)[1][0]['items']
        self.assertNotIn('6 x 2', items[5]['text'])
        self.assertIn('24', items[5]['answer'])

    def test_a_prompt_that_means_nothing_without_its_task_and_a_printed_answer_are_still_refused(self):
        # "חשבו ישירות לפי סדר הפעולות." asks for the printed calculation itself.
        self.assertEqual(self.code('A-order', question('A-order', 'practice', 1)), 'PRINTED_ANSWER_LEAK')
        # A later prompt that prints the earlier answer itself: "עבור [[x = 6]]" after solving x = 6,
        # "[[AM = 8]]" after the item keyed 8.
        self.assertEqual(self.code('L2-p1', question('L2-p1', 'reserves', 2)), 'PRINTED_ANSWER_LEAK')
        self.assertEqual(self.code('L2-p1', question('L2-p1', 'practice', 16)), 'PRINTED_ANSWER_LEAK')

    # 4. Yes/no items: a claim that decides nothing is refused; a claim the print states is decided.

    def decide_item(self, case_id, group, number, j, correction=None):
        """One recorded yes/no item alone in its question (three copies), as the scan of every decide item reads it."""
        wire = question(case_id, group, number, correction)
        wire['items'] = [deepcopy(wire['items'][j - 1]) for _ in range(3)]
        return wire

    def test_a_claim_whose_two_sides_are_the_same_is_refused(self):
        # Accepted before, each printing "כן" with "13 = 13", "0 = 0", "73 = 73": the claim is a dummy.
        for case_id, group, number, j in (('L2-p1', 'practice', 13, 3),    # "is a quadrilateral with four sides of 13 a rhombus?"
                                          ('L1-p2', 'reserves', 2, 2),     # "discriminant 0: exactly one solution?"
                                          ('L1-square-a2', 'practice', 8, 3)):  # "45°" typed 45 = 45
            with self.subTest(case=case_id, number=number):
                self.assertEqual(self.code(case_id, self.decide_item(case_id, group, number, j)), 'PRINTED_ANSWER_KIND')
        # Refused before, and still: "do both methods give the same result?" typed 4 = 4 prints neither 4.
        self.assertIsNotNone(self.code('L2-p3-a2', self.decide_item('L2-p3-a2', 'practice', 11, 3)))

    def test_a_claim_the_print_states_is_decided(self):
        cases = (
            # "is [[x = 5]] a solution of [[x + 3 = 8]]?": the value is printed as the letter's assignment.
            ('L2-g7', 'practice', 1, 1, 'כן'), ('L2-g7', 'practice', 1, 2, 'לא'),
            ('L2-p2-a2', 'practice', 8, 1, 'כן'),
            # "for [[x = 5]], is [[(x + 2)^2]] greater than [[x^2 + 20]]?": both sides at the printed value.
            ('L2-p2-a2', 'practice', 5, 1, 'כן'), ('L2-p2-a2', 'practice', 5, 3, 'כן'),
            # Words that restate the printed sign: "האם שתי הדרכים נותנות אותה תוצאה? בדקו האם [[A = B]]."
            ('L2-p2-a2', 'practice', 11, 3, 'כן'), ('L2-p3', 'q19', None, 3, 'לא', 1),
            # A printed measure of a named object: "האם סכום הזוויות [[∠BAD = 110°]] ו־[[∠ADC = 70°]] שווה ל־[[180°]]?"
            ('L2-p3', 'q5', None, 1, 'כן', 1), ('L2-p3', 'q5', None, 2, 'לא', 1),
        )
        for case_id, group, number, j, verdict, *correction in cases:
            with self.subTest(case=case_id, number=number, item=j):
                wire = self.decide_item(case_id, group, number, j, *correction)
                self.assertIsNone(self.code(case_id, wire))
                key = self.printed(case_id, [wire] * 4)[1][0]['items'][0]['answer']
                self.assertTrue(key.startswith(verdict + '.') or key == verdict, key)

    def test_a_claim_that_is_not_the_printed_comparison_is_still_refused(self):
        wire = self.decide_item('L2-p2-a2', 'practice', 5, 1)  # (5 + 2)^2 gt 5^2 + 20
        swapped = deepcopy(wire)
        for item in swapped['items']:
            task = item['answer']['task']
            task['left'], task['right'] = task['right'], task['left']
        self.assertEqual(self.code('L2-p2-a2', swapped), 'PRINTED_TASK_MISMATCH')
        other = deepcopy(wire)
        for item in other['items']:
            item['answer']['task']['right'] = '5^2 + 21'
        self.assertEqual(self.code('L2-p2-a2', other), 'PRINTED_TASK_MISMATCH')
        # The assignment of another letter than the equation's binds nothing.
        letter = self.decide_item('L2-g7', 'practice', 1, 1)
        for item in letter['items']:
            item['prompt'] = item['prompt'].replace('[[x = 5]]', '[[y = 5]]')
        self.assertEqual(self.code('L2-g7', letter), 'PRINTED_ANSWER_KIND')

    # 5. A key in a unit of another size than the item asks for.

    def test_a_width_keyed_in_square_units_is_refused(self):
        # Checker, round 1, Q5א: "מהו רוחב השולחן בדצמ"ר?" keyed 8 דצמ"ר; and "מהו אורך צלעו?" keyed in סמ"ר.
        wire = question('L1-p2-a2', 'reserves', 3)
        self.assertEqual(self.code('L1-p2-a2', wire), 'PRINTED_ANSWER_KIND')
        fixed = deepcopy(wire)
        fixed['items'][0]['prompt'] = fixed['items'][0]['prompt'].replace('ב־[[4]] דצמ"ר', 'ב־[[4]] דצ"מ').replace('בדצמ"ר?', 'בדצ"מ?')
        fixed['items'][0]['answer']['unit'] = 'דצ"מ'
        self.assertNotEqual(self.code('L1-p2-a2', fixed), 'PRINTED_ANSWER_KIND')
        self.assertEqual(self.code('L1-square-a2', question('L1-square-a2', 'challenges', 1)), 'PRINTED_ANSWER_KIND')
        # A product of two lengths is an area: "חשבו את מכפלת האלכסונים" in סמ"ר stays.
        from printed_parts import check_unit_size
        product = question('L2-p1', 'practice', 17)['items'][0]
        check_unit_size({'prompt': [{'kind': 'text', 'text': product['prompt']}], 'answer': product['answer']})

    # 2. A printed formula keeps exactly the author's letters.

    def test_every_recorded_letter_prints_as_the_author_wrote_it(self):
        # Round 1 printed [[a*x^2 + b*x + c = 0]] as "xy² + ay + c = 0" and b*x as "yx": the
        # adapter renamed letters to its internal aliases. Every letter-bearing island of every
        # recorded middle-school reply (normalised as on arrival) prints its letters in order.
        from compact_authoring import provider_span_array
        from general_adapters import _formula_text
        from general_source import GeneralSourceError
        from math_tasks import MathTaskError, to_house_math
        from reply_salvage import salvage
        from runtime_catalog import scope_for_lesson
        from source_normalize import normalize_source
        from test_live1_causes import CASES, CORPUS

        def source_letters(text):
            return re.findall(r'[A-Za-z]', re.sub(r'sqrt|frac|pi|(?:point|segment|triangle|angle|polygon):', '', text))

        def printed_letters(text):
            return re.findall(r'[A-Za-z]', re.sub(r'\\[A-Za-z]+', '', text))

        def strings(value):
            if isinstance(value, str):
                yield value
            for inner in (value.values() if isinstance(value, dict) else value if isinstance(value, list) else ()):
                yield from strings(inner)

        checked = {}
        for case in CASES.values():
            lesson = lesson_of(case['id'])
            grade = lesson['gradeNumber']
            if grade < 7:
                continue
            topic = scope_for_lesson(lesson)['topic']
            for name in [case['firstReply']] + [e['reply'] if isinstance(e, dict) else e for e in case['corrections']]:
                text = (CORPUS / name).read_text(encoding='utf-8')
                try:
                    reply = json.loads(text)
                except ValueError:
                    reply = (salvage(text) or [None])[0]
                for value in strings(normalize_source(reply, grade, topic=topic, notes=[])):
                    islands = re.findall(r'\[\[(.*?)\]\]', value)
                    if not any(source_letters(island) for island in islands):
                        continue
                    try:
                        spans = [s for s in provider_span_array([value], grade) if s.get('kind') != 'text']
                    except (GeneralSourceError, MathTaskError):
                        continue  # refused: nothing is printed
                    if len(spans) != len(islands):
                        continue
                    for island, span in zip(islands, spans):
                        try:
                            printed = (_formula_text(span['notation'], grade, None) if span['kind'] == 'formula'
                                       else to_house_math(span['expression'], schoolbook=True)
                                       if span['kind'] == 'math' else None)
                        except (GeneralSourceError, MathTaskError):
                            continue
                        if printed is not None and source_letters(island):
                            checked[island] = printed
        self.assertGreater(len(checked), 900)
        wrong = {island: printed for island, printed in checked.items()
                 if source_letters(island) != printed_letters(printed)}
        self.assertEqual(wrong, {})
        self.assertEqual(checked['a*x^2 + b*x + c = 0'], 'ax^{2} + bx + c = 0')
        self.assertEqual(checked['x^2 + b*x + 36 = 0'], 'x^{2} + bx + 36 = 0')

    # 1. The middle skill's PDF number check and raised exponents.

    def exponent_sheet(self):
        # L2-p2-a2: "חשבו את ערכו של [[2^2]]" (reserve 4, item 3) failed the render with
        # "the PDF prints 1 number(s) no datum of this level states (22)".
        first = [question('L2-p2-a2', 'practice', n) for n in (2, 3, 4)]
        return self.printed('L2-p2-a2', first + [question('L2-p2-a2', 'reserves', 4)])

    def print_and_read(self, work, extra=''):
        try:
            import weasyprint  # noqa: F401
        except (ImportError, OSError):
            self.skipTest('weasyprint is not installed with its native libraries')
        run = subprocess.run([sys.executable, '-P', '-c', PRINT_AND_READ, str(self.skills['middle']),
                              str(work / 'levels.json'), str(work / 'sheet.pdf'), extra],
                             cwd=work, capture_output=True, text=True, timeout=240)
        self.assertEqual(run.returncode, 0, run.stderr[-2000:])
        return json.loads(run.stdout.strip().splitlines()[-1])

    def test_a_raised_exponent_is_read_as_its_own_number(self):
        work, _ = self.exponent_sheet()
        read = self.print_and_read(work)
        self.assertIn('22', read['glued'])  # the reading before: 2² glued to "22"
        self.assertEqual(read['strays'], [])

    def test_a_number_no_datum_states_still_fails_the_pdf(self):
        work, _ = self.exponent_sheet()
        self.assertEqual(self.print_and_read(work, extra='9876')['strays'], ['9876'])

    def test_a_stray_pdf_number_names_the_question_that_prints_it(self):
        work, printed = self.exponent_sheet()
        levels = json.loads((work / 'levels.json').read_text(encoding='utf-8'))
        owner = [n for n, q in enumerate(printed, 1) if any('2^{2}' in item['text'] for item in q['items'])]
        self.assertEqual(len(owner), 1)
        log = ('deliver.DeliverError: deliver: the PDF prints 1 number(s) no datum of this level states (22) '
               '-- every number on the page comes from the level\'s own data (spec rule 1).\n')
        rows = skill_feedback.stray_number_rows(log, levels)
        self.assertEqual([(row['code'], row['question']) for row in rows], [('BUILD_PLUS', owner[0])])
        report = {'complete': True, 'findings': rows, 'unnamed': []}
        self.assertEqual(gate_policy.decide(report, ['middle-build'])['action'], 'replace')
        # A number that no question prints, or a list the message cut short, stays unnamed.
        self.assertEqual(skill_feedback.stray_number_rows(log.replace('(22)', '(9876)'), levels), [])
        cut = log.replace('prints 1 number(s)', 'prints 9 number(s)')
        self.assertEqual(skill_feedback.stray_number_rows(cut, levels), [])


if __name__ == '__main__':
    unittest.main()
