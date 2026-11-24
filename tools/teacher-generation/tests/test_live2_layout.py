"""Layout and teaching quality of the round-2 sheets, each on its recorded reply.

The independent checkers of live rounds 1 and 2 (reports/checks.json) found,
besides wrong keys, defects that make a correct sheet unfit to hand out as it
is: the section heading printed inside question 1, about one centimetre of
writing room under every item (a word problem included) and none in Word,
every item of a question with one answer (6, 6, 6; כן, כן, כן), intros that
promise what no item asks ("בצעו את הצעד הראשון", "תחת האילוץ הנתון",
"זהו את הנתונים" over bare exercises, "השוו בין דרכי פתרון"), and a ד07
question built on the distributive law of the next lesson, ד08.

Every test reads questions exactly as the model wrote them (bench/corpus:
L1-g4 is the checked ד07 sheet, L2-g3 the ג10 sheet, L2-g7 and L2-g8 the
equations and percent sheets, L1-p2-a2 the round-1 quadratic sheet) and sends
them through the engine's real compile path, and for Word through the pinned
elementary skill's own exporter. No model call, no network.
"""
from __future__ import annotations

from contextlib import ExitStack
from copy import deepcopy
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from bench import engine, isolate  # noqa: E402
from test_live1_causes import lesson_of, question, reply_of  # noqa: E402
from test_live2_print import Sheet  # noqa: E402
import general_provider  # noqa: E402
import lesson_quality  # noqa: E402
from lesson_select import Selection  # noqa: E402
from runtime_catalog import scope_for_lesson  # noqa: E402
from skill_authoring import question_codes  # noqa: E402
from validation import GenerationError  # noqa: E402

SAME, STEM, BOUNDARY = lesson_quality.SAME_ANSWERS, lesson_quality.STEM_MISMATCH, lesson_quality.OUTSIDE_BOUNDARY


def codes(case_id, group, number, lesson=None):
    lesson = lesson or lesson_of(case_id)
    return question_codes(question(case_id, group, number), lesson, scope_for_lesson(lesson),
                          challenge=group == 'challenges')


