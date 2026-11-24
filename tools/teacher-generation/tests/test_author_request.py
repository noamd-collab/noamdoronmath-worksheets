"""The author request: its layout, parallel parts, the duplicate filter, the deadline and opening sheets.

Every end-to-end test runs `remote_worker.process_job` through bench/engine
with recorded replies (bench/corpus), a scripted transport and no network.
The author stage, the selection and the correction request are the real ones;
the render is a stand-in that validates the sheet it is given.
"""
from __future__ import annotations

import copy
import hashlib
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
from bench import engine  # noqa: E402
import author_request  # noqa: E402
import provider  # noqa: E402
import remote_worker  # noqa: E402
from lesson_select import Selection, minimum_count  # noqa: E402
from runtime_catalog import scope_for_lesson  # noqa: E402
from skill_authoring import planned_count, question_plan, reserve_plan, worksheet_schema  # noqa: E402
from validation import GenerationError, validate_model  # noqa: E402

CORPUS = HERE / 'bench/corpus'


def corpus(path):
    return json.loads((CORPUS / path).read_text(encoding='utf-8'))


class PartScript:
    """A transport for parallel parts: each author part is answered from a script keyed by its part number.

    ``parts`` maps a part number to a whole recorded reply (the part receives
    its own rows of it, engine.cut_reply) or to an exception. A correction
    request is answered by ``fix(keys)`` when given; any other request takes
    the next entry of ``others``. Each call, or each wave of parts, moves a
    VirtualClock by the next scripted duration.
    """

    def __init__(self, parts, others=(), clock=None, seconds=None, fix=None):
        self.parts, self.others, self.clock, self.seconds = parts, list(others), clock, list(seconds or [])
        self.fix = fix
        self.bodies, self.calls, self._lock = [], [], threading.Lock()
        self._wave = None

    def __call__(self, target, key, body, metadata, timeout):
        part = engine.part_of(body)
        with self._lock:
            self.bodies.append(body)
            self.calls.append({'part': part['part'] if part else None, **engine.describe_call(body),
                               'at': self.clock.now() if self.clock else None})
            fresh = part is None or self._wave is None or part['part'] in self._wave
            if fresh and self.clock is not None:
                # One duration per author attempt or call; all parts of an attempt share it.
                self.clock.advance(self.seconds.pop(0) if self.seconds else 0.0)
            if part is not None:
                self._wave = ({part['part']} if fresh else self._wave | {part['part']})
            keys = body['response_format']['json_schema']['schema']['required']
            if part is not None:
                reply = self.parts.get(part['part'])
            elif self.fix is not None and self.calls[-1]['schema'] == 'revise_skill_questions':
                reply = self.fix(keys)
            else:
                reply = self.others.pop(0) if self.others else GenerationError('PROVIDER_UNAVAILABLE', 'nothing scripted')
        if isinstance(reply, Exception):
            raise reply
        if isinstance(metadata, dict):
            metadata.update(responseReceived=True, usage={'completion_tokens': 10}, elapsedSeconds=0.0)
        return engine.cut_reply(reply, part) if part is not None else copy.deepcopy(reply)


def waves(calls):
    """The part numbers of each author attempt, sorted: the parts of one attempt run at the same time."""
    numbers = [call['part'] for call in calls if call['part']]
    return [sorted(numbers[i:i + 3]) for i in range(0, len(numbers), 3)]


def donor(question):
    """A correction that writes a copy of one good recorded question at every key it is asked for."""
    return lambda keys: {key: copy.deepcopy(question) for key in keys if key.startswith('q')}


