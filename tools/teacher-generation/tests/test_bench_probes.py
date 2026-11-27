"""Notation probes: the corpus, the judgement of a print, and the runner. No model, no network."""
from __future__ import annotations

import contextlib
import importlib.util
import io
import json
from pathlib import Path
import shutil
import sys
import tempfile
import unittest
from unittest import mock

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
from bench import engine  # noqa: E402
from bench.probes import run, verdict  # noqa: E402

ADAPTER_READY = all(importlib.util.find_spec(name) for name in ('sympy', 'bs4', 'matplotlib', 'numpy', 'lxml'))


class CorpusTests(unittest.TestCase):
    def test_corpus_is_grouped_by_family_with_a_recorded_outcome_per_probe(self):
        documents = run.load()
        probes = [probe for _, document in documents for probe in document['probes']]
        self.assertEqual((len(documents), len(probes)), (25, 285))
        self.assertEqual(len({probe['id'] for probe in probes}), 285)
        for path, document in documents:
            self.assertEqual(path.stem, document['family'])
            for probe in document['probes']:
                self.assertTrue(probe['id'].startswith(document['family'] + '-'))
                self.assertTrue(('prompt' in probe and 'answer' in probe) != ('items' in probe))
                recorded = probe['recorded']
                # A probe is refused or printed correctly; no wrong print is ever recorded.
                self.assertIn(recorded['outcome'], ('pass', 'rejected'))
                if recorded['outcome'] == 'rejected':
                    self.assertRegex(recorded['code'], r'^[A-Z_:a-zA-Z]+$')
                else:
                    self.assertTrue('key' in recorded or 'items' in recorded)
                    self.assertNotIn('flags', recorded)
                for key in probe.get('expect', {}):
                    self.assertIn(key, ('key', 'keyContains', 'keyExcludes'))


class VerdictTests(unittest.TestCase):
    def flags(self, prompt, printed, key, expect=None, context=False):
        return verdict.item_flags(prompt, printed, key, expect, context)[0]

    def test_numbers_are_compared_by_value(self):
        self.assertEqual(verdict.numbers('45,238 ועוד 12.50, frac(2,5) ו־$x^{2}$'), ['45238', '12.5', '2', '5', '2'])

    def test_a_numeral_is_read_whatever_its_spelling(self):
        # A raised digit is the digit, apart from its base; a decimal without its zero is that decimal.
        self.assertEqual(verdict.numbers('[[x² - 9]]'), verdict.numbers('$x^{2} − 9$'))
        self.assertEqual(verdict.numbers('[[2³]]'), ['2', '3'])
        self.assertEqual(verdict.numbers('[[.5 + 1.25]]'), verdict.numbers('0.5 + 1.25'))
        self.assertEqual(verdict.numbers('סוף המשפט. 5 תפוחים'), ['5'])
        # The written exercise printed as written is not "numbers the prompt did not carry".
        self.assertEqual(verdict.item_flags('[[x² - 9]]', '$x^{2} − 9$', '$\\g{x − 3}\\g{x + 3}$', None)[0], [])
        self.assertEqual(verdict.item_flags('[[.5 + 1.25]]', '0.5 + 1.25', '1.75', None)[0], [])
        # Printing the exercise a second time still is.
        self.assertEqual(verdict.item_flags('[[x² - 9]]', '$x^{2} − 9$ $x^{2} − 9$', '$x$', None)[0], ['print_adds_numbers'])

    def test_clean_prints_are_not_flagged(self):
        self.assertEqual(self.flags('[[348 + 276]]', '348 + 276', '624'), [])
        # The intended form: a bare instruction, then the exercise once.
        self.assertEqual(self.flags('חשבו.', 'חשבו. 348 + 276', '624'), [])
        self.assertEqual(self.flags('[[___ + 5 = 9]]', '___ + 5 = 9', '4'), [])
        self.assertEqual(self.flags('פתרו את המשוואה [[2x + 3 = 9]].', 'פתרו את המשוואה $2x + 3 = 9$.', '$x = 3$'), [])
        self.assertEqual(self.flags('[[345]] ___ [[354]]', '345 ___ 354', '345 < 354'), [])
        self.assertEqual(self.flags('מספר הגדול ב־[[5]] ממספר [[n]]', 'מספר הגדול ב־$5$ ממספר $n$', '$n + 5$'), [])

    def test_answer_beside_question_and_repeated_key(self):
        self.assertEqual(self.flags('במספר [[45,238]], מהו הערך של הספרה [[5]]?',
                                    'במספר 45,238 , מהו הערך של הספרה 5 ? 5,000', '5,000'), ['answer_beside_question'])
        self.assertEqual(self.flags('כמה צלעות יש למשושה?', 'כמה צלעות יש למשושה? 6', '6'), ['answer_beside_question'])
        self.assertEqual(self.flags('[[frac(7,3)]]', '7 3', '7 3'), ['key_repeats_question'])

    def test_exercise_printed_again_or_revealed(self):
        self.assertEqual(self.flags('[[7]] ___ [[9]]', '7 ___ 9 7 ___ 9', '7 < 9'), ['print_adds_numbers'])
        story = 'לדני היו [[124]] גולות. הוא קיבל עוד [[38]] גולות. כמה גולות יש לו עכשיו?'
        self.assertEqual(self.flags(story, story.replace('[[', '').replace(']]', '') + ' 124 + 38', '162 גולות'),
                         ['print_adds_numbers'])
        wordy = 'מטילים קובייה הוגנת. מה ההסתברות לקבל מספר זוגי? כתבו כאחוז.'
        self.assertEqual(self.flags(wordy, wordy + ' $\\f{3}{6} · 100$', '$50$ %'), ['print_adds_numbers'])
        self.assertEqual(self.flags('כמה ספרים נקראו בסך הכול?', 'כמה ספרים נקראו בסך הכול? (12 + 15) + 9', '36',
                                    context=True), ['print_adds_numbers'])

    def test_several_blanks_need_several_values(self):
        prompt = 'בַּמִּסְפָּר [[47]] יֵשׁ ___ עֲשָׂרוֹת וְ־___ יְחִידוֹת.'
        self.assertIn('one_key_for_several_blanks', self.flags(prompt, 'במספר 47 יש ___ עשרות ו־___ יחידות.', '47'))
        self.assertEqual(self.flags(prompt, 'במספר 47 יש ___ עשרות ו־___ יחידות.', '4 עשרות, 7 יחידות'), [])

    def test_expectation_overrides_the_rules(self):
        expect = {'key': ['9', '2']}
        prompt = '[[47 : 5]] = ___ (שארית ___)'
        self.assertEqual(self.flags(prompt, '47 : 5 = ___ (שארית ___)', '47 5', expect)[0], 'key_mismatch')
        self.assertEqual(self.flags(prompt, '47 : 5 = ___ (שארית ___)', '9 שארית 2', expect), [])
        yes = {'keyContains': ['כן']}
        self.assertEqual(self.flags('האם [[345 < 354]]?', 'האם 345 < 354 ?', '345 < 354', yes), ['key_mismatch'])
        self.assertEqual(self.flags('האם [[345 < 354]]?', 'האם 345 < 354 ?', 'כן', yes), [])
        false_claim = {'keyContains': ['נכון'], 'keyExcludes': ['לא נכון']}
        self.assertEqual(self.flags('נכון או לא נכון: [[32 : 4 = 8]]', 'נכון או לא נכון: 32 : 4 = 8', 'לא נכון', false_claim),
                         ['key_mismatch'])
        drawing = {'key': []}
        self.assertEqual(self.flags('ציירו מלבן ששטחו [[12]] משבצות.', 'ציירו מלבן ששטחו 12 משבצות.', '12', drawing),
                         ['key_mismatch', 'key_repeats_question'])

    def test_judge_keeps_the_record_small_and_complete(self):
        probe = {'id': 'x-01', 'prompt': '[[348 + 276]]', 'answer': {}}
        self.assertEqual(verdict.judge(probe, {'stage': 'source', 'code': 'SOURCE_NOTATION', 'detail': 'long text'}),
                         {'outcome': 'rejected', 'stage': 'source', 'code': 'SOURCE_NOTATION'})
        printed = {'stage': 'printed', 'items': [{'printed': '348 + 276', 'key': '624', 'unverified': False}]}
        self.assertEqual(verdict.judge(probe, printed), {'outcome': 'pass', 'printed': '348 + 276', 'key': '624'})
        leaked = {'stage': 'printed', 'items': [{'printed': '348 + 276 624', 'key': '624', 'unverified': False}]}
        self.assertEqual(verdict.judge(probe, leaked)['flags'], ['answer_beside_question'])


