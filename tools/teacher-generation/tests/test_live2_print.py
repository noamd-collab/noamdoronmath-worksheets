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