class Base(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.scratch = tempfile.mkdtemp(prefix='author-request-test-')
        cls.skills = engine.skill_roots(cls.scratch)

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.scratch, ignore_errors=True)

    def stand_in_render(self, lesson, payload, target, **kwargs):
        validate_model(lesson, payload, salvaged_from=kwargs.get('salvaged_from'))
        target.mkdir(parents=True, exist_ok=True)
        artifacts = []
        for kind in ('pdf', 'docx'):
            blob = ('stand-in ' + kind).encode()
            (target / ('sheet.' + kind)).write_bytes(blob)
            artifacts.append({'kind': kind, 'path': 'sheet.' + kind, 'sha256': hashlib.sha256(blob).hexdigest(),
                              'bytes': len(blob)})
        return {'status': 'needs_review', 'automatedChecksPassed': True, 'renderingChecksPassed': True,
                'authoringProfile': 'general-skill-source/v1',
                'skill': {'name': 'middle', 'version': 'pinned', 'sha256': 'a' * 64},
                'steps': [{'name': 'stand-in-render', 'status': 'PASS'}], 'artifacts': artifacts,
                'reviewFindings': [], 'unverifiedAnswers': []}

    def run_job(self, lesson, transport, *, slices=None, clock=None, render=None):
        """One job through the worker. Returns (outcome, the sheets handed to the render)."""
        sheets = []

        def rendering(job_lesson, payload, target, **kwargs):
            sheets.append({'count': job_lesson['questionCount'], 'payload': payload,
                           'salvagedFrom': kwargs.get('salvaged_from')})
            return (render or self.stand_in_render)(job_lesson, payload, target, **kwargs)

        work = Path(tempfile.mkdtemp(prefix='job-', dir=self.scratch))
        with engine.engine_environment(self.skills, slices=slices), engine.network_guard() as refused, \
                patch.object(remote_worker, 'render_job', rendering), \
                patch.object(remote_worker, 'precheck_job', lambda *a, **k: {'status': 'not_applicable'}):
            outcome = engine.run_job(lesson, transport, work, seed=work.name, clock=clock)
        self.assertEqual(refused, [])
        return outcome, sheets

    def capture(self, lesson, slices=1):
        """The bodies the general author sends for a lesson, captured before any network use."""
        import general_provider
        bodies = []

        class Stop(Exception):
            pass

        def take(target, key, body, metadata, timeout):
            bodies.append(body)
            raise Stop()

        with engine.engine_environment(self.skills, slices=slices), patch.object(provider, 'request_author_json', take):
            with self.assertRaises(Stop):
                general_provider.author_general_lesson(lesson, metadata={}, timeout=1,
                                                       skill_paths={k: str(v) for k, v in self.skills.items()})
        return bodies


# ---------------------------------------------------------------------------- layout