class ChangeTests(unittest.TestCase):
    def test_changes_are_sorted_by_what_they_mean(self):
        def probe(name, before):
            return {'id': name, 'topic': 't', 'prompt': 'p', 'recorded': before}
        passed = {'outcome': 'pass', 'printed': 'a', 'key': '1'}
        rejected = {'outcome': 'rejected', 'stage': 'source', 'code': 'SOURCE_NOTATION'}
        wrong = {'outcome': 'wrong_print', 'flags': ['answer_beside_question'], 'printed': 'a 1', 'key': '1'}
        document = {'family': 'f', 'probes': [
            probe('unlocked', rejected), probe('regressed', passed), probe('leaks', passed), probe('worse', wrong),
            probe('still', wrong), probe('repaired', wrong), probe('recode', rejected), probe('reworded', passed),
            probe('same', passed), {'id': 'new', 'topic': 't', 'prompt': 'p'},
            {'id': 'fresh', 'topic': 't', 'prompt': 'p'}]}
        now = {'unlocked': passed, 'regressed': rejected, 'leaks': wrong,
               'worse': {**wrong, 'flags': ['answer_beside_question', 'key_mismatch']}, 'still': wrong,
               'repaired': passed, 'recode': {**rejected, 'code': 'SOURCE_TEXT'}, 'reworded': {**passed, 'key': '2'},
               'same': passed, 'new': passed, 'fresh': wrong}
        found = run.changes([(Path('f.json'), document)], now)
        # Every current wrong print is listed: a new one, a worse one, one recorded before and an unrecorded one.
        self.assertEqual({kind: [line.split(' ')[0] for line in lines] for kind, lines in found.items()}, {
            'wrong_print': ['leaks', 'worse', 'still', 'fresh'], 'newly_rejected': ['regressed'],
            'unlocked': ['unlocked'], 'fixed_print': ['repaired'], 'code_changed': ['recode'],
            'print_changed': ['reworded'], 'unrecorded': ['new']})