class TeachingQuality(unittest.TestCase):
    """The selection-time predicates (skill_authoring.question_codes, lesson_quality)."""

    def test_a_question_whose_items_all_have_one_answer_is_replaced(self):
        # g7 Q6 and Q17: "answer runs of 6,6,6 and 5,5,5"; ג10 Q20: "all three answers 'כן'".
        self.assertIn(SAME, codes('L2-g7', 'practice', 6))
        self.assertIn(SAME, codes('L2-g7', 'practice', 17))
        self.assertIn(SAME, codes('L2-g3', 'challenges', 3))
        # Mixed verdicts, and one item printed three times (the clone check's matter), stay.
        self.assertNotIn(SAME, codes('L2-g7', 'practice', 1))
        wire = question('L2-g7', 'practice', 6)
        wire['items'] = [deepcopy(wire['items'][0]) for _ in wire['items']]
        lesson = lesson_of('L2-g7')
        self.assertNotIn(SAME, question_codes(wire, lesson, scope_for_lesson(lesson), challenge=False))

    def test_an_intro_that_promises_what_no_item_asks_is_replaced(self):
        for case_id, group, number in (
                ('L1-g4', 'practice', 5),      # ד07 Q5 "בצעו את הצעד הראשון וחשבו את התוצאה"
                ('L1-g4', 'practice', 6),      # ד07 Q6 "זהו את הנתונים" over bare expressions
                ('L2-g8', 'practice', 1),      # g8 Q1 "בצעו את הצעד הראשון"
                ('L2-g8', 'practice', 2),      # g8 Q2 "בצעו את הצעד הראשון שוב עם מספרים חדשים"
                ('L2-g8', 'practice', 17),     # g8 Q17 "מצאו את הערך החסר תחת האילוץ הנתון"
                ('L2-g7', 'practice', 17),     # g7 Q17 "פתרון משוואה תחת אילוץ של תנאי נתון"
                ('L1-p2-a2', 'practice', 9),   # quadratic Q8 "בדקו את הנתונים הנתונים בכל סעיף"
                ('L1-p2-a2', 'practice', 11),  # quadratic Q10 "השוו בין דרכי פתרון שונות"
                ('L1-p2-a2', 'reserves', 1)):  # "בחרו את המשוואה המתאימה" with no equation offered
            with self.subTest(case=case_id, group=group, number=number):
                self.assertIn(STEM, codes(case_id, group, number))
        for case_id, group, number in (
                ('L1-g4', 'practice', 14),     # "חשבו והשוו" over compare items
                ('L1-g4', 'practice', 15),     # "בחרו את הנתונים הדרושים" over stories
                ('L1-g8-a2', 'practice', 16),  # two methods worked in the same item
                ('L1-g3', 'reserves', 2)):     # "בדקו האם ... וחשבו" is a self-check
            with self.subTest(case=case_id, group=group, number=number):
                self.assertNotIn(STEM, codes(case_id, group, number))

    def test_a_question_on_the_subject_of_a_later_lesson_is_refused(self):
        # ד07 Q16 splits 3 x (4 + 6) into 3 x 4 + 3 x 6: the distributive law, the title of ד08.
        self.assertEqual(codes('L1-g4', 'practice', 16), [BOUNDARY])
        self.assertNotIn(BOUNDARY, codes('L1-g4', 'practice', 14))  # 3 x (4 + 6) beside 30 only
        # The same question on a lesson after ד08, or where the teacher says the class knows the law.
        later = {**lesson_of('L1-g4'), 'gradeNumber': 5, 'topicId': 'ה06',
                 'lessonBoundary': {**lesson_of('L1-g4')['lessonBoundary'], 'conceptIds': ['ה06#0', 'ה06#1']}}
        self.assertNotIn(BOUNDARY, codes('L1-g4', 'practice', 16, later))
        known = {**lesson_of('L1-g4'), 'lastLesson': 'למדנו את חוק הפילוג בכפל.'}
        self.assertNotIn(BOUNDARY, codes('L1-g4', 'practice', 16, known))

    def test_a_term_beyond_the_boundary_is_refused_per_question(self):
        # The pinned G66 reads the same terms on the built sheet; the question is replaced first.
        lesson = lesson_of('L2-g3')
        wire = question('L2-g3', 'practice', 4)
        self.assertEqual(question_codes(wire, lesson, scope_for_lesson(lesson), challenge=False), [])
        wire['intro'] += ' רשמו את התשובה גם כמספר עשרוני.'
        self.assertEqual(question_codes(wire, lesson, scope_for_lesson(lesson), challenge=False), [])  # "כמספר" is not the term
        wire['intro'] = question('L2-g3', 'practice', 4)['intro'] + ' רשמו מספר עשרוני מתאים.'
        self.assertEqual(question_codes(wire, lesson, scope_for_lesson(lesson), challenge=False), [BOUNDARY])

    def test_a_soft_code_takes_only_a_spare_reserve_and_never_costs_a_question(self):
        # A question that cannot be printed takes the reserve first; the soft one is printed after all.
        verdict = {'soft': ('S',), 'hard': ('H',)}
        planned = [{'group': 'practice', 'question': name} for name in ('soft', 'hard', 'a', 'b', 'c', 'd', 'e')]
        planned.append({'group': 'challenges', 'question': 'f'})
        selection = Selection(planned, [{'group': 'practice', 'question': 'r'}],
                              lambda q, challenge, number: verdict.get(q, ()), soft={'S'})
        self.assertEqual(selection.screen(), [1])
        self.assertEqual(selection.slot(2).question, 'r')
        self.assertEqual(selection.restore({'S'}), 1)
        self.assertEqual((selection.slot(1).question, selection.slot(1).event['action']), ('soft', 'kept'))
        # A position whose question cannot be printed takes a reserve refused only for a soft code
        # before it is dropped (the quadratic sheet's reserve "בחרו את המשוואה המתאימה").
        selection = Selection(planned, [{'group': 'practice', 'question': 'soft'}],
                              lambda q, challenge, number: verdict.get(q, ()), soft={'S'})
        self.assertEqual(selection.screen(), [1, 2])
        self.assertEqual(selection.restore({'S'}), 2)
        self.assertEqual([selection.slot(n).event['action'] for n in (1, 2)], ['kept', 'reserve_kept'])
        self.assertEqual(selection.missing(), [])
        # Recorded: the g8 sheet replaces Q1 and keeps Q2 and Q17 when the reserves are spent,
        # with no correction call; the ד07 sheet replaces Q16 (beyond the boundary) and Q5.
        for case_id, expected in (
                ('L2-g8', {(1, 'reserve'), (2, 'kept'), (17, 'kept')}),
                ('L1-g4', {(5, 'reserve'), (6, 'kept'), (16, 'reserve')})):
            with self.subTest(case=case_id):
                lesson = lesson_of(case_id)
                session = {}
                with patch('provider.request_author_json', return_value=deepcopy(reply_of(case_id))):
                    payload = general_provider.author_general_lesson(
                        lesson, metadata={}, revision=session, api_key='k', model='m',
                        base_url='https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
                        authoring_context={'scope': scope_for_lesson(lesson)})
                draft = session['draft']
                self.assertFalse(draft.needs_model())
                self.assertEqual(len(payload['sections'][0]['questions']), lesson['questionCount'])
                events = {(e['question'], e['action']) for e in draft.selection.record
                          if set(e['codes']) & {SAME, STEM, BOUNDARY}}
                self.assertEqual(events, expected)

    def test_the_teaching_codes_name_a_failure_the_site_knows(self):
        self.assertEqual(general_provider.failure_code([SAME]), 'QUALITY_GATE_FAILED')
        self.assertEqual(general_provider.failure_code([STEM]), 'QUALITY_GATE_FAILED')
        self.assertEqual(general_provider.failure_code([BOUNDARY]), 'OUTSIDE_LESSON_BOUNDARY')

    def test_the_author_is_told_the_activity_stays_off_the_sheet(self):
        lesson = lesson_of('L1-g4')
        sent = {}

        def transport(target, key, body, metadata, timeout):
            sent['system'] = body['messages'][0]['content']
            raise GenerationError('PROVIDER_UNAVAILABLE', 'recorded request only')
        with patch('provider.request_author_json', side_effect=transport):
            with self.assertRaises(GenerationError):
                general_provider.author_general_lesson(
                    lesson, metadata={}, api_key='k', model='m',
                    base_url='https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
                    authoring_context={'scope': scope_for_lesson(lesson)})
        system = sent['system']
        self.assertIn('The activity is private guidance for the items; it is never written on the sheet.', system)
        self.assertIn('a set of yes/no items has both a yes and a no', system)
        self.assertIn('the distributive law a(b + c) = ab + ac', system)
        for planner_words in ('under an explicit constraint', 'names the single step', 'stated category',
                              'everyday decision', 'names that step in plain words'):
            self.assertNotIn(planner_words, system)