class LayoutTests(Base):
    def test_skill_documents_open_the_system_message_as_a_byte_stable_prefix(self):
        practice = corpus('lessons/g4-order-practice.json')
        opening = corpus('lessons/L1-g3-division.json')                  # another grade, topic, goal and count
        first, second = self.capture(practice)[0], self.capture(opening)[0]
        prefixes = []
        for body, lesson in ((first, practice), (second, opening)):
            system, user = body['messages'][0]['content'], body['messages'][1]['content']
            end = system.rfind('</document>') + len('</document>')
            self.assertTrue(system.startswith('Pinned worksheet skill elementary '))
            self.assertGreater(end, 50_000)
            prefixes.append(system[:end])
            # The documents travel once: never again in the user data, which names them only.
            data = json.loads(user)
            self.assertNotIn('text', json.dumps(data['authoringContext']['skill']))
            self.assertIn('SKILL.md', data['authoringContext']['skill']['documents'])
            self.assertNotIn(lesson['lastLesson'], system[:end])
            sizes = author_request.request_parts(body)
            self.assertEqual(sizes['system.documents'], end)
            self.assertEqual(sizes['total'], len(system) + len(user))
        self.assertEqual(prefixes[0], prefixes[1])
        # The middle skill: grades 8 and 9 share every byte of their documents.
        rhombus = self.capture(corpus('lessons/L1-g9r-rhombus-a.json'))[0]['messages'][0]['content']
        percent = self.capture(corpus('lessons/L1-g8-percentages.json'))[0]['messages'][0]['content']
        self.assertEqual(rhombus[:rhombus.rfind('</document>')], percent[:percent.rfind('</document>')])

    def test_the_author_copy_of_the_context_keeps_chronology_and_tools_and_drops_provenance(self):
        from authoring_context import build_authoring_context
        from runtime_catalog import catalog
        lesson = corpus('lessons/L1-g9r-rhombus-a.json')
        context = build_authoring_context(catalog(), lesson, {k: str(v) for k, v in self.skills.items()})
        trimmed = author_request.trim_context(context)
        before, after = context['sourceContext'], trimmed['sourceContext']
        for key in ('earlierTopics', 'currentTopic', 'laterTopics', 'previouslyEligibleTools', 'notYetAllowedTools',
                    'currentTopicToolsRequiringSelection', 'trackExclusions'):
            self.assertEqual(after[key], before[key], key)
        for key in ('forbiddenTerms', 'symbols', 'houseSpelling'):
            self.assertEqual(after['glossary'][key], before['glossary'][key], key)
        self.assertEqual([row['preferred'] for row in after['glossary']['notYetAllowedTerms']],
                         [row['preferred'] for row in before['glossary']['notYetAllowedTerms']])
        self.assertTrue(all({'grade', 'track'} <= set(row['allowedFrom']) for row in after['glossary']['notYetAllowedTerms']))
        terms = [row for name in ('previouslyEligibleTerms', 'notYetAllowedTerms') for row in after['glossary'][name]]
        self.assertTrue(terms and all(set(row) <= {'id', 'preferred', 'allowedFrom'} for row in terms))
        self.assertTrue(all('note' not in row.get('allowedFrom', {}) for row in terms))
        self.assertNotIn('sources', after)
        self.assertNotIn('files', trimmed['scope']['source'])
        self.assertEqual(trimmed['scope']['selectedConcepts'], context['scope']['selectedConcepts'])
        self.assertLess(len(json.dumps(after, ensure_ascii=False)), 0.75 * len(json.dumps(before, ensure_ascii=False)))


# ---------------------------------------------------------------------------- parts