@unittest.skipUnless(ADAPTER_READY, 'The trusted adapter needs the engine runtime packages')
class RunnerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.scratch = tempfile.mkdtemp(prefix='bench-probes-test-')
        cls.skills = engine.skill_roots(cls.scratch)
        cls.documents = run.load()
        probes = [probe for _, document in cls.documents for probe in document['probes']]
        cls.outcomes = run.run_probes(probes, Path(cls.scratch) / 'work', skills=cls.skills)

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.scratch, ignore_errors=True)

    def test_every_probe_gets_an_outcome_through_the_engine(self):
        self.assertEqual(len(self.outcomes), 285)
        for name, outcome in self.outcomes.items():
            self.assertIn(outcome['outcome'], ('pass', 'rejected'), name)
            self.assertFalse(str(outcome.get('code', '')).startswith('ENGINE_EXCEPTION'), (name, outcome))
        # Both skills are exercised, and both outcomes occur.
        kinds = {outcome['outcome'] for outcome in self.outcomes.values()}
        self.assertEqual(kinds, {'pass', 'rejected'})
        table = run.family_table(self.documents, self.outcomes)
        self.assertIn('| **all** | 285 |', table)

    def test_no_probe_prints_a_wrong_key(self):
        """The invariant: a probe is refused or printed correctly, never printed wrongly.

        A wrong print is fixed in the engine by refusing that form. After a
        deliberate engine change, review the runner's report and record the new
        state with `bench/probes/run.py --update`.
        """
        offenders = [f"{probe['id']}: {self.outcomes[probe['id']].get('flags')} key «{self.outcomes[probe['id']].get('key')}»"
                     for _, document in self.documents for probe in document['probes']
                     if self.outcomes[probe['id']]['outcome'] == 'wrong_print']
        self.assertEqual(offenders, [])


def _computed(task, unit=''):
    return {'kind': 'computed', 'task': task, 'unit': unit}


def _evaluate(expression, unit=''):
    return _computed({'kind': 'evaluate', 'expression': expression}, unit)


def _compare(left, right):
    return _computed({'kind': 'compare', 'left': left, 'right': right})


def _inequality(lhs, rhs, relation):
    return _computed({'kind': 'inequality', 'variable': 'x', 'lhs': lhs, 'rhs': rhs, 'relation': relation})


_BLANK_ROWS = {'head': ['ביטוי', 'תוצאה'],
               'rows': [['[[10 + 2 * 3]]', '___'], ['[[5 * 4 - 2]]', '___'], ['[[8 + 12 / 4]]', '___']]}