class SheetLayout(unittest.TestCase):
    """The trusted adapters' page: headings, writing room, the rule in Word."""

    @classmethod
    def setUpClass(cls):
        cls.scratch = tempfile.mkdtemp(prefix='live2-layout-')
        cls.skills = engine.skill_roots(cls.scratch)
        cls.stack = ExitStack()
        cls.stack.enter_context(engine.engine_environment(cls.skills))
        cls.refused = cls.stack.enter_context(engine.network_guard())

    @classmethod
    def tearDownClass(cls):
        cls.stack.close()
        shutil.rmtree(cls.scratch, ignore_errors=True)

    def tearDown(self):
        self.assertEqual(self.refused, [])

    def compile(self, case_id, questions, *, retitle=None):
        """Four recorded questions on one sheet as the trusted adapter writes it: its work folder."""
        lesson = {**lesson_of(case_id), 'questionCount': 4}
        frame = isolate.neutral(lesson['gradeNumber'])
        compiled = engine.compile_reply(lesson, Sheet(questions, frame['title'], frame['rule']), self.skills,
                                        context=engine.authoring_context(lesson, self.skills))
        self.assertTrue(compiled['ok'], compiled.get('code'))
        payload = compiled['payload']
        if retitle:
            payload = deepcopy(payload)
            payload['sections'][0]['title'] = retitle
        work = Path(tempfile.mkdtemp(dir=self.scratch))
        printed = engine.printed_questions(lesson, payload, self.skills, work)
        self.assertTrue(printed['ok'], printed.get('code'))
        return work

    def test_the_elementary_heading_stands_before_question_one_and_each_item_has_room_by_its_kind(self):
        # ג10: Q1 prints "12 : 3 = ___" (the answer goes in the blank); Q4, Q15 and Q6 are stories of
        # one operation (Q15 with an extra datum).
        work = self.compile('L2-g3', [question('L2-g3', 'practice', n) for n in (1, 4, 15, 6)])
        page = (work / 'sheet.html').read_text(encoding='utf-8')
        questions = re.findall(r'<li[^>]*>(.*?)</li>', page, re.S)
        self.assertEqual(len(questions), 4)
        # The single section repeats the sheet title, which the page already prints: no heading
        # in question 1 between its intro and its items (the checker's page-1 finding).
        self.assertNotIn('class="section-title"', page)
        self.assertTrue(questions[0].startswith(page.split('<li>', 1)[1].split('<div class="sub">', 1)[0]))
        # The room follows each item, outside it, where the Word exporter reads it.
        for body in questions:
            self.assertNotRegex(body, r'<div class="sub">(?:(?!</div>).)*class="ansline"')
            self.assertEqual(body.count('<div class="sub">'), body.count('<div class="ansline"></div>'))
        ruled = [body.count('<div class="wl">') for body in questions]
        self.assertEqual(ruled[0], 0)          # the blank inside the printed formula: one answer line
        self.assertEqual(ruled[1:], [3, 3, 3])  # one-operation stories: a line for the exercise each
        # ד07 Q9: stories of two operations get two lines of working; Q7 prints its three operations.
        order = re.findall(r'<li[^>]*>(.*?)</li>', (self.compile(
            'L1-g4', [question('L1-g4', 'practice', n) for n in (9, 7, 1, 2)]) / 'sheet.html').read_text(encoding='utf-8'), re.S)
        self.assertIn('<div class="work-room"><div class="wl"><br></div><div class="wl"><br></div></div>', order[0])
        self.assertEqual(order[1].count('<div class="work-room"><div class="wl"><br></div></div>'), 3)
        self.assertIn('<div class="rule-box">', page)
        self.assertIn('.goodluck{break-before:avoid', page)
        # Another section title is printed as a heading before its first question, never inside it.
        titled = (self.compile('L2-g3', [question('L2-g3', 'practice', n) for n in (1, 4, 15, 6)],
                               retitle='חילוק בקבוצות') / 'sheet.html').read_text(encoding='utf-8')
        self.assertIn('<ol class="questions">\n<h3 class="section-title">חילוק בקבוצות</h3><li>', titled)

    def test_the_word_file_carries_the_rule_the_writing_room_and_no_heading_in_question_one(self):
        work = self.compile('L2-g3', [question('L2-g3', 'practice', n) for n in (1, 4, 15, 6)])
        out = work / 'sheet.docx'
        skill = self.skills['elementary']
        run = subprocess.run([sys.executable, str(skill / 'scripts/build_docx.py'), str(work / 'sheet.html'), str(out)],
                             capture_output=True, text=True, timeout=300)
        self.assertEqual(run.returncode, 0, run.stderr[-500:])
        import docx
        document = docx.Document(str(out))
        paragraphs = [p.text for p in document.paragraphs]
        first = next(text for text in paragraphs if text.startswith('1. '))
        self.assertNotIn(isolate.neutral(3)['title'], first[3:])
        items = sum(1 for text in paragraphs if re.match(r'^[אבגדהוזחט]\. ', text))
        self.assertEqual(sum(1 for text in paragraphs if text.startswith('תשובה:')), items)
        cells = [cell.text for table in document.tables for row in table.rows for cell in row.cells]
        self.assertTrue(any(isolate.neutral(3)['rule'] in cell for cell in cells))

    def test_the_middle_writing_room_follows_what_the_item_asks(self):
        # Quadratic sheet: Q6 word problems and Q9 printed quadratics need lines of working;
        # Q1 asks for one coefficient of a printed equation.
        work = self.compile('L1-p2-a2', [question('L1-p2-a2', 'practice', n) for n in (1, 6, 9, 2)])
        level = json.loads((work / 'levels.json').read_text(encoding='utf-8'))[0]
        spaces = [[row['space'] for row in q['items']] for q in level['questions']]
        star = [q['star'] for q in level['questions']]
        base = [[space - (14 if star[i] else 0) for space in row] for i, row in enumerate(spaces)]
        allowed = set(general_adapters_space())
        self.assertTrue(all(space in allowed for row in base for space in row), base)
        self.assertTrue(all(space == 68 for space in base[1]), base)    # word problems
        self.assertTrue(all(space == 68 for space in base[2]), base)    # quadratics to solve
        self.assertIn(32, base[0])                                      # a one-step answer keeps one line


def general_adapters_space():
    import general_adapters
    return general_adapters.MIDDLE_SPACE.values()


if __name__ == '__main__':
    unittest.main()