class PartsTests(Base):
    def test_parallel_parts_reserve_output_budget_for_their_own_questions(self):
        lesson = corpus('lessons/L1-g9r-rhombus-a.json')
        scope = scope_for_lesson(lesson)
        pieces = author_request.slice_plan(question_plan(lesson, scope), reserve_plan(lesson, scope), 3)
        limits = [author_request.part_output_limit(part) for part in pieces]
        self.assertEqual(len(limits), 3)
        self.assertLess(sum(limits), 40000)
        self.assertTrue(all(limit >= 8000 for limit in limits))

    def test_the_part_setting_and_count(self):
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop(author_request.SLICES_ENV, None)
            self.assertEqual((author_request.slice_setting('gemini'), author_request.slice_setting('qwen')), ('auto', 1))
            for value, expected in (('1', 1), ('3', 3), ('auto', 'auto')):
                os.environ[author_request.SLICES_ENV] = value
                self.assertEqual(author_request.slice_setting('qwen'), expected)
            for value in ('5', '0', 'many', '-1'):
                os.environ[author_request.SLICES_ENV] = value
                with self.assertRaises(GenerationError) as error:
                    author_request.slice_setting('gemini')
                self.assertEqual(error.exception.code, 'PROVIDER_CONFIG_INVALID')
        self.assertEqual([author_request.slice_count('auto', q, r) for q, r in ((8, 3), (12, 3), (20, 4), (30, 5))],
                         [2, 2, 3, 4])
        self.assertEqual([author_request.slice_count(n, 20, 4) for n in (1, 2, 4)], [1, 2, 4])

    def test_the_plan_is_split_into_contiguous_parts_that_cover_every_row_once(self):
        lesson = corpus('lessons/L1-g9r-rhombus-a.json')
        scope = scope_for_lesson(lesson)
        plan, reserves = question_plan(lesson, scope), reserve_plan(lesson, scope)
        for parts in (2, 3, 4):
            pieces = author_request.slice_plan(plan, reserves, parts)
            self.assertEqual(len(pieces), parts)
            self.assertEqual([p['writesTitleAndRule'] for p in pieces], [True] + [False] * (parts - 1))
            numbers = [n for p in pieces for n in p['practiceQuestionNumbers'] + p['challengeQuestionNumbers']]
            self.assertEqual(numbers, list(range(1, 21)))
            self.assertEqual([n for p in pieces for n in p['reserveNumbers']], [1, 2, 3, 4])
            self.assertTrue(all(p['practiceQuestionNumbers'] or p['challengeQuestionNumbers'] for p in pieces))
            sizes = [1 * p['writesTitleAndRule'] + len(p['practiceQuestionNumbers']) + len(p['challengeQuestionNumbers'])
                     + len(p['reserveNumbers']) for p in pieces]
            self.assertLessEqual(max(sizes) - min(sizes), 1)

    def test_a_recorded_sheet_written_in_three_parts_joins_into_the_same_sheet(self):
        lesson, reply = corpus('lessons/L1-g9r-quad-eq-applications-a.json'), corpus('replies/L1-p2.json')
        single, sheets_one = self.run_job(lesson, engine.RecordedReplies(reply))
        transport = PartScript({1: reply, 2: reply, 3: reply})
        sliced, sheets_three = self.run_job(lesson, transport, slices=3)
        self.assertTrue(single['delivered'] and sliced['delivered'], (single['code'], sliced['code']))
        self.assertEqual(json.dumps(sheets_three[0]['payload'], sort_keys=True), json.dumps(sheets_one[0]['payload'], sort_keys=True))
        self.assertEqual(waves(transport.calls), [[1, 2, 3]])
        self.assertEqual(sliced['diagnostics']['authorSlices'], {'parts': 3, 'duplicates': 0})
        self.assertEqual(sliced['diagnostics']['usage'], {'completion_tokens': 30})       # summed over the parts
        # The parts share the system text and every user byte before their own slice; each schema asks for its rows.
        systems = {body['messages'][0]['content'] for body in transport.bodies if engine.part_of(body)}
        self.assertEqual(len(systems), 1)
        self.assertIn('This request is one part of a sheet', systems.pop())
        users = [body['messages'][1]['content'] for body in transport.bodies if engine.part_of(body)]
        heads = {user[:user.index('"slice"')] for user in users}
        self.assertEqual(len(heads), 1)
        asked = [sorted(body['response_format']['json_schema']['schema']['required']) for body in transport.bodies
                 if engine.part_of(body)]
        self.assertEqual(asked, [['practice', 'rule', 'title'], ['practice'], ['challenges', 'practice', 'reserves']])
        counts = [(json.loads(u)['slice']['practiceQuestionNumbers'], json.loads(u)['slice']['challengeQuestionNumbers'])
                  for u in users]
        self.assertEqual(counts, [(list(range(1, 8)), []), (list(range(8, 16)), []), ([16, 17], [18, 19, 20])])

    def test_a_question_that_repeats_another_parts_tasks_is_refused_and_takes_a_reserve(self):
        lesson, reply = corpus('lessons/gemini-g3-division.json'), copy.deepcopy(corpus('replies/G-division.json'))
        concept = lesson['lessonBoundary']['conceptIds'][0]
        spare = corpus('replies/L2-g3.json')
        reply['reserves'] = [{'group': 'practice', 'conceptId': concept, 'question': copy.deepcopy(q)}
                             for q in spare['practice'][:3]] + [{'group': 'challenges', 'conceptId': concept,
                                                                  'question': copy.deepcopy(spare['challenges'][0])}]
        # Question 10 asks 12/3 and 20/4 again: question 2 asked both, in the first part.
        repeated = reply['practice'][9]
        outcome, sheets = self.run_job(lesson, PartScript({1: reply, 2: reply, 3: reply}), slices=3)
        self.assertGreaterEqual(outcome['diagnostics']['authorSlices']['duplicates'], 1)
        events = [event for attempt in outcome['ladder']['attemptRecords'] for event in attempt['events']]
        refused = [event['question'] for event in events if event['codes'] == ['DUPLICATE_QUESTION']]
        self.assertIn(10, refused)
        for sheet in sheets:
            printed = sheet['payload']['sections'][0]['questions']
            self.assertNotIn(json.dumps(repeated['items'][0]['prompt'], ensure_ascii=False),
                             json.dumps([q['items'][0] for q in printed], ensure_ascii=False))
        # One call sees its own questions: nothing is compared within it.
        single, _ = self.run_job(lesson, engine.RecordedReplies(reply))
        events = [event for attempt in single['ladder']['attemptRecords'] for event in attempt['events']]
        self.assertFalse(any('DUPLICATE_QUESTION' in event['codes'] for event in events))

    def test_a_part_whose_reply_cannot_be_used_loses_only_its_rows(self):
        lesson, reply = corpus('lessons/L1-g9r-quad-eq-applications-a.json'), corpus('replies/L1-p2.json')
        defect = GenerationError('PROVIDER_INVALID_RESPONSE', 'not JSON')
        transport = PartScript({1: reply, 2: defect, 3: reply}, fix=donor(reply['practice'][0]))
        outcome, sheets = self.run_job(lesson, transport, slices=3)
        # Parts 1 and 3 stand; part 2's eight rows take reserves, then the ONE correction call asks for the rest.
        self.assertTrue(outcome['delivered'], outcome['code'])
        self.assertEqual([call['schema'] for call in transport.calls if call['part'] is None], ['revise_skill_questions'])
        asked = {int(key[1:]) for key in transport.calls[-1]['required']}
        self.assertGreaterEqual(len(asked & set(range(8, 16))), 4)                      # four reserves cannot fill eight
        self.assertEqual(outcome['ladder']['attempts'], 1)
        self.assertGreaterEqual(len(sheets[0]['payload']['sections'][0]['questions']), minimum_count(20))

    def test_a_part_with_no_reply_or_a_first_part_that_fails_ends_the_attempt_as_one_call_would(self):
        lesson, reply = corpus('lessons/L1-g9r-quad-eq-applications-a.json'), corpus('replies/L1-p2.json')
        silent = PartScript({1: reply, 2: GenerationError('PROVIDER_UNAVAILABLE', 'timed out'), 3: reply})
        outcome, sheets = self.run_job(lesson, silent, slices=3)
        # No reply: the job closes to further calls, exactly as when the one call does not answer.
        self.assertEqual((outcome['delivered'], outcome['code'], sheets), (False, 'PROVIDER_UNAVAILABLE', []))
        self.assertEqual(waves(silent.calls), [[1, 2, 3]])
        # The first part writes the title and the rule: its unusable reply is the attempt's, and one second attempt follows.
        broken = PartScript({1: GenerationError('PROVIDER_INVALID_RESPONSE', 'not JSON'), 2: reply, 3: reply})
        outcome, _ = self.run_job(lesson, broken, slices=3)
        self.assertEqual(waves(broken.calls), [[1, 2, 3], [1, 2, 3]])
        self.assertEqual((outcome['delivered'], outcome['code']), (False, 'PROVIDER_INVALID_RESPONSE'))