# Rewordings of the 14 forms that once printed a wrong key or a revealed operation (comparison-10, 11, 14, 15, 16,
# ratio-01, 03, time-02, 03, word_problems-04, inequalities-03, powers_roots-08, data_tables_charts-13,
# probability-04): (form, topic, intro, prompt, answer, extra, (stage, code)). Every one must be refused.
REWORDED = (
    ('comparison-10', 'ג02', 'האם הטענה נכונה?', '[[345 < 354]]', _compare('345', '354'), {},
     ('source', 'PRINTED_ANSWER_KIND')),
    ('comparison-10', 'ג02', 'בדקו.', 'האם [[345 < 354]] או לא?', _compare('345', '354'), {},
     ('source', 'PRINTED_ANSWER_KIND')),
    ('comparison-10', 'ג02', 'ענו.', 'בדקו אם [[345 < 354]].', _compare('345', '354'), {},
     ('source', 'PRINTED_ANSWER_KIND')),
    ('comparison-10', 'ג02', 'ענו.', '[[345 < 354]], נכון?', _compare('345', '354'), {},
     ('source', 'PRINTED_ANSWER_KIND')),
    ('comparison-11', 'ג02', 'סדרו מהקטן לגדול.', 'סדרו: [[354]], [[345]], [[435]]', _evaluate('345'), {},
     ('source', 'PRINTED_ANSWER_KIND')),
    ('comparison-11', 'ג02', 'ענו.', 'סדרו את המספרים [[354]], [[345]], [[435]] מהקטן לגדול.', _evaluate('345'), {},
     ('source', 'PRINTED_ANSWER_KIND')),
    ('comparison-14', 'ג10', 'בדקו.', 'בדקו אם [[32 : 4 = 8]].', _compare('32 / 4', '8'), {},
     ('source', 'PRINTED_ANSWER_KIND')),
    ('comparison-14', 'ג10', 'האם התרגילים נכונים?', '[[32 : 4 = 8]]', _compare('32 / 4', '8'), {},
     ('source', 'PRINTED_ANSWER_KIND')),
    ('comparison-14', 'ג10', 'בדקו.', 'התרגיל [[32 : 4 = 8]] נכון?', _compare('32 / 4', '8'), {},
     ('source', 'PRINTED_ANSWER_KIND')),
    ('comparison-15', 'ג10', 'קבעו נכון או לא נכון.', '[[32 : 4 = 8]]', _compare('32 / 4', '8'), {},
     ('source', 'PRINTED_ANSWER_KIND')),
    ('comparison-15', 'ג10', 'בדקו.', 'קבעו אם התרגיל נכון: [[32 : 4 = 8]]', _compare('32 / 4', '8'), {},
     ('source', 'PRINTED_ANSWER_KIND')),
    ('comparison-16', 'ג10', 'קבעו נכון או לא נכון.', '[[32 : 4 = 9]]', _compare('32 / 4', '9'), {},
     ('source', 'PRINTED_ANSWER_KIND')),
    ('comparison-16', 'ג10', 'בדקו.', 'בדקו אם [[32 : 4 = 9]].', _compare('32 / 4', '9'), {},
     ('source', 'PRINTED_ANSWER_KIND')),
    ('ratio-01', 'ו21', 'כתבו את היחס.',
     'בכיתה [[12]] בנים ו־[[18]] בנות. היחס בין מספר הבנים למספר הבנות הוא ___.', _evaluate('12 / 18'), {},
     ('source', 'PRINTED_ANSWER_KIND')),
    ('ratio-01', 'ו21', 'ענו.', 'בכיתה [[12]] בנים ו־[[18]] בנות. איזה יחס יש בין הבנים לבנות?',
     _evaluate('12 / 18'), {}, ('source', 'PRINTED_ANSWER_KIND')),
    ('ratio-01', 'ו21', 'ענו.', 'בכיתה [[12]] בנים ו־[[18]] בנות. רשמו בצורה מצומצמת את יחס הבנים לבנות.',
     _evaluate('12 / 18'), {}, ('source', 'PRINTED_ANSWER_KIND')),
    ('ratio-03', 'ו21', 'רשמו בצורה מצומצמת את היחס.', '[[12 : 18]]', _evaluate('12 / 18'), {},
     ('source', 'PRINTED_ANSWER_KIND')),
    ('ratio-03', 'ו21', 'כתבו כיחס מצומצם.', '[[12 : 18]]', _evaluate('12 / 18'), {},
     ('source', 'PRINTED_ANSWER_KIND')),
    # A clock time in digits is mathematics outside an island: refused for its notation before the request is
    # read. Written in words, the request for a time of day is refused by its form.
    ('time-02', 'ג19', 'ענו.', 'השעה עכשיו 7:30. בעוד [[45]] דקות יצלצל הפעמון. מתי יצלצל הפעמון?',
     _evaluate('8'), {}, ('source', 'SOURCE_NOTATION')),
    ('time-02', 'ג19', 'ענו.', 'השעה עכשיו 7:30. בעוד [[45]] דקות השעה תהיה ___.', _evaluate('8'), {},
     ('source', 'SOURCE_NOTATION')),
    ('time-02', 'ג19', 'ענו.', 'השעה עכשיו 7:30. האוטובוס ייסע [[45]] דקות. לאיזו שעה יגיע?', _evaluate('8'), {},
     ('source', 'SOURCE_NOTATION')),
    ('time-02', 'ג19', 'ענו.', 'השעה עכשיו שבע וחצי. בעוד [[45]] דקות יצלצל הפעמון. מתי יצלצל הפעמון?',
     _evaluate('8'), {}, ('source', 'PRINTED_ANSWER_KIND')),
    ('time-02', 'ג19', 'ענו.', 'השעה עכשיו שבע וחצי. האוטובוס ייסע [[45]] דקות. לאיזו שעה יגיע?', _evaluate('8'), {},
     ('source', 'PRINTED_ANSWER_KIND')),
    ('time-03', 'ג19', 'ענו.', 'השעה עכשיו [[7]]:[[30]]. השיעור יימשך [[45]] דקות. מתי יסתיים?', _evaluate('8'), {},
     ('source', 'SOURCE_NOTATION')),
    ('time-03', 'ג19', 'ענו.', 'השעה עכשיו [[7]]:[[30]]. בעוד [[45]] דקות השעה תהיה ___.', _evaluate('8'), {},
     ('source', 'SOURCE_NOTATION')),
    ('word_problems-04', 'ג08', 'פתרו את הבעיה.',
     'לדני היו [[124]] גולות ולרון [[98]]. לאיזה ילד יש יותר גולות, ובכמה?', _evaluate('124 - 98', 'גולות'), {},
     ('source', 'PRINTED_ANSWER_KIND')),
    ('word_problems-04', 'ג08', 'פתרו את הבעיה.',
     'לדני היו [[124]] גולות ולרון [[98]]. כתבו מי מהם קיבל יותר גולות, ובכמה.', _evaluate('124 - 98', 'גולות'), {},
     ('source', 'PRINTED_ANSWER_KIND')),
    ('word_problems-04', 'ג08', 'פתרו את הבעיה.',
     'לדני היו [[124]] גולות ולרון [[98]]. אצל איזה ילד יש יותר גולות, ובכמה?', _evaluate('124 - 98', 'גולות'), {},
     ('source', 'PRINTED_ANSWER_KIND')),
    ('inequalities-03', 'g8:inequalities', 'פתרו את אי־השוויון.', '[[-3 < 2x + 1 ≤ 7]]',
     _inequality('2x + 1', '7', 'le'), {}, ('source', 'PRINTED_TASK_MISMATCH')),
    ('inequalities-03', 'g8:inequalities', 'פתרו את אי־השוויון.', '[[7 >= 2x + 1 > -3]]',
     _inequality('2x + 1', '7', 'le'), {}, ('source', 'PRINTED_TASK_MISMATCH')),
    ('inequalities-03', 'g8:inequalities', 'פתרו את אי־השוויון.', '[[-3 < 2x + 1]] וגם [[2x + 1 <= 7]]',
     _inequality('2x + 1', '7', 'le'), {}, ('source', 'PRINTED_TASK_MISMATCH')),
    # A typed task printed after a bare instruction: its tree would print a zero that was never written.
    ('powers_roots-08', 'g7:powers_roots', 'חשבו.', 'חשבו את הביטוי.', _evaluate('-2^4'), {},
     ('adapter', 'SOURCE_NOTATION')),
    ('powers_roots-08', 'g7:powers_roots', 'חשבו.', 'מה התוצאה?', _evaluate('-2^4 + 20'), {},
     ('adapter', 'SOURCE_NOTATION')),
    ('powers_roots-08', 'g7:equations', 'פתרו.', 'פתרו את המשוואה.',
     _computed({'kind': 'solve', 'variable': 'x', 'lhs': '-x + 3', 'rhs': '5'}), {}, ('adapter', 'SOURCE_NOTATION')),
    ('powers_roots-08', 'g7:algebraic_expressions', 'פשטו.', 'פשטו את הביטוי.',
     _computed({'kind': 'simplify', 'expression': '-(x + 2) + 3*x'}), {}, ('adapter', 'SOURCE_NOTATION')),
    # Beside a table whose rows leave their results blank.
    ('data_tables_charts-13', 'ד07', 'השלימו את הטבלה.', 'חשבו את הביטוי שבשורה הראשונה.', _evaluate('10 + 2 * 3'),
     {'table': _BLANK_ROWS}, ('adapter', 'PRINTED_TASK_MISMATCH')),
    # A blank that no binder fills is refused when the reply is read, before the adapter.
    ('data_tables_charts-13', 'ד07', 'השלימו את הטבלה.', 'הערך החסר בטבלה הוא ___.', _evaluate('10 + 2 * 3'),
     {'table': _BLANK_ROWS}, ('source', 'PRINTED_TASK_MISMATCH')),
    # Another row's calculation under the name of this row: refused when the reply is read (table_row_task).
    ('data_tables_charts-13', 'ד07', 'השלימו את הטבלה.', 'חשבו את הביטוי שבשורה השנייה.', _evaluate('10 + 2 * 3'),
     {'table': _BLANK_ROWS}, ('source', 'PRINTED_TASK_MISMATCH')),
    # A story in one sentence.
    ('probability-04', 'g8:probability', 'חשבו את ההסתברות.', 'מה ההסתברות לקבל מספר זוגי בהטלת קובייה הוגנת, כאחוז?',
     _evaluate('3/6*100', '%'), {}, ('adapter', 'PRINTED_TASK_MISMATCH')),
    ('probability-04', 'g8:probability', 'חשבו את ההסתברות.', 'בהטלת קובייה הוגנת מה הסיכוי באחוזים לקבל מספר זוגי?',
     _evaluate('3/6*100', '%'), {}, ('adapter', 'PRINTED_TASK_MISMATCH')),
    ('probability-04', 'g8:probability', 'חשבו.', 'מהי ההסתברות לקבל מספר זוגי כשמטילים קובייה הוגנת אחת?',
     _evaluate('3/6'), {}, ('adapter', 'PRINTED_TASK_MISMATCH')),
)


