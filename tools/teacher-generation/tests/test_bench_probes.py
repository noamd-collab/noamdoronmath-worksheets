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