# ---------------------------------------------------------------------------- deadline

class DeadlineTests(Base):
    """Recorded durations on a virtual clock: when a correction or a second attempt may still start."""

    def failing_render(self, clock, seconds, fail_first):
        state = {'renders': 0}

        def render(lesson, payload, target, **kwargs):
            clock.advance(seconds)
            state['renders'] += 1
            if state['renders'] <= fail_first:
                # A gate that names no question: the ladder can only author again.
                return {'status': 'failed', 'gate': {'action': 'fail', 'blocking': [{'code': 'BUILD_PLUS'}]},
                        'steps': [{'name': 'gates', 'status': 'FAIL'}], 'skill': {'name': 'middle'}}
            return self.stand_in_render(lesson, payload, target, **kwargs)
        return render

    def clean(self, reply, lesson):
        """The recorded reply with each question refused alone replaced by a good one: no correction is needed."""
        from skill_authoring import question_codes
        scope = scope_for_lesson(lesson)
        clean = copy.deepcopy(reply)
        for group, star in (('practice', False), ('challenges', True)):
            good = next(q for q in clean[group] if not question_codes(q, lesson, scope, challenge=star))
            clean[group] = [q if not question_codes(q, lesson, scope, challenge=star) else copy.deepcopy(good)
                            for q in clean[group]]
        clean.pop('reserves', None)
        return clean

    def test_a_correction_after_a_late_second_attempt_fits_the_deadline(self):
        # The timeline of live round 2, g9r:quad_eq_applications: the first reply took 72.3 s, the
        # render failed on a check that names no question, and the second reply ended at 151.1 s.
        lesson, reply = corpus('lessons/L1-g9r-quad-eq-applications-a.json'), corpus('replies/L1-p2.json')
        first = self.clean(reply, lesson)
        second = copy.deepcopy(first)
        second['practice'][2]['intro'] = 'פתרו [[4 @ 2]].'                               # one question to correct
        for old_rule, expected in ((False, True), (True, False)):
            # The new deadline lets the correction restore the question; under the old rule the sheet loses it.
            clock = engine.VirtualClock()
            transport = PartScript({}, others=[first, second], clock=clock, seconds=[72.3, 61.8, 15.4],
                                   fix=donor(first['practice'][0]))
            render = self.failing_render(clock, 17.0, fail_first=1)
            if old_rule:
                # The rule this replaces: no call starts 150 s or more after the claim.
                with patch.object(remote_worker, 'MODEL_DEADLINE', 150), \
                        patch.object(remote_worker, 'AUTHOR_SECONDS', 0), patch.object(remote_worker, 'CORRECTION_SECONDS', 0):
                    outcome, sheets = self.run_job(lesson, transport, clock=clock, render=render)
            else:
                outcome, sheets = self.run_job(lesson, transport, clock=clock, render=render)
            names = [call['schema'] for call in transport.calls]
            self.assertEqual(names, ['skill_worksheet_content', 'skill_worksheet_content'] + ['revise_skill_questions'] * expected)
            self.assertAlmostEqual(transport.calls[1]['at'], 72.3 + 17.0)
            self.assertTrue(outcome['delivered'], outcome['code'])
            self.assertEqual(len(sheets[-1]['payload']['sections'][0]['questions']), 20 if expected else 19)
            self.assertEqual([row['code'] for row in outcome['result']['reviewFindings']], [] if expected else ['SHORTER_SHEET'])
            if expected:
                self.assertAlmostEqual(transport.calls[2]['at'], 72.3 + 17.0 + 61.8)     # 151.1 s

    def test_a_second_attempt_starts_only_when_one_correction_still_fits_after_it(self):
        lesson, reply = corpus('lessons/L1-g9r-quad-eq-applications-a.json'), corpus('replies/L1-p2.json')
        fix = donor(reply['practice'][0])
        # One call: author 74 s, correction 10 s, a failed render 32 s; at 116 s, 116 + 80 + 25 > 210.
        clock = engine.VirtualClock()
        transport = PartScript({}, others=[reply, reply], clock=clock, seconds=[74.0, 10.0], fix=fix)
        outcome, _ = self.run_job(lesson, transport, clock=clock, render=self.failing_render(clock, 32.0, fail_first=1))
        names = [call['schema'] for call in transport.calls]
        self.assertEqual(names, ['skill_worksheet_content', 'revise_skill_questions'])
        self.assertEqual((outcome['delivered'], outcome['code']), (False, 'QUALITY_GATE_FAILED'))
        # In parts the same moment leaves room: 116 + 45 + 25 <= 210, and the second attempt delivers.
        clock = engine.VirtualClock()
        transport = PartScript({1: reply, 2: reply, 3: reply}, clock=clock, seconds=[74.0, 10.0, 27.0, 10.0], fix=fix)
        outcome, _ = self.run_job(lesson, transport, slices=3, clock=clock,
                                  render=self.failing_render(clock, 32.0, fail_first=1))
        self.assertEqual(waves(transport.calls), [[1, 2, 3], [1, 2, 3]])
        self.assertAlmostEqual([call['at'] for call in transport.calls if call['part']][3], 116.0)
        self.assertTrue(outcome['delivered'], outcome['code'])
        self.assertEqual(remote_worker.MODEL_DEADLINE, 2 * (remote_worker.AUTHOR_SECONDS + remote_worker.CORRECTION_SECONDS))