@unittest.skipUnless(ADAPTER_READY, 'The trusted adapter needs the engine runtime packages')
class RewordedFormTests(unittest.TestCase):
    """Each refused probe form is refused by its form, not by the corpus wording: rewordings are refused too."""

    def test_every_rewording_of_a_refused_form_is_refused(self):
        forms = {row[0] for row in REWORDED}
        self.assertEqual(len(forms), 14)
        self.assertTrue(all(sum(row[0] == form for row in REWORDED) >= 2 for form in forms))
        probes = [{'id': f'reworded-{n:02d}', 'topic': topic, 'intro': intro, 'prompt': prompt, 'answer': answer, **extra}
                  for n, (_, topic, intro, prompt, answer, extra, _) in enumerate(REWORDED, 1)]
        scratch = tempfile.mkdtemp(prefix='bench-probes-reworded-')
        self.addCleanup(shutil.rmtree, scratch, ignore_errors=True)
        outcomes = run.run_probes(probes, Path(scratch) / 'work', skills=engine.skill_roots(scratch))
        for probe, row in zip(probes, REWORDED):
            with self.subTest(form=row[0], prompt=row[3]):
                self.assertEqual(outcomes[probe['id']],
                                 {'outcome': 'rejected', 'stage': row[6][0], 'code': row[6][1]})


_POWER_ROWS = {'head': ['ביטוי', 'ערך'], 'rows': [['[[2^3 + 1]]', '___'], ['[[3^2 - 4]]', '___']]}
_MARBLES = 'לדני היו [[124]] גולות ולרון [[98]]. '
_LESSON = 'השיעור התחיל בשעה [[7]]:[[30]] ונמשך [[45]] דקות. '
_NUMBERS = '[[354]], [[345]], [[435]]'

