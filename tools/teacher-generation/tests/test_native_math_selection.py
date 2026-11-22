"""Provider-choice regressions use synthetic responses and never access the network."""
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
import counting_lesson
import native_math_selection as selection
import provider
import remote_worker
from cloud.container.skill_bundle import install
from validation import GenerationError, validate_model


class NativeSelectionTests(unittest.TestCase):
    cases = ('grade1-counting', 'grade3-division-curriculum', 'grade5-unlike-fractions',
             'grade8-pythagoras', 'grade9-square', 'grade9-special-right-triangle')

    @classmethod
    def setUpClass(cls):
        temporary = tempfile.TemporaryDirectory()
        cls.addClassCleanup(temporary.cleanup)
        skills = Path(temporary.name) / 'skills'
        install(HERE / 'cloud/container/skills', skills, HERE / 'skill-lock.json')
        cls.env = {'ELEMENTARY_SKILL_PATH': str(skills/'elementary'), 'MIDDLE_SKILL_PATH': str(skills/'middle')}
        cls.config = {'api_key': 'offline-fixture',
                      'base_url': 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1', 'model': 'synthetic'}

    def lesson(self, case):
        return json.loads((HERE / 'cloud/container/fixtures/general' / case / 'lesson.json').read_text())

    def test_teacher_worker_uses_one_bounded_call_and_replays_actual_mathematical_choices(self):
        for case in self.cases:
            lesson = self.lesson(case)
            results = []
            for pick_last in (False, True):
                def fake(target, key, body, measured, timeout):
                    user = json.loads(body['messages'][1]['content'])
                    self.assertEqual(user['teacherStoppingPoint'], lesson['lastLesson'])
                    self.assertEqual(user['authoringContext']['skill']['skillId'],
                                     'middle' if lesson['gradeNumber'] >= 7 else 'elementary')
                    options = user['mathematicalOptions']
                    self.assertNotIn('seed', json.dumps(options))
                    self.assertEqual(len(user['sourceSchema']['anyOf']), 2)
                    positions = options.get('questions') or [options['profiles']]
                    return {'version': selection.CONTRACT,
                            'choices': [len(opts) if pick_last else 1 for opts in positions]}
                metadata = {}
                with self.subTest(case=case, pick_last=pick_last), patch.dict(os.environ, self.env), \
                        patch('native_math_selection.secrets.randbits', return_value=4), \
                        patch('provider.request_author_json', side_effect=fake) as request:
                    source = remote_worker.author_lesson(lesson, metadata=metadata, **self.config)
                    request.assert_called_once()
                    self.assertTrue(metadata['providerCalled'])
                    self.assertTrue(metadata['validated'])
                    self.assertEqual(metadata['authorContract'], selection.CONTRACT)
                    validate_model(lesson, source)
                    # Reproduce the visible mathematical data independently from the saved native source.
                    author = next(a for a in selection.AUTHORS if a.VERSION == source['version'])
                    if author in selection.GEOMETRY:
                        _, questions, _ = author.build(lesson, source)
                        shown = [q['intro'] for q in questions]
                        self.assertEqual(shown, [q['intro'] for q in author.build(lesson, source)[1]])
                    else:
                        score, shown = selection.profile(lesson, author, source['seed'])
                        self.assertEqual(selection.profile(lesson, author, source['seed']), (score, shown))
                    results.append(shown)
            self.assertNotEqual(results[0], results[1], case)

    def test_two_teacher_goals_can_select_distinct_visible_counting_ranges(self):
        lesson = self.lesson('grade1-counting')
        signatures = {}
        for goal in ('practice', 'review'):
            job = dict(lesson, lessonGoal=goal)
            def choose(target, key, body, measured, timeout):
                user = json.loads(body['messages'][1]['content'])
                profiles = user['mathematicalOptions']['profiles']
                counts = [profile['itemsCountingSevenOrMore'] for profile in profiles]
                teacher_goal = user['authoringContext']['teacherContext']['lessonGoal']
                selected = min(counts) if teacher_goal == 'practice' else max(counts)
                return {'version': selection.CONTRACT, 'choices': [1 + counts.index(selected)]}
            with patch.dict(os.environ, self.env), patch('native_math_selection.secrets.randbits', return_value=4), \
                    patch('provider.request_author_json', side_effect=choose):
                result = provider.author_lesson(job, **self.config)
            _, printed = counting_lesson.build(job, result)
            signatures[goal] = sum(count >= 7 for count in printed.values())
        self.assertGreaterEqual(signatures['review'] - signatures['practice'], 3)

    def test_unoffered_choices_never_substitute_a_local_author(self):
        lesson = self.lesson('grade1-counting')
        for reply in ({'version': selection.CONTRACT, 'choices': [3]},
                      {'version': selection.CONTRACT, 'choices': [True]},
                      {'version': selection.CONTRACT, 'choices': []},
                      {'version': counting_lesson.VERSION, 'seed': 10}):
            with self.subTest(reply=reply), patch.dict(os.environ, self.env), \
                    patch('native_math_selection.secrets.randbits', return_value=4), \
                    patch('provider.request_author_json', return_value=reply) as request, \
                    self.assertRaises(GenerationError):
                provider.author_lesson(lesson, **self.config)
            request.assert_called_once()

    def test_full_source_works_in_same_call_for_unsuitable_or_undifferentiated_profiles(self):
        lesson = self.lesson('grade1-counting')
        full_source, _ = counting_lesson.build(lesson, {'version': counting_lesson.VERSION, 'seed': 10})
        for available in (True, False):
            with self.subTest(available=available), patch.dict(os.environ, self.env), \
                    patch('native_math_selection.secrets.randbits', return_value=4), \
                    patch('provider.request_author_json', return_value=full_source) as request:
                if available:
                    result = provider.author_lesson(lesson, **self.config)
                else:
                    with patch('native_math_selection.profile', return_value=(1, {})):
                        result = provider.author_lesson(lesson, **self.config)
                self.assertEqual(result['version'], 4)
                user = json.loads(request.call_args.args[2]['messages'][1]['content'])
                self.assertEqual('mathematicalOptions' in user, available)
                request.assert_called_once()
                validate_model(lesson, result)


if __name__ == '__main__':
    unittest.main()
