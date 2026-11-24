"""Provider switch, Gemini request shape, error mapping, retry bound and redaction.

Offline only: every test replaces the opener with a fake transport.
"""
import contextlib
import copy
import hashlib
import http.client
import io
import json
import os
from pathlib import Path
import ssl
import sys
import tempfile
import traceback
import unittest
from unittest.mock import patch
from urllib.error import HTTPError, URLError

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
import compact_authoring
import no_carry_addition
import provider
from general_source import validate_question, validate_source
from reply_examples import BANDS, example_question, reply_example
from runtime_catalog import catalog, scope_for_lesson
from skill_authoring import worksheet_schema
from test_general_runtime import intake
from validation import GenerationError

try:
    import jsonschema
except ImportError:  # The container image does not ship it; the engine checks below still run.
    jsonschema = None

GEMINI_KEY = 'AIzaFIXTURE-gemini-key-never-real-0123456789'
QWEN_KEY = 'sk-FIXTURE-qwen-key-never-real-0123456789'
QWEN = {'QWEN_API_KEY': QWEN_KEY, 'QWEN_MODEL': 'qwen3.8-flash',
        'QWEN_BASE_URL': 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'}
QWEN_URL = QWEN['QWEN_BASE_URL'] + '/chat/completions'
GEMINI = {'TEACHER_AUTHOR_PROVIDER': 'gemini', 'GEMINI_API_KEY': GEMINI_KEY}
# Gemini writes a sheet in parallel parts unless told otherwise (author_request.slice_setting).
GEMINI_ONE = {**GEMINI, 'TEACHER_AUTHOR_SLICES': '1'}
SCHEMA_REJECTION = ('The specified schema produces a constraint that has too many states for serving. '
                    'Typical causes of this error are schemas with lots of text or long array length limits.')


class Reply:
    def __init__(self, envelope, status=200):
        self.raw = envelope if isinstance(envelope, bytes) else json.dumps(envelope, ensure_ascii=False).encode()
        self.status = status
    def __enter__(self): return self
    def __exit__(self, *args): pass
    def read(self, limit): return self.raw[:limit]


class PerPart:
    """Fake opener for parallel author parts: one fresh queue of outcomes per part, from ``make(part)``."""
    def __init__(self, make):
        import threading
        self.make, self.queues, self.requests, self.lock = make, {}, [], threading.Lock()
    def open(self, request, timeout=None):
        from bench import engine
        part = engine.part_of(json.loads(request.data))
        with self.lock:
            self.requests.append(request)
            queue = self.queues.setdefault(part['part'] if part else None, self.make(part))
            outcome = queue.pop(0)
        if isinstance(outcome, BaseException):
            raise outcome
        return outcome


class Transport:
    """Fake opener: returns or raises the queued outcomes and records each request."""
    def __init__(self, *outcomes):
        self.outcomes, self.requests = list(outcomes), []
    def open(self, request, timeout=None):
        self.requests.append(request)
        outcome = self.outcomes.pop(0)
        if isinstance(outcome, BaseException):
            raise outcome
        return outcome


def completion(payload, model='models/gemini-3.8-flash', finish='stop'):
    content = payload if isinstance(payload, str) else json.dumps(payload, ensure_ascii=False)
    return Reply({'model': model, 'usage': {'prompt_tokens': 9000, 'completion_tokens': 7000, 'total_tokens': 16000,
                                           'completion_tokens_details': {'reasoning_tokens': 300, 'other': 'drop'}},
                  'choices': [{'finish_reason': finish, 'message': {'content': content}}]})


def http_error(status, message='', headers=None, envelope=None):
    body = envelope if envelope is not None else {'error': {'code': status, 'message': message, 'status': 'INVALID_ARGUMENT'}}
    return HTTPError(provider.GEMINI_CHAT_URL, status, 'provider reason', headers or {}, io.BytesIO(json.dumps(body).encode()))


def environment(values):
    """Exactly these provider variables; nothing inherited from the developer's shell."""
    return patch.dict(os.environ, values, clear=True)


def general_lessons():
    """First topic of every grade that uses the general source author and whose boundary admits the example.

    The reply example shows notation, not a topic: a topic whose catalog
    boundary forbids one of its signs (א01 comes before '+', ב01 before ':')
    would refuse every question of an example-only sheet (lesson_quality).
    """
    import counting_lesson, division_facts, fraction_lesson, pythagoras_lesson, square_lesson, triangle_lesson
    from lesson_quality import _contains_term, _plain
    native = (counting_lesson, division_facts, fraction_lesson, pythagoras_lesson, square_lesson, triangle_lesson)
    found = {}
    for topic in catalog().topics:
        lesson = intake(topic)
        shown = _plain(json.dumps(example_question(topic['gradeNumber']), ensure_ascii=False))
        if any(_contains_term(shown, term) for term in topic['forbiddenConcepts']):
            continue
        if (topic['gradeNumber'] not in found and not any(m.eligible(lesson) for m in native)
                and not no_carry_addition.compatible(lesson) and not square_lesson.provider_introduction(lesson)):
            found[topic['gradeNumber']] = lesson
    return [found[grade] for grade in sorted(found)]


def flat_reply(lesson):
    grade = lesson['gradeNumber']
    title, rule = ('תַּרְגּוּל', 'קִרְאוּ וּפִתְרוּ.') if grade <= 2 else ('תרגול', 'קראו ופתרו את התרגילים.')
    return {'title': title, 'rule': rule,
            'practice': [example_question(grade) for _ in range(lesson['questionCount'] - 3)],
            'challenges': [example_question(grade) for _ in range(3)]}


class SelectionTests(unittest.TestCase):
    def test_default_is_qwen_and_its_request_body_is_untouched(self):
        for extra in ({}, {'TEACHER_AUTHOR_PROVIDER': ''}, {'TEACHER_AUTHOR_PROVIDER': 'qwen'}):
            with self.subTest(extra=extra), environment({**QWEN, **extra, 'GEMINI_API_KEY': GEMINI_KEY}):
                self.assertEqual(provider.author_provider(), 'qwen')
                self.assertEqual(provider.author_config(), (QWEN_KEY, QWEN_URL, 'qwen3.8-flash'))
                self.assertEqual(provider.author_config('k', QWEN['QWEN_BASE_URL'], 'fixture-model'),
                                 ('k', QWEN_URL, 'fixture-model'))
        body = {'model': 'qwen3.8-flash', 'messages': [], 'enable_thinking': False,
                'response_format': {'type': 'json_schema', 'json_schema': {'name': 'n', 'strict': True, 'schema': {}}}}
        self.assertIs(provider.author_body(QWEN_URL, body, example={'question': {}}), body)

    def test_unknown_provider_and_cross_provider_configuration_fail_closed(self):
        for name in ('Gemini', ' gemini', 'openai', 'gemini,qwen'):
            with self.subTest(name=name), environment({**QWEN, **GEMINI, 'TEACHER_AUTHOR_PROVIDER': name}):
                with self.assertRaises(GenerationError) as caught:
                    provider.author_config()
                self.assertEqual(caught.exception.code, 'PROVIDER_CONFIG_INVALID')
        # A Gemini key alone never configures Qwen, and a Qwen key never configures Gemini.
        for values in ({'GEMINI_API_KEY': GEMINI_KEY}, {**QWEN, 'TEACHER_AUTHOR_PROVIDER': 'gemini'}):
            with self.subTest(values=sorted(values)), environment(values):
                with self.assertRaises(GenerationError) as caught:
                    provider.author_config()
                self.assertEqual(caught.exception.code, 'PROVIDER_NOT_CONFIGURED')

    def test_gemini_has_one_endpoint_and_a_closed_model_list(self):
        self.assertEqual(provider.GEMINI_CHAT_URL,
                         'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions')
        self.assertEqual(provider.GEMINI_MODELS, ('gemini-3.8-flash',))
        with environment({**QWEN, **GEMINI}):
            self.assertEqual(provider.author_provider(), 'gemini')
            self.assertEqual(provider.author_config(), (GEMINI_KEY, provider.GEMINI_CHAT_URL, 'gemini-3.8-flash'))
            self.assertEqual(provider.author_config(model='gemini-3.8-flash')[2], 'gemini-3.8-flash')
            refused = [{'api_key': QWEN_KEY}, {'base_url': QWEN['QWEN_BASE_URL']}, {'model': 'qwen3.8-flash'},
                       {'model': 'gemini-2.5-flash'}, {'base_url': provider.GEMINI_CHAT_URL + '?key=x'}]
            for arguments in refused:
                with self.subTest(arguments=arguments), self.assertRaises(GenerationError) as caught:
                    provider.author_config(**arguments)
                self.assertEqual(caught.exception.code, 'PROVIDER_CONFIG_INVALID')
        for model in ('gemini-2.5-flash', 'gemini-3.8-pro', 'qwen3.8-flash'):
            with self.subTest(model=model), environment({**GEMINI, 'GEMINI_MODEL': model}):
                with self.assertRaises(GenerationError) as caught:
                    provider.author_config()
                self.assertEqual(caught.exception.code, 'PROVIDER_CONFIG_INVALID')


class RequestBodyTests(unittest.TestCase):
    def setUp(self):
        self.lesson = intake(next(t for t in catalog().topics if t['topicId'] == 'g8:percentages'))
        self.scope = scope_for_lesson(self.lesson)

    def author(self, values, transport, **options):
        with environment(values), patch('provider.build_authoring_context', return_value={}), \
                patch('provider.build_opener', return_value=transport):
            return provider.author_lesson(self.lesson, **options)

    def test_exact_gemini_request(self):
        transport, measured = Transport(completion(flat_reply(self.lesson))), {}
        self.author({**QWEN, **GEMINI_ONE}, transport, metadata=measured)
        self.assertEqual(len(transport.requests), 1)
        request = transport.requests[0]
        self.assertEqual(request.full_url, provider.GEMINI_CHAT_URL)
        self.assertEqual(request.get_method(), 'POST')
        self.assertEqual(request.get_header('Authorization'), 'Bearer ' + GEMINI_KEY)
        self.assertNotIn(QWEN_KEY.encode(), request.data)
        self.assertNotIn(GEMINI_KEY.encode(), request.data)
        body = json.loads(request.data)
        self.assertEqual(set(body), {'model', 'messages', 'response_format', 'reasoning_effort', 'max_tokens', 'temperature'})
        self.assertEqual(body['model'], 'gemini-3.8-flash')
        self.assertEqual(body['response_format'], {'type': 'json_object'})
        self.assertEqual(body['reasoning_effort'], 'low')
        self.assertEqual((body['max_tokens'], body['temperature']), (40000, 0.25))
        self.assertNotIn('enable_thinking', body)
        self.assertNotIn('json_schema', body['response_format'])
        system, user = body['messages']
        self.assertEqual((system['role'], user['role']), ('system', 'user'))
        self.assertTrue(system['content'].endswith(provider.GEMINI_REPLY_RULE))
        sent = json.loads(user['content'])
        # The whole schema is prompt data, with one valid example for the grade band.
        self.assertEqual(sent['sourceSchema'], worksheet_schema(self.lesson, self.scope))
        self.assertEqual(sent['replyExample'], reply_example(self.lesson['gradeNumber']))
        self.assertEqual(list(sent)[-2:], ['sourceSchema', 'replyExample'])
        digest = hashlib.sha256(json.dumps(body, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()).hexdigest()
        self.assertEqual(measured['requestBodySha256'], digest)
        self.assertEqual((measured['provider'], measured['requestedModel'], measured['responseModel']),
                         ('gemini', 'gemini-3.8-flash', 'gemini-3.8-flash'))
        self.assertEqual(measured['usage'], {'prompt_tokens': 9000, 'completion_tokens': 7000, 'total_tokens': 16000,
                                             'completion_tokens_details': {'reasoning_tokens': 300}})
        self.assertEqual((measured['httpStatus'], measured['attempts'], measured['finishReason']), (200, 1, 'stop'))
        self.assertTrue(measured['validated'])
        self.assertGreaterEqual(measured['elapsedSeconds'], 0)

    def test_exact_gemini_part_requests(self):
        from bench import engine
        import author_request
        whole = flat_reply(self.lesson)
        transport, measured = PerPart(lambda part: [completion(engine.cut_reply(whole, part))]), {}
        # Every slot holds the same example question: the questions of parts 2 and 3 repeat part 1's
        # (author_request.duplicates) and no reserve replaces them.
        with self.assertRaises(GenerationError) as caught:
            self.author({**QWEN, **GEMINI}, transport, metadata=measured)
        self.assertEqual(caught.exception.code, 'AUTHOR_PLAN_MISMATCH')
        self.assertEqual(len(transport.requests), 3)                     # auto: twenty questions in three parts
        bodies = [json.loads(request.data) for request in transport.requests]
        for request, body in zip(transport.requests, bodies):
            self.assertEqual((request.full_url, request.get_header('Authorization')), (provider.GEMINI_CHAT_URL, 'Bearer ' + GEMINI_KEY))
            self.assertNotIn(QWEN_KEY.encode(), request.data)
            self.assertNotIn(GEMINI_KEY.encode(), request.data)
            self.assertEqual(body['response_format'], {'type': 'json_object'})
            self.assertTrue(body['messages'][0]['content'].endswith(author_request.SLICE_RULE + provider.GEMINI_REPLY_RULE))
            sent = json.loads(body['messages'][1]['content'])
            self.assertEqual(list(sent)[-3:], ['slice', 'sourceSchema', 'replyExample'])
            self.assertEqual(sent['sourceSchema'], author_request.part_schema(worksheet_schema(self.lesson, self.scope), sent['slice']))
        self.assertEqual(sorted(json.loads(b['messages'][1]['content'])['slice']['part'] for b in bodies), [1, 2, 3])
        self.assertEqual(len({b['messages'][0]['content'] for b in bodies}), 1)
        # One record for the attempt: the parts' tokens summed, the longest part's time.
        self.assertEqual(measured['usage'], {'prompt_tokens': 27000, 'completion_tokens': 21000, 'total_tokens': 48000,
                                             'completion_tokens_details': {'reasoning_tokens': 900}})
        self.assertEqual(measured['authorSlices'], {'parts': 3, 'duplicates': 13})
        self.assertEqual((measured['provider'], measured['responseModel'], measured['httpStatus']), ('gemini', 'gemini-3.8-flash', 200))

    def test_default_qwen_request_keeps_strict_schema_and_has_no_example(self):
        transport, measured = Transport(completion(flat_reply(self.lesson), model='qwen3.8-flash')), {}
        self.author({**QWEN, 'GEMINI_API_KEY': GEMINI_KEY}, transport, metadata=measured)
        request = transport.requests[0]
        self.assertEqual(request.full_url, QWEN_URL)
        self.assertEqual(request.get_header('Authorization'), 'Bearer ' + QWEN_KEY)
        body = json.loads(request.data)
        self.assertEqual(set(body), {'model', 'messages', 'response_format', 'enable_thinking', 'max_tokens', 'temperature'})
        self.assertEqual(body['response_format']['type'], 'json_schema')
        self.assertIs(body['response_format']['json_schema']['strict'], True)
        self.assertEqual(body['response_format']['json_schema']['schema'], worksheet_schema(self.lesson, self.scope))
        self.assertIs(body['enable_thinking'], False)
        self.assertNotIn('replyExample', json.loads(body['messages'][1]['content']))
        self.assertNotIn(provider.GEMINI_REPLY_RULE, body['messages'][0]['content'])
        self.assertEqual((measured['provider'], measured['responseModel']), ('qwen', 'qwen3.8-flash'))

    def test_transport_adapts_a_correction_request_that_was_built_for_qwen(self):
        schema = {'type': 'object', 'properties': {'q4': {'$ref': '#/$defs/question'}}, 'required': ['q4'],
                  'additionalProperties': False, '$defs': worksheet_schema(self.lesson, self.scope)['$defs']}
        body = {'model': 'gemini-3.8-flash', 'messages': [
            {'role': 'system', 'content': 'Revise only the indicated questions.'},
            {'role': 'user', 'content': json.dumps({'questionsToCorrect': [4]})}],
            'response_format': {'type': 'json_schema', 'json_schema': {'name': 'revise_skill_questions', 'strict': True, 'schema': schema}},
            'temperature': 0.15, 'enable_thinking': False, 'max_tokens': 1800}
        untouched = copy.deepcopy(body)
        transport = Transport(completion({'q4': {}}))
        with patch('provider.build_opener', return_value=transport):
            self.assertEqual(provider.request_author_json(provider.GEMINI_CHAT_URL, GEMINI_KEY, body, {}, 5), {'q4': {}})
        self.assertEqual(body, untouched)
        sent = json.loads(transport.requests[0].data)
        self.assertEqual(sent['response_format'], {'type': 'json_object'})
        self.assertEqual((sent['reasoning_effort'], sent['temperature'], sent['max_tokens']), ('low', 0.15, 1800))
        self.assertNotIn('enable_thinking', sent)
        self.assertEqual(json.loads(sent['messages'][1]['content']), {'questionsToCorrect': [4], 'sourceSchema': schema})
        adapted = provider.author_body(provider.GEMINI_CHAT_URL, body)
        self.assertEqual(adapted, sent)
        self.assertIs(provider.author_body(provider.GEMINI_CHAT_URL, adapted), adapted)

    def test_request_that_cannot_carry_its_schema_in_the_prompt_is_refused_before_sending(self):
        form = {'type': 'json_schema', 'json_schema': {'name': 'n', 'strict': True, 'schema': {}}}
        for body in ({'messages': [{'role': 'system', 'content': 's'}, {'role': 'user', 'content': 'plain words'}], 'response_format': form},
                     {'messages': [{'role': 'user', 'content': '{}'}], 'response_format': form},
                     {'messages': [{'role': 'system', 'content': 's'}, {'role': 'user', 'content': '{}'}]},
                     {'messages': [{'role': 'system', 'content': 's'}, {'role': 'user', 'content': '[1]'}], 'response_format': form}):
            transport = Transport()
            with self.subTest(body=body), patch('provider.build_opener', return_value=transport):
                with self.assertRaises(GenerationError) as caught:
                    provider.request_author_json(provider.GEMINI_CHAT_URL, GEMINI_KEY, body, {}, 5)
                self.assertEqual(caught.exception.code, 'PROVIDER_CONFIG_INVALID')
                self.assertEqual(transport.requests, [])


class ReplyExampleTests(unittest.TestCase):
    def test_every_band_example_expands_and_validates_for_every_topic_of_its_grades(self):
        self.assertEqual([last for last, _ in BANDS], [2, 6, 9])
        checked = set()
        for topic in catalog().topics:
            grade = topic['gradeNumber']
            lesson = intake(topic)
            scope = scope_for_lesson(lesson)
            with self.subTest(topic=topic['topicId']):
                question = {**example_question(grade), 'star': False}
                expanded = compact_authoring.expand_source(
                    {'version': 4, 'sections': [{'questions': [question]}]}, grade,
                    fraction_notation=scope['topic']['domain'] == 'fractions')
                evidence, pending = [], []
                validate_question(expanded['sections'][0]['questions'][0], grade, scope, provider=True,
                                  qcount=1, evidence=evidence, pending=pending)
                # Elementary keys must be computed: the adapter refuses unverified answers there.
                self.assertEqual(len(evidence) + len(pending), len(question['items']))
                self.assertEqual(len(pending), 0 if grade <= 6 else 1)
                if jsonschema is not None:
                    schema = worksheet_schema(lesson, scope)
                    jsonschema.validate(example_question(grade), {'$ref': '#/$defs/question', '$defs': schema['$defs']})
            checked.add(grade)
        self.assertEqual(checked, set(range(1, 10)))

    def test_examples_follow_the_niqqud_rule_of_their_band(self):
        niqqud = lambda value: any('ְ' <= c <= 'ׇ' for c in value)
        for grade in range(1, 10):
            question = example_question(grade)
            fields = [question['intro']] + [item['prompt'] for item in question['items']]
            fields += [item['answer']['unit'] for item in question['items'] if item['answer'].get('unit')]
            with self.subTest(grade=grade):
                self.assertEqual(len(question['items']), 5 if grade <= 2 else 3)
                self.assertTrue(all(niqqud(field) == (grade <= 2) for field in fields))
        first = example_question(3)
        first['items'].clear()
        self.assertEqual(len(example_question(3)['items']), 3)
        with self.assertRaises(ValueError):
            example_question(10)

    def test_a_whole_sheet_in_example_notation_compiles_through_the_gemini_author_path(self):
        lessons = general_lessons()
        self.assertEqual([lesson['gradeNumber'] for lesson in lessons], list(range(1, 10)))
        for lesson in lessons:
            with self.subTest(grade=lesson['gradeNumber'], topic=lesson['topicId']):
                transport, measured = Transport(completion(flat_reply(lesson))), {}
                with environment(GEMINI_ONE), patch('provider.build_authoring_context', return_value={}), \
                        patch('provider.build_opener', return_value=transport):
                    source = provider.author_lesson(lesson, metadata=measured)
                self.assertTrue(measured['validated'])
                self.assertEqual(measured['authorContract'], 'worksheet-source/4')
                self.assertEqual(validate_source(lesson, source, scope_for_lesson(lesson))['source'], source)
                sent = json.loads(json.loads(transport.requests[0].data)['messages'][1]['content'])
                self.assertEqual(sent['replyExample'], reply_example(lesson['gradeNumber']))


class TransportCase(unittest.TestCase):
    def call(self, *outcomes, target=provider.GEMINI_CHAT_URL, key=GEMINI_KEY):
        body = {'model': 'm', 'messages': [{'role': 'system', 'content': 's'}, {'role': 'user', 'content': '{}'}],
                'response_format': {'type': 'json_object'}}
        transport, measured = Transport(*outcomes), {}
        failure = result = None
        with patch('provider.build_opener', return_value=transport), patch('provider.time.sleep') as sleep:
            try:
                result = provider.request_author_json(target, key, body, measured, 5)
            except GenerationError as exc:
                failure = exc
        return result, failure, measured, transport, sleep


class ErrorMappingTests(TransportCase):
    def test_schema_rejection_is_a_distinct_diagnostic_under_the_existing_code(self):
        for envelope in ({'error': {'code': 400, 'message': SCHEMA_REJECTION, 'status': 'INVALID_ARGUMENT'}},
                         [{'error': {'code': 400, 'message': SCHEMA_REJECTION, 'status': 'INVALID_ARGUMENT'}}]):
            _, failure, measured, transport, sleep = self.call(http_error(400, envelope=envelope))
            self.assertEqual(failure.code, 'PROVIDER_HTTP_ERROR')
            self.assertEqual(str(failure), 'Provider returned HTTP 400; body omitted')
            self.assertEqual(measured['httpStatus'], 400)
            self.assertEqual(measured['providerError'], 'schema_rejected')
            self.assertEqual(measured['httpDiagnostic'], {'body': 'parsed', 'statuses': ['INVALID_ARGUMENT'],
                                                          'fields': [], 'categories': ['schema_complexity']})
            self.assertEqual((len(transport.requests), sleep.call_count, measured['attempts']), (1, 0, 1))
            self.assertFalse(measured.get('responseReceived', False))

    def test_failed_slice_keeps_its_own_http_status_and_retry_count(self):
        from author_request import send_parts
        from remote_worker import failure_detail
        # One usable part, one malformed optional part, and a different part
        # whose retry received a new HTTP error. The last one closes the job.
        failures = [None,
                    self.call(completion('not-json'))[1],
                    self.call(http_error(503), http_error(401, 'PRIVATE'))[1]]
        def ask(number, observed):
            if failures[number] is not None:
                raise failures[number]
            observed.update(httpStatus=200, attempts=1)
            return {}
        with self.assertRaises(GenerationError) as caught:
            send_parts([0, 1, 2], ask)
        self.assertEqual(failure_detail(caught.exception, {})['providerHttp'],
                         {'provider': 'gemini', 'httpStatus': 401, 'providerError': 'credential_rejected', 'attempts': 2})
        _, timeout, _, _, _ = self.call(http_error(429), TimeoutError('PRIVATE'))
        self.assertNotIn('providerHttp', failure_detail(timeout, {}))

    def test_other_http_failures_keep_the_code_and_get_a_fixed_label(self):
        cases = [(400, 'Invalid JSON schema: unsupported keyword pattern', 'schema_rejected'),
                 (400, 'Unknown name "reasoning_effort": Cannot find field.', 'unsupported_parameter'),
                 (400, 'Invalid value at temperature', 'bad_request'),
                 (401, 'API key not valid', 'credential_rejected'), (403, 'Permission denied', 'credential_rejected'),
                 (404, 'models/gemini-2.5-flash is not found', 'model_not_found'),
                 (500, 'Internal error', 'server_error'), (502, 'Bad gateway', 'server_error'), (418, '', 'http_error')]
        for status, message, label in cases:
            with self.subTest(status=status, label=label):
                _, failure, measured, transport, sleep = self.call(http_error(status, message))
                self.assertEqual(failure.code, 'PROVIDER_HTTP_ERROR')
                self.assertEqual((measured['httpStatus'], measured['providerError']), (status, label))
                self.assertEqual((len(transport.requests), sleep.call_count), (1, 0))

    def test_network_tls_and_timeout_failures_map_to_existing_codes_without_retry(self):
        cases = [(URLError(ssl.SSLCertVerificationError('bad certificate')), 'PROVIDER_TLS_ERROR', None),
                 (ssl.SSLError('handshake'), 'PROVIDER_TLS_ERROR', None),
                 (URLError(TimeoutError('timed out')), 'PROVIDER_UNAVAILABLE', 'connect'),
                 (URLError(ConnectionRefusedError('refused')), 'PROVIDER_UNAVAILABLE', None),
                 (TimeoutError('The read operation timed out'), 'PROVIDER_UNAVAILABLE', 'reply'),
                 (ConnectionResetError('reset'), 'PROVIDER_UNAVAILABLE', None),
                 (http.client.IncompleteRead(b'partial'), 'PROVIDER_UNAVAILABLE', None)]
        for outcome, code, phase in cases:
            with self.subTest(outcome=type(outcome).__name__, code=code):
                _, failure, measured, transport, sleep = self.call(outcome)
                self.assertEqual(failure.code, code)
                self.assertEqual(measured.get('timeoutPhase'), phase)
                self.assertEqual((len(transport.requests), sleep.call_count), (1, 0))
                self.assertNotIn('httpStatus', measured)

    def test_reply_envelope_failures_keep_their_codes_and_usage(self):
        cases = [(completion({'a': 1}, finish='length'), 'PROVIDER_INCOMPLETE', 'length'),
                 (completion({'a': 1}, finish='MAX_TOKENS'), 'PROVIDER_INCOMPLETE', 'other'),
                 (completion('```json\n{"a":1}\n```'), 'PROVIDER_INVALID_RESPONSE', 'stop'),
                 (completion('{"a":1,"a":2}'), 'INVALID_MODEL_OUTPUT', 'stop'),
                 (completion('{"a":NaN}'), 'INVALID_MODEL_OUTPUT', 'stop')]
        for outcome, code, finish in cases:
            with self.subTest(code=code, finish=finish):
                _, failure, measured, transport, sleep = self.call(outcome)
                self.assertEqual(failure.code, code)
                self.assertEqual(measured['finishReason'], finish)
                self.assertEqual(measured['usage']['completion_tokens'], 7000)
                self.assertEqual((len(transport.requests), sleep.call_count, measured['httpStatus']), (1, 0, 200))
        for raw in (b'[]', b'{"choices":[]}', b'not json', b'{"choices":[{"finish_reason":"stop","message":{}}]}'):
            with self.subTest(raw=raw):
                _, failure, measured, transport, _ = self.call(Reply(raw))
                self.assertEqual(failure.code, 'PROVIDER_INVALID_RESPONSE')
                self.assertEqual(measured['replyDefect'], 'envelope')
                self.assertEqual(len(transport.requests), 1)

    def test_finished_reply_that_is_not_json_is_rejected_whole_with_its_own_label(self):
        # Shape captured live from gemini-3.8-flash: one stray character where "}}]" closes a question.
        good = '{"practice": [{"intro": "א", "items": [{"prompt": "ב", "answer": {"kind": "review", "text": "ג."}}]}, {"intro": "ד", "items": []}]}'
        stray = good.replace('"}}]}, {"intro"', '"\u5de1}, {"intro"')
        self.assertEqual(json.loads(good)['practice'][1]['intro'], 'ד')
        result, failure, measured, transport, sleep = self.call(completion(stray))
        self.assertIsNone(result)
        self.assertEqual(failure.code, 'PROVIDER_INVALID_RESPONSE')
        self.assertEqual((measured['replyDefect'], measured['finishReason'], measured['httpStatus']), ('content_not_json', 'stop', 200))
        self.assertEqual(measured['usage']['completion_tokens'], 7000)
        self.assertEqual((len(transport.requests), sleep.call_count), (1, 0))
        # The unparsed text stays reachable for a later salvage stage; this layer never repairs it.
        raw = completion(stray).raw
        self.assertEqual(provider.author_reply_text(raw, {}), stray)
        result, failure, measured, _, _ = self.call(completion(good))
        self.assertIsNone(failure)
        self.assertNotIn('replyDefect', measured)
        _, failure, _, _, _ = self.call(Reply(b' ' * (provider.MAX_JSON_BYTES + 100_001)))
        self.assertEqual(failure.code, 'PROVIDER_OUTPUT_TOO_LARGE')

    def test_error_reader_keeps_only_known_fields_and_categories(self):
        message = 'Unknown name additionalProperties in private-lesson; token = KEEP_THIS_PRIVATE'
        google = {'code': 400, 'status': 'INVALID_ARGUMENT', 'message': message,
                  'details': [{'fieldViolations': [{'field': 'responseSchema.oneOf[0].const',
                                                    'description': 'invalid JSON schema: unsupported keyword pattern'}]}]}
        for envelope in ([{'error': google}], {'error': google}, google):
            with self.subTest(envelope=type(envelope).__name__):
                self.assertEqual(provider.safe_http_diagnostic(io.BytesIO(json.dumps(envelope).encode())), {
                    'body': 'parsed', 'statuses': ['INVALID_ARGUMENT'],
                    'fields': ['additionalProperties', 'const', 'oneOf', 'pattern', 'responseSchema'],
                    'categories': ['invalid_schema', 'unsupported_field']})
        payloads = [(b'', 'empty'), (b'not JSON', 'invalid_json'), (b'\xff', 'invalid_json'),
                    (b'[' * 1500, 'invalid_json'), (b'{"error":[]}', 'unrecognized_envelope'),
                    (b'{}' * provider._ERROR_BODY_LIMIT, 'truncated')]
        for raw, state in payloads:
            with self.subTest(state=state):
                stream = io.BytesIO(raw)
                self.assertEqual(provider.safe_http_diagnostic(stream), {'body': state})
                self.assertLessEqual(stream.tell(), provider._ERROR_BODY_LIMIT + 1)
        closed = io.BytesIO(b'closed error stream')
        closed.close()
        self.assertEqual(provider.safe_http_diagnostic(closed), {'body': 'unreadable'})


class RetryTests(TransportCase):
    def test_rate_limit_or_unavailable_is_tried_once_more_for_both_providers(self):
        for target, key in ((provider.GEMINI_CHAT_URL, GEMINI_KEY), (QWEN_URL, QWEN_KEY)):
            for status in (429, 503):
                with self.subTest(target=target, status=status):
                    result, failure, measured, transport, sleep = self.call(
                        http_error(status, 'Resource exhausted'), completion({'ok': True}), target=target, key=key)
                    self.assertIsNone(failure)
                    self.assertEqual(result, {'ok': True})
                    self.assertEqual(len(transport.requests), 2)
                    self.assertEqual(transport.requests[0].data, transport.requests[1].data)
                    sleep.assert_called_once_with(provider.RETRY_BACKOFF_SECONDS)
                    self.assertEqual((measured['attempts'], measured['httpStatus']), (2, 200))
                    self.assertNotIn('providerError', measured)
                    self.assertNotIn('httpDiagnostic', measured)

    def test_at_most_two_tries_then_the_existing_http_error(self):
        self.assertEqual((provider.MAX_ATTEMPTS, provider.RETRY_STATUSES), (2, (429, 503)))
        for status, label in ((429, 'rate_limited'), (503, 'unavailable')):
            with self.subTest(status=status):
                outcomes = [http_error(status, 'quota exceeded') for _ in range(4)]
                _, failure, measured, transport, sleep = self.call(*outcomes)
                self.assertEqual(failure.code, 'PROVIDER_HTTP_ERROR')
                self.assertEqual((len(transport.requests), sleep.call_count), (2, 1))
                self.assertEqual((measured['attempts'], measured['httpStatus'], measured['providerError']), (2, status, label))

    def test_backoff_is_bounded_and_honours_a_short_retry_after(self):
        for header, expected in ((None, 2.0), ('1', 2.0), ('5', 5.0), ('120', 8.0), ('soon', 2.0), ('-3', 2.0), ('inf', 8.0), ('nan', 2.0)):
            with self.subTest(header=header):
                headers = {} if header is None else {'Retry-After': header}
                _, _, _, _, sleep = self.call(http_error(429, headers=headers), completion({'ok': True}))
                sleep.assert_called_once_with(expected)
        self.assertEqual(provider.retry_delay(HTTPError('https://x.invalid', 429, 'r', None, None)), 2.0)

    def test_a_delivered_completion_is_never_requested_again(self):
        # One-call billing: whatever an HTTP 200 contains, the request is final.
        for outcome in (completion({'a': 1}, finish='length'), completion('not json'), Reply(b'{}'),
                        completion({'a': 1})):
            _, _, measured, transport, sleep = self.call(outcome, completion({'second': True}))
            self.assertEqual((len(transport.requests), sleep.call_count, measured['attempts']), (1, 0, 1))
        # Nothing but 429 and 503 is retried.
        for status in (400, 401, 404, 408, 500, 502, 504):
            _, _, _, transport, sleep = self.call(http_error(status), completion({'second': True}))
            self.assertEqual((len(transport.requests), sleep.call_count), (1, 0))


class ConnectTimeoutTests(unittest.TestCase):
    def connect(self, reply_timeout):
        seen = {}
        class Socket:
            def settimeout(self, value): seen['reply'] = value
        def base_connect(connection):
            seen['connect'] = connection.timeout
            connection.sock = Socket()
        connection = provider.BoundedConnection('provider.invalid', timeout=reply_timeout, context=ssl.create_default_context())
        with patch('http.client.HTTPSConnection.connect', base_connect):
            connection.connect()
        return seen, connection

    def test_connect_and_handshake_use_a_short_limit_and_the_reply_keeps_its_own(self):
        self.assertLessEqual(provider.CONNECT_TIMEOUT_SECONDS, 10)
        seen, connection = self.connect(300)
        self.assertEqual(seen, {'connect': provider.CONNECT_TIMEOUT_SECONDS, 'reply': 300})
        self.assertEqual(connection.timeout, 300)
        seen, _ = self.connect(3)
        self.assertEqual(seen, {'connect': 3, 'reply': 3})

    def test_failed_connect_restores_the_reply_limit(self):
        connection = provider.BoundedConnection('provider.invalid', timeout=300, context=ssl.create_default_context())
        with patch('http.client.HTTPSConnection.connect', side_effect=TimeoutError('timed out')):
            with self.assertRaises(TimeoutError):
                connection.connect()
        self.assertEqual(connection.timeout, 300)

    def test_opener_uses_the_bounded_handler_with_verified_tls_and_no_redirects(self):
        transport = Transport(completion({'ok': True}))
        with patch('provider.build_opener', return_value=transport) as build:
            provider.fetch_author_reply(QWEN_URL, QWEN_KEY, {'model': 'm'}, {}, 300)
        redirects, handler = build.call_args.args
        self.assertIsInstance(redirects, provider.NoRedirects)
        self.assertIsInstance(handler, provider.BoundedConnectHTTPS)
        self.assertEqual(handler.verified_context.verify_mode, ssl.CERT_REQUIRED)
        self.assertTrue(handler.verified_context.check_hostname)
        with patch.object(handler, 'do_open', return_value='reply') as do_open:
            self.assertEqual(handler.https_open('request'), 'reply')
        do_open.assert_called_once_with(provider.BoundedConnection, 'request', context=handler.verified_context)


class RedactionTests(unittest.TestCase):
    """No key or header in an exception, a measurement, a diagnostics file or a log."""
    SECRETS = (GEMINI_KEY, QWEN_KEY, 'Bearer ')

    def outcomes(self, key):
        echo = {'error': {'code': 400, 'status': 'INVALID_ARGUMENT', 'message': 'API key ' + key + ' not valid',
                          'details': [{'fieldViolations': [{'field': key, 'description': 'Bearer ' + key}]}]}}
        headers = {'Authorization': 'Bearer ' + key, 'x-goog-api-key': key, 'Retry-After': key}
        leaking = {'model': key, 'usage': {'prompt_tokens': 5, 'api_key': key, 'prompt_tokens_details': {key: 1}},
                   'choices': [{'finish_reason': key, 'message': {'content': 'not json ' + key}}]}
        return [
            ('http 400', [http_error(400, headers=headers, envelope=echo)]),
            ('http 401', [http_error(401, headers=headers, envelope=echo)]),
            ('http 429 twice', [http_error(429, headers=headers, envelope=echo), http_error(429, headers=headers, envelope=echo)]),
            ('http 503 twice', [http_error(503, headers=headers, envelope=[echo]), http_error(503, headers=headers, envelope=[echo])]),
            ('raw error body', [HTTPError(provider.GEMINI_CHAT_URL + '?key=' + key, 500, key, headers, io.BytesIO(key.encode()))]),
            ('url error', [URLError('refused for Bearer ' + key)]),
            ('tls error', [URLError(ssl.SSLError('handshake ' + key))]),
            ('bare tls error', [ssl.SSLError(key)]),
            ('timeout', [TimeoutError(key)]),
            ('reset', [ConnectionResetError(key)]),
            ('incomplete', [http.client.IncompleteRead(key.encode())]),
            ('leaking envelope', [Reply(leaking)]),
            ('leaking model and finish', [Reply({**leaking, 'choices': [{'finish_reason': 'length', 'message': {'content': key}}]})]),
            ('not an envelope', [Reply(json.dumps([key]).encode())]),
            ('duplicate key', [completion('{"' + key + '":1,"' + key + '":2}')]),
        ]

    def assert_clean(self, label, *texts):
        for text in texts:
            for secret in self.SECRETS:
                self.assertNotIn(secret, text, label)

    def test_transport_failures_never_carry_a_key_header_or_provider_text(self):
        body = {'model': 'm', 'messages': [{'role': 'system', 'content': 's'}, {'role': 'user', 'content': '{}'}],
                'response_format': {'type': 'json_schema', 'json_schema': {'name': 'n', 'strict': True, 'schema': {}}}}
        for target, key in ((provider.GEMINI_CHAT_URL, GEMINI_KEY), (QWEN_URL, QWEN_KEY)):
            for label, outcomes in self.outcomes(key):
                with self.subTest(target=target, label=label):
                    measured, transport = {}, Transport(*outcomes)
                    output, errors = io.StringIO(), io.StringIO()
                    with patch('provider.build_opener', return_value=transport), patch('provider.time.sleep'), \
                            contextlib.redirect_stdout(output), contextlib.redirect_stderr(errors), \
                            self.assertNoLogs(level='DEBUG'), self.assertRaises(GenerationError) as caught:
                        provider.request_author_json(target, key, body, measured, 5)
                    failure = caught.exception
                    self.assertRegex(failure.code, r'^(PROVIDER_[A-Z_]+|INVALID_MODEL_OUTPUT)$')
                    # The provider's own exception, with its headers and body, is not chained.
                    self.assertIsNone(failure.__cause__)
                    self.assertIsNone(failure.__context__)
                    self.assert_clean(label, str(failure), repr(failure), ''.join(traceback.format_exception(failure)),
                                      json.dumps(measured, ensure_ascii=False), output.getvalue(), errors.getvalue())
                    self.assertEqual(transport.requests[0].get_header('Authorization'), 'Bearer ' + key)

    def test_author_failure_writes_no_secret_to_metadata_or_the_diagnostics_file(self):
        from remote_worker import save_author_diagnostics
        lesson = intake(next(t for t in catalog().topics if t['topicId'] == 'g8:percentages'))
        job = '11111111-2222-4333-8444-555555555555'
        for label, outcomes in self.outcomes(GEMINI_KEY):
            with self.subTest(label=label), tempfile.TemporaryDirectory() as tmp:
                measured, transport = {}, Transport(*outcomes)
                with environment({**QWEN, **GEMINI_ONE}), patch('provider.build_authoring_context', return_value={}), \
                        patch('provider.build_opener', return_value=transport), patch('provider.time.sleep'), \
                        self.assertRaises(GenerationError) as caught:
                    provider.author_lesson(lesson, metadata=measured, timeout=5)
                self.assertTrue(save_author_diagnostics(Path(tmp), job, measured, caught.exception))
                saved = (Path(tmp) / 'author-diagnostics' / (job + '.json')).read_text()
                self.assert_clean(label, saved, json.dumps(measured, ensure_ascii=False), str(caught.exception))
                self.assertNotIn(QWEN_KEY.encode(), transport.requests[0].data)

    def test_a_failure_of_parallel_parts_writes_no_secret_either(self):
        from remote_worker import save_author_diagnostics
        lesson = intake(next(t for t in catalog().topics if t['topicId'] == 'g8:percentages'))
        job = '11111111-2222-4333-8444-555555555555'
        for label, _ in self.outcomes(GEMINI_KEY):
            with self.subTest(label=label), tempfile.TemporaryDirectory() as tmp:
                measured = {}
                transport = PerPart(lambda part, label=label: dict(self.outcomes(GEMINI_KEY))[label])
                with environment({**QWEN, **GEMINI}), patch('provider.build_authoring_context', return_value={}), \
                        patch('provider.build_opener', return_value=transport), patch('provider.time.sleep'), \
                        self.assertRaises(GenerationError) as caught:
                    provider.author_lesson(lesson, metadata=measured, timeout=5)
                self.assertEqual(len(transport.queues), 3)
                self.assertTrue(save_author_diagnostics(Path(tmp), job, measured, caught.exception))
                saved = (Path(tmp) / 'author-diagnostics' / (job + '.json')).read_text()
                self.assert_clean(label, saved, json.dumps(measured, ensure_ascii=False), str(caught.exception),
                                  repr(caught.exception), ''.join(traceback.format_exception(caught.exception)))
                for request in transport.requests:
                    self.assertNotIn(QWEN_KEY.encode(), request.data)

    def test_missing_or_invalid_configuration_messages_name_no_value(self):
        for values in ({'TEACHER_AUTHOR_PROVIDER': GEMINI_KEY}, {**GEMINI, 'GEMINI_MODEL': GEMINI_KEY},
                       {**QWEN, 'QWEN_BASE_URL': 'https://example.com/' + QWEN_KEY}, {**QWEN, 'QWEN_MODEL': QWEN_KEY + '!'}):
            with self.subTest(values=sorted(values)), environment(values), self.assertRaises(GenerationError) as caught:
                provider.author_config()
            self.assert_clean('config', str(caught.exception), repr(caught.exception))


if __name__ == '__main__':
    unittest.main()