# Round 4 (print_refusals): every example of the review, then further rewordings of each request kind, through
# the real engine: (finding, topic, intro, prompt, answer, extra, outcome). A table item that names its row and
# types exactly that row's expression is printed; every other one is refused.
KEY_HOLES = (
    # A requested ratio or map scale, keyed by a comparison sign or a number.
    ('ratio', 'ו21', 'ענו.', 'בכיתה [[12]] בנים ו־[[18]] בנות. מהו היחס בין מספר הבנים למספר הבנות?',
     _compare('12', '18'), {}, ('source', 'PRINTED_ANSWER_KIND')),
    ('ratio', 'ו21', 'ענו.', 'בכיתה [[12]] בנים ו־[[18]] בנות. מהו יחס הבנים לבנות?', _compare('12', '18'), {},
     ('source', 'PRINTED_ANSWER_KIND')),
    ('ratio', 'ו21', 'ענו.', 'במפה [[1]] ס״מ מייצג [[500]] מטר. כתבו את קנה המידה של המפה.', _compare('1', '500'), {},
     ('source', 'PRINTED_ANSWER_KIND')),
    ('ratio', 'ו21', 'ענו.', 'הבנים הם [[12]] והבנות [[18]], ויחס הבנים לבנות הוא ___.', _evaluate('12 / 18'), {},
     ('source', 'PRINTED_ANSWER_KIND')),
    ('ratio', 'ו21', 'ענו.', 'במפה [[1]] ס״מ מייצג [[500]] מטר. רשמו את קנה המידה.', _evaluate('500'), {},
     ('source', 'PRINTED_ANSWER_KIND')),
    ('ratio', 'ו21', 'ענו.', 'בכיתה [[12]] בנים, ויחס הבנים לבנות הוא ___.', _evaluate('12 / 18'), {},
     ('source', 'PRINTED_ANSWER_KIND')),
    # Beside a table: the row an item names, and exactly that row's printed expression.
    ('table', 'ד07', 'השלימו את הטבלה.', 'מהי תוצאת הביטוי שבשורה השנייה?', _evaluate('10 + 2 * 3'),
     {'table': _BLANK_ROWS}, ('source', 'PRINTED_TASK_MISMATCH')),
    ('table', 'ד07', 'השלימו את הטבלה.', 'מה הערך החסר בשורה הראשונה?', _evaluate('8 + 12 / 4'),
     {'table': _BLANK_ROWS}, ('source', 'PRINTED_TASK_MISMATCH')),
    ('table', 'ד07', 'השלימו את הטבלה.', 'מה התוצאה בשורה השנייה?', _evaluate('10 + 2'),
     {'table': _BLANK_ROWS}, ('source', 'PRINTED_TASK_MISMATCH')),
    ('table', 'g7:powers_roots', 'השלימו את הטבלה.', 'מהו ערך הביטוי בשורה השנייה?', _evaluate('2^3 + 1'),
     {'table': _POWER_ROWS}, ('source', 'PRINTED_TASK_MISMATCH')),
    ('table', 'ד07', 'השלימו את הטבלה.', 'מה הערך בשורה האחרונה?', _evaluate('10 + 2 * 3'),
     {'table': _BLANK_ROWS}, ('source', 'PRINTED_TASK_MISMATCH')),
    ('table', 'ד07', 'השלימו את הטבלה.', 'מה התוצאה בשורה מספר [[2]]?', _evaluate('10 + 2 * 3'),
     {'table': _BLANK_ROWS}, ('source', 'PRINTED_TASK_MISMATCH')),
    ('table', 'ד07', 'השלימו את הטבלה.', 'מה ההפרש בין השורה הראשונה לשורה השנייה?', _evaluate('18 - 16'),
     {'table': _BLANK_ROWS}, ('source', 'PRINTED_TASK_MISMATCH')),
    ('table', 'ד07', 'השלימו את הטבלה.', 'כמה ביחד?', _evaluate('16 + 18'),
     {'table': _BLANK_ROWS}, ('source', 'PRINTED_TASK_MISMATCH')),
    ('table', 'ד07', 'השלימו את הטבלה.', 'מהי תוצאת הביטוי שבשורה השנייה?', _evaluate('5 * 4 - 2'),
     {'table': _BLANK_ROWS}, ('pass', 'מהי תוצאת הביטוי שבשורה השנייה?', '18')),
    ('table', 'ד07', 'השלימו את הטבלה.', 'מה הערך בשורה האחרונה?', _evaluate('8 + 12 / 4'),
     {'table': _BLANK_ROWS}, ('pass', 'מה הערך בשורה האחרונה?', '11')),
    # A time of day.
    ('clock', 'ג19', 'ענו.', _LESSON + 'כתבו את שעת הסיום.', _evaluate('8'), {}, ('source', 'SOURCE_NOTATION')),
    ('clock', 'ג19', 'ענו.', _LESSON + 'מה תהיה שעת הסיום?', _evaluate('8'), {}, ('source', 'SOURCE_NOTATION')),
    ('clock', 'ג19', 'ענו.', _LESSON + 'כתבו מתי הסתיים השיעור.', _evaluate('8'), {}, ('source', 'SOURCE_NOTATION')),
    ('clock', 'ג19', 'ענו.', 'השעה עכשיו 7:30. בעוד [[45]] דקות יצלצל הפעמון. הפעמון יצלצל ב־___.', _evaluate('8'), {},
     ('source', 'SOURCE_NOTATION')),
    ('clock', 'ג19', 'ענו.', 'השיעור התחיל בשעה שמונה ונמשך [[45]] דקות. רשמו את שעת הסיום.', _evaluate('8'), {},
     ('source', 'PRINTED_ANSWER_KIND')),
    ('clock', 'ג19', 'ענו.', 'השיעור התחיל בשמונה ונמשך [[45]] דקות. ציינו מתי נגמר השיעור.', _evaluate('8'), {},
     ('source', 'PRINTED_ANSWER_KIND')),
    ('clock', 'ג19', 'ענו.', 'השיעור התחיל בשמונה ונמשך [[45]] דקות. מתי הסתיים השיעור', _evaluate('8'), {},
     ('source', 'PRINTED_ANSWER_KIND')),
    ('clock', 'ג19', 'ענו.', 'הסרט התחיל בשעה שמונה ונמשך [[90]] דקות. הסרט נגמר בשעה ___.', _evaluate('9'), {},
     ('source', 'PRINTED_ANSWER_KIND')),
    ('clock', 'ג19', 'ענו.', 'הסרט התחיל בשעה שמונה ונמשך [[90]] דקות. הסרט נגמר ב־___.', _evaluate('9'), {},
     ('source', 'PRINTED_ANSWER_KIND')),
    ('clock', 'ג19', 'ענו.', 'הסרט התחיל בשמונה ונמשך [[90]] דקות. הסרט נגמר ב־___ בערב.', _evaluate('9'), {},
     ('source', 'PRINTED_ANSWER_KIND')),
    # Who.
    ('who', 'ג08', 'פתרו את הבעיה.', _MARBLES + 'מיהו הילד שיש לו יותר גולות, ובכמה?', _evaluate('124 - 98', 'גולות'),
     {}, ('source', 'PRINTED_ANSWER_KIND')),
    ('who', 'ג08', 'פתרו את הבעיה.', _MARBLES + 'ציינו את שם הילד שיש לו יותר גולות ובכמה.',
     _evaluate('124 - 98', 'גולות'), {}, ('source', 'PRINTED_ANSWER_KIND')),
    ('who', 'ג08', 'פתרו את הבעיה.', 'לדנה היו [[124]] גולות ולרונית [[98]]. מיהי הילדה שיש לה יותר גולות, ובכמה?',
     _evaluate('124 - 98', 'גולות'), {}, ('source', 'PRINTED_ANSWER_KIND')),
    ('who', 'ג08', 'פתרו את הבעיה.', _MARBLES + 'כתבו את שמו של הילד שיש לו יותר גולות ובכמה.',
     _evaluate('124 - 98', 'גולות'), {}, ('source', 'PRINTED_ANSWER_KIND')),
    ('who', 'ג08', 'פתרו את הבעיה.', _MARBLES + 'מיהם הילדים שיש להם יותר מ־[[100]] גולות?',
     _evaluate('124 - 98', 'גולות'), {}, ('source', 'PRINTED_ANSWER_KIND')),
    ('who', 'ג08', 'פתרו את הבעיה.', _MARBLES + 'מי הילד שיש לו יותר גולות ובכמה.', _evaluate('124 - 98', 'גולות'),
     {}, ('source', 'PRINTED_ANSWER_KIND')),
    # True or false, and yes or no.
    ('truth', 'ג10', 'קבעו נכון או לא נכון.', '[[32 : 4 = 9]] ___', _compare('32 / 4', '9'), {},
     ('source', 'SOURCE_NOTATION')),
    ('truth', 'ג10', 'הקיפו את התרגילים הנכונים.', '[[32 : 4 = 9]]', _compare('32 / 4', '9'), {},
     ('source', 'PRINTED_ANSWER_KIND')),
    ('truth', 'ג10', 'סמנו ✓ ליד כל תרגיל נכון ו־✗ ליד כל תרגיל שגוי.', '[[32 : 4 = 9]]', _compare('32 / 4', '9'), {},
     ('source', 'PRINTED_ANSWER_KIND')),
    ('truth', 'ג02', 'ענו כן או לא.', '[[345 < 354]]', _compare('345', '354'), {}, ('source', 'PRINTED_ANSWER_KIND')),
    ('truth', 'ג10', 'מתחו קו מתחת לתרגילים השגויים.', '[[32 : 4 = 9]]', _compare('32 / 4', '9'), {},
     ('source', 'PRINTED_ANSWER_KIND')),
    ('truth', 'ג10', 'ציינו ליד כל תרגיל אם הוא נכון.', '[[32 : 4 = 9]]', _compare('32 / 4', '9'), {},
     ('source', 'PRINTED_ANSWER_KIND')),
    ('truth', 'ג02', 'ענו.', '[[345 < 354]] (כן/לא)', _compare('345', '354'), {}, ('source', 'PRINTED_ANSWER_KIND')),
    ('truth', 'ג10', 'הקיפו את התרגילים הנכונים.', 'חשבו: [[32 : 4]]', _evaluate('32 / 4'), {},
     ('source', 'PRINTED_ANSWER_KIND')),
    ('truth', 'ג02', 'ענו כן או לא.', '[[345]] גדול מ־[[354]].', _compare('345', '354'), {},
     ('source', 'PRINTED_ANSWER_KIND')),
    ('truth', 'g7:equations', 'קבעו נכון או לא נכון.', '[[2x + 3 = 9]] כאשר [[x = 3]] ___', _evaluate('2*3 + 3'), {},
     ('source', 'PRINTED_ANSWER_KIND')),
    # An order of several numbers.
    ('order', 'ג02', 'ענו.', f'רשמו את המספרים מהקטן ביותר לגדול ביותר: {_NUMBERS}.', _evaluate('345'), {},
     ('source', 'PRINTED_ANSWER_KIND')),
    ('order', 'ג02', 'ענו.', f'כתבו את המספרים {_NUMBERS} מהגדול אל הקטן.', _evaluate('435'), {},
     ('source', 'PRINTED_ANSWER_KIND')),
    ('order', 'ג02', 'ענו.', f'רשמו את המספרים {_NUMBERS} מן הקטן אל הגדול.', _evaluate('345'), {},
     ('source', 'PRINTED_ANSWER_KIND')),
    ('order', 'ג02', 'ענו.', f'מיינו את המספרים {_NUMBERS} מהקטן לגדול.', _evaluate('345'), {},
     ('source', 'PRINTED_ANSWER_KIND')),
    ('order', 'ג02', 'ענו.', f'כתבו את המספרים {_NUMBERS} לפי הסדר, מהקטן עד הגדול.', _evaluate('345'), {},
     ('source', 'PRINTED_ANSWER_KIND')),
)