# ---------------------------------------------------------------------------- opening sheets

class OpeningSheetTests(Base):
    def test_an_opening_sheet_is_planned_by_its_minutes_within_the_floors(self):
        base = corpus('lessons/L1-g7-equations.json')
        for goal, grade, minutes, count, expected in (
                ('introduce', 7, 30, 20, 15),       # 30 minutes hold 7 questions of 3 items: the floor of 20 is 15
                ('introduce', 7, 90, 20, 20),
                ('introduce', 7, 60, 24, 18),
                ('introduce', 3, 30, 12, 9),
                ('introduce', 1, 30, 8, 6),         # grades 1-2: five items a question
                ('practice', 7, 30, 20, 20),
                ('review', 3, 10, 12, 12)):
            lesson = {**base, 'lessonGoal': goal, 'gradeNumber': grade, 'minutes': minutes, 'questionCount': count}
            self.assertEqual(planned_count(lesson), expected, (goal, grade, minutes, count))
            self.assertGreaterEqual(planned_count(lesson), minimum_count(count))
        # Never more than requested: the floor of six questions is above a request of four or five.
        for count in (4, 5):
            lesson = {**base, 'lessonGoal': 'introduce', 'gradeNumber': 7, 'minutes': 30, 'questionCount': count}
            self.assertEqual(planned_count(lesson), count)
        # Every question of an opening sheet has exactly its minimum of items, whatever its minutes.
        lesson = {**base, 'minutes': 60}
        scope = scope_for_lesson(lesson)
        items = worksheet_schema(lesson, scope, count=15)['$defs']['question']['properties']['items']
        self.assertEqual((items['minItems'], items['maxItems']), (3, 3))
        practice = worksheet_schema({**lesson, 'lessonGoal': 'practice'}, scope)['$defs']['question']['properties']['items']
        self.assertGreater(practice['maxItems'], 3)
        self.assertEqual(len(question_plan(lesson, scope, count=15)), 15)

    def test_a_sheet_planned_shorter_keeps_the_requests_floor(self):
        planned = [{'group': 'practice', 'question': {'n': n}} for n in range(12)] + \
                  [{'group': 'challenges', 'question': {'n': n}} for n in range(12, 15)]
        bad = {0}
        selection = Selection(planned, [], lambda q, challenge, number: ['X'] if q['n'] in bad else [], minimum=15)
        selection.screen()
        self.assertFalse(selection.shorten())                 # 14 of a request of 20 is below its floor of 15
        unbounded = Selection(planned, [], lambda q, c, n: ['X'] if q['n'] in bad else [])
        unbounded.screen()
        self.assertTrue(unbounded.shorten())                  # its own floor, three quarters of 15, is 12

    def test_a_recorded_opening_sheet_prints_the_planned_questions_with_its_note(self):
        lesson, reply = corpus('lessons/L1-g7-equations.json'), corpus('replies/L2-g7.json')
        transport = PartScript({}, others=[reply])
        outcome, sheets = self.run_job(lesson, transport)
        self.assertTrue(outcome['delivered'], outcome['code'])
        printed = sheets[-1]['payload']['sections'][0]['questions']
        self.assertEqual((len(printed), sheets[-1]['salvagedFrom']), (15, 20))
        self.assertEqual(sum(len(q['items']) for q in printed), 45)                     # was 60
        self.assertEqual([(row['code'], row['count']) for row in outcome['result']['reviewFindings']], [('LESSON_SIZED', 5)])
        sent = json.loads(transport.bodies[0]['messages'][1]['content'])
        self.assertEqual(len(sent['questionPlan']), 15)
        self.assertEqual(len(sent['reservePlan']), 4)                                   # reserves follow the request
        self.assertIn('small, friendly numbers', transport.bodies[0]['messages'][0]['content'])


if __name__ == '__main__':
    unittest.main()