@unittest.skipUnless(ADAPTER_READY, 'The trusted adapter needs the engine runtime packages')
class KeyHoleTests(unittest.TestCase):
    """Each example of the round 4 print refusals, and further rewordings, is refused; a table row bound exactly prints."""

    def test_every_example_and_rewording_is_refused_and_only_the_bound_row_prints(self):
        kinds = {row[0] for row in KEY_HOLES}
        self.assertEqual(kinds, {'ratio', 'table', 'clock', 'who', 'truth', 'order'})
        self.assertTrue(all(sum(row[0] == kind for row in KEY_HOLES) >= 4 for kind in kinds))
        probes = [{'id': f'key-hole-{n:02d}', 'topic': topic, 'intro': intro, 'prompt': prompt, 'answer': answer, **extra}
                  for n, (_, topic, intro, prompt, answer, extra, _) in enumerate(KEY_HOLES, 1)]
        scratch = tempfile.mkdtemp(prefix='bench-probes-key-holes-')
        self.addCleanup(shutil.rmtree, scratch, ignore_errors=True)
        outcomes = run.run_probes(probes, Path(scratch) / 'work', skills=engine.skill_roots(scratch))
        for probe, row in zip(probes, KEY_HOLES):
            with self.subTest(kind=row[0], prompt=row[3]):
                if row[6][0] == 'pass':
                    self.assertEqual(outcomes[probe['id']], {'outcome': 'pass', 'printed': row[6][1], 'key': row[6][2]})
                else:
                    self.assertEqual(outcomes[probe['id']],
                                     {'outcome': 'rejected', 'stage': row[6][0], 'code': row[6][1]})


class UpdateTests(unittest.TestCase):
    """The runner on a synthetic engine outcome: a wrong print is never recorded and always blocks."""

    def setUp(self):
        self.scratch = Path(tempfile.mkdtemp(prefix='bench-probes-update-'))
        self.addCleanup(shutil.rmtree, self.scratch, ignore_errors=True)
        _, document = run.load()[0]
        self.family, self.probe = document['family'], document['probes'][0]
        self.corpus = self.scratch / 'corpus'
        self.corpus.mkdir()
        self.argv = ['--corpus', str(self.corpus), '--work', str(self.scratch / 'work')]
        self.wrong = {'outcome': 'wrong_print', 'flags': ['key_mismatch'], 'notes': ['synthetic'],
                      'printed': 'a', 'key': '1'}
        self.rejected = {'outcome': 'rejected', 'stage': 'source', 'code': 'SOURCE_NOTATION'}

    def record(self, recorded):
        (self.corpus / f'{self.family}.json').write_text(
            json.dumps({'family': self.family, 'probes': [{**self.probe, 'recorded': recorded}]}, ensure_ascii=False),
            encoding='utf-8')

    def kept(self):
        return json.loads((self.corpus / f'{self.family}.json').read_text(encoding='utf-8'))['probes'][0]['recorded']

    def main(self, now, extra=()):
        with mock.patch.object(run, 'run_probes', return_value={self.probe['id']: now}) as engine_run, \
                contextlib.redirect_stdout(io.StringIO()) as output:
            status = run.main(self.argv + list(extra))
        engine_run.assert_called_once()
        return status, output.getvalue()

    def test_a_wrong_print_blocks_and_is_never_recorded(self):
        for recorded in (self.rejected, self.wrong):
            with self.subTest(recorded=recorded['outcome']):
                # A new wrong print, and one that the corpus already holds: both block.
                self.record(recorded)
                status, output = self.main(self.wrong)
                self.assertEqual(status, 1)
                self.assertIn('WRONG PRINT', output)
                status, output = self.main(self.wrong, ['--update'])
                self.assertEqual(status, 1)
                self.assertIn('Not recorded', output)
                self.assertEqual(self.kept(), recorded)

    def test_no_option_records_a_wrong_print(self):
        self.record(self.rejected)
        with mock.patch.object(run, 'run_probes', return_value={self.probe['id']: self.wrong}), \
                contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()), \
                self.assertRaises(SystemExit) as refused:
            run.main(self.argv + ['--update', '--accept-new-wrong-prints'])
        self.assertEqual(refused.exception.code, 2)
        self.assertEqual(self.kept(), self.rejected)

    def test_an_unchanged_refusal_records_cleanly(self):
        self.record(self.rejected)
        self.assertEqual(self.main(self.rejected)[0], 0)
        self.assertEqual(self.main(self.rejected, ['--update'])[0], 0)
        self.assertEqual(self.kept(), self.rejected)


if __name__ == '__main__':
    unittest.main()
