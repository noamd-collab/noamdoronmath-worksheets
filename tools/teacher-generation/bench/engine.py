"""The single place where the bench reaches into the generator.

Every bench tool calls the generator through this module, so a later engine
change (reserve questions, salvage, new acceptance rules) needs an adjustment
here only. Nothing below re-implements an engine check. The functions replace
the model transport, guard the network, call the engine's own entry points
(`remote_worker.process_job`, which runs `author_and_render`, and
`general_provider.author_general_lesson`) and report what those did.

Engine names this module depends on:

* `remote_worker`: `process_job`, `update_job`, `check_transport`, `heartbeat`,
  and the names it imports: `author_lesson`, `render_job`, `read_skill_feedback`.
* `provider.request_author_json(target, key, body, metadata, timeout)`.
* `general_provider.author_general_lesson`, `general_adapters.compile_source`.
* `cloud/container/skill_bundle.install` and the bundled skill archives.
"""
from __future__ import annotations

from contextlib import ExitStack, contextmanager
from copy import deepcopy
from datetime import datetime, timedelta, timezone
import importlib.util
import json
import os
from pathlib import Path
import re
import socket
import sys
import threading
import time
from unittest.mock import patch
import uuid

BENCH = Path(__file__).resolve().parent
ENGINE = BENCH.parent
SKILL_ENV = {'elementary': 'ELEMENTARY_SKILL_PATH', 'middle': 'MIDDLE_SKILL_PATH'}
PROVIDER_ENV = ('QWEN_API_KEY', 'QWEN_BASE_URL', 'QWEN_MODEL')
# Variables that could reach a paid model or the production queue.
CREDENTIAL_ENV = ('QWEN_API_KEY', 'DASHSCOPE_API_KEY', 'QWEN_BASE_URL', 'QWEN_MODEL',
                  'TEACHER_GENERATION_SERVICE_KEY',
                  # The author switch and the second provider's credential: an offline
                  # run always takes the placeholder Qwen settings below.
                  'TEACHER_AUTHOR_PROVIDER', 'GEMINI_API_KEY', 'GEMINI_MODEL')
# Placeholders for offline runs. The host is on the engine's allowlist so its
# configuration check passes; the transport is replaced and sockets are
# refused, so nothing is ever sent there.
OFFLINE_PROVIDER = {'QWEN_API_KEY': 'offline-replay-no-key',
                    'QWEN_BASE_URL': 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
                    'QWEN_MODEL': 'offline-replay'}

if str(ENGINE) not in sys.path:
    sys.path.insert(0, str(ENGINE))


class BenchError(RuntimeError):
    """The bench could not drive the engine; never a statement about a worksheet."""


class NetworkBlocked(RuntimeError):
    pass


class StopBeforeRender(Exception):
    """Raised in place of the render when a caller asked for the author stage only."""


# --------------------------------------------------------------------------- skills

def skill_roots(cache):
    """Return the two pinned skill folders, installing the bundled archives once.

    Explicit ELEMENTARY_SKILL_PATH and MIDDLE_SKILL_PATH win. Otherwise the
    hash-pinned archives that ship with the engine are unpacked under `cache`
    by the engine's own installer, which verifies every member.
    """
    configured = {kind: os.environ.get(name) for kind, name in SKILL_ENV.items()}
    if all(configured.values()):
        return {kind: Path(path) for kind, path in configured.items()}
    target = Path(cache).resolve() / 'skills'
    ready = all((target / kind / 'SKILL.md').is_file() for kind in SKILL_ENV)
    if not ready:
        if target.exists():
            raise BenchError(f'Incomplete skill folder, remove it and rerun: {target}')
        container = ENGINE / 'cloud/container'
        spec = importlib.util.spec_from_file_location('bench_skill_bundle', container / 'skill_bundle.py')
        bundle = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(bundle)
        target.parent.mkdir(parents=True, exist_ok=True)
        bundle.install(container / 'skills', target, ENGINE / 'skill-lock.json')
    return {kind: target / kind for kind in SKILL_ENV}


@contextmanager
def engine_environment(skills, *, live=False):
    """Point the engine at the skills. Offline runs see no real credential at all."""
    values = {SKILL_ENV[kind]: str(path) for kind, path in skills.items()}
    values['PYTHONDONTWRITEBYTECODE'] = '1'
    with patch.dict(os.environ, values):
        if not live:
            for name in CREDENTIAL_ENV:
                os.environ.pop(name, None)
            os.environ.update(OFFLINE_PROVIDER)
        yield


# --------------------------------------------------------------------------- network

@contextmanager
def network_guard(allowed_hosts=()):
    """Refuse outbound connections from this process, except to the named hosts.

    Yields the list of refused attempts; an empty list after a run is the
    evidence that nothing tried to leave. Render steps run in child processes
    and never need the network.
    """
    allowed = frozenset(allowed_hosts)
    refused = []
    inside = threading.local()
    real_create = socket.create_connection
    real_connect = socket.socket.connect
    real_connect_ex = socket.socket.connect_ex

    def create_connection(address, *args, **kwargs):
        host = address[0] if isinstance(address, tuple) and address else None
        if host not in allowed:
            refused.append(str(host))
            raise NetworkBlocked('Outbound connection refused by the bench')
        inside.depth = getattr(inside, 'depth', 0) + 1
        try:
            return real_create(address, *args, **kwargs)
        finally:
            inside.depth -= 1

    def guarded(real):
        def call(self, address):
            if self.family in (socket.AF_INET, socket.AF_INET6) and getattr(inside, 'depth', 0) < 1:
                refused.append(str(address[0]) if isinstance(address, tuple) and address else 'socket')
                raise NetworkBlocked('Outbound connection refused by the bench')
            return real(self, address)
        return call

    with ExitStack() as stack:
        stack.enter_context(patch.object(socket, 'create_connection', create_connection))
        stack.enter_context(patch.object(socket.socket, 'connect', guarded(real_connect)))
        stack.enter_context(patch.object(socket.socket, 'connect_ex', guarded(real_connect_ex)))
        yield refused


# --------------------------------------------------------------------------- transports

def describe_call(body):
    """What the engine asked the model for. Never the key, a header or the prompt."""
    form = body.get('response_format', {}).get('json_schema', {}) if isinstance(body, dict) else {}
    schema = form.get('schema') if isinstance(form.get('schema'), dict) else {}
    return {'schema': form.get('name'), 'required': sorted(schema.get('required', [])),
            'maxTokens': body.get('max_tokens'), 'temperature': body.get('temperature')}


class RecordedReplies:
    """Stand-in for `provider.request_author_json` that answers from recorded replies.

    The first request receives the recorded first reply. A later request (a
    correction) is answered only by a recorded reply whose keys are exactly the
    keys that request requires; otherwise the run stops with
    REPLAY_REPLY_NOT_RECORDED, because inventing a reply would be a model call.
    """

    def __init__(self, first, corrections=()):
        self.first = first
        self.corrections = [c for c in corrections if isinstance(c, dict)]
        self.calls = []

    def __call__(self, target, key, body, metadata, timeout):
        from validation import GenerationError
        entry = describe_call(body)
        self.calls.append(entry)
        if len(self.calls) == 1:
            reply = self.first
        else:
            wanted = set(entry['required'])
            reply = next((c for c in self.corrections if set(c) == wanted), None)
            if reply is None:
                entry['answered'] = False
                raise GenerationError('REPLAY_REPLY_NOT_RECORDED',
                                      'No recorded reply answers this correction request')
        entry['answered'] = True
        if isinstance(metadata, dict):
            metadata.update(responseReceived=True, usage={}, elapsedSeconds=0.0)
        return deepcopy(reply)


def _question_object(schema):
    """Find the flat worksheet object inside the request schema."""
    definitions = schema.get('$defs', {})

    def resolve(node):
        while isinstance(node, dict) and '$ref' in node:
            name = node['$ref'].rsplit('/', 1)[-1]
            node = definitions.get(name)
        return node

    candidates = [schema] + [resolve(option) for option in schema.get('anyOf', [])]
    for candidate in candidates:
        if isinstance(candidate, dict) and 'practice' in candidate.get('properties', {}):
            return candidate, resolve
    raise BenchError('The author request no longer asks for a flat worksheet with a practice group')


class ReplyFromSchema:
    """Answer an author request with one question repeated in every slot it asks for.

    The reply is built from the request's own schema, so a new group (for
    example reserve questions) is filled without a change here.
    """

    def __init__(self, question, title, rule):
        self.question, self.title, self.rule = question, title, rule
        self.calls = []

    def __call__(self, target, key, body, metadata, timeout):
        self.calls.append(describe_call(body))
        schema = body['response_format']['json_schema']['schema']
        flat, resolve = _question_object(schema)
        reply = {}
        for name in flat.get('required', list(flat['properties'])):
            spec = resolve(flat['properties'][name])
            if isinstance(spec, dict) and spec.get('type') == 'array':
                reply[name] = [deepcopy(self.question) for _ in range(spec.get('minItems', 1))]
            elif name == 'title':
                reply[name] = self.title
            elif name == 'rule':
                reply[name] = self.rule
            else:
                raise BenchError(f'Unknown required field in the author request: {name}')
        if isinstance(metadata, dict):
            metadata.update(responseReceived=True, usage={}, elapsedSeconds=0.0)
        return reply


class LiveCalls:
    """Wrap the real transport: keep each reply and its token counts, enforce a budget.

    The key travels through as an argument and is never stored, printed or
    written. A call that would exceed the allowance is refused before any
    network use.
    """

    def __init__(self, real, folder, *, max_calls, max_output_tokens):
        self.real, self.folder = real, Path(folder)
        self.calls_left, self.tokens_left = max_calls, max_output_tokens
        self.calls = []

    def __call__(self, target, key, body, metadata, timeout):
        from provider import safe_usage
        from validation import GenerationError
        entry = describe_call(body)
        entry['timeoutSeconds'] = timeout
        ceiling = entry['maxTokens'] if type(entry['maxTokens']) is int else None
        if self.calls_left < 1 or ceiling is None or ceiling > self.tokens_left:
            entry['refused'] = 'SWEEP_BUDGET_EXHAUSTED'
            self.calls.append(entry)
            raise GenerationError('SWEEP_BUDGET_EXHAUSTED', 'The sweep budget does not allow this model call')
        self.calls.append(entry)
        self.calls_left -= 1
        number = sum(1 for call in self.calls if 'refused' not in call)
        started = time.monotonic()
        try:
            reply = self.real(target, key, body, metadata, timeout)
        except GenerationError as exc:
            entry['error'] = exc.code
            raise
        except Exception as exc:
            entry['error'] = type(exc).__name__
            raise
        finally:
            observed = metadata if isinstance(metadata, dict) else {}
            entry['usage'] = safe_usage(observed.get('usage'))
            entry['elapsedSeconds'] = round(time.monotonic() - started, 3)
            if isinstance(observed.get('responseModel'), str):
                entry['responseModel'] = observed['responseModel']
            produced = entry['usage'].get('completion_tokens', entry['usage'].get('output_tokens'))
            if produced is None:
                # No count came back; charge the request's own ceiling so the cap stays hard.
                produced, entry['outputTokensAssumed'] = ceiling, True
            self.tokens_left -= produced
        entry['reply'] = f'reply-{number}.json'
        self.folder.mkdir(parents=True, exist_ok=True)
        (self.folder / entry['reply']).write_text(
            json.dumps(reply, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
        return reply


# --------------------------------------------------------------------------- one job

class _FakeRemote:
    """Accepts the two private uploads in memory. There is no queue and no storage."""

    def __init__(self):
        self.uploads = []

    def call(self, path, method='GET', value=None, raw=None, mime=None, prefer=None):
        if method == 'POST' and raw is not None and path.startswith('/storage/v1/object/'):
            self.uploads.append({'kind': path.rsplit('.', 1)[-1], 'bytes': len(raw)})
            return None
        raise BenchError('The bench has no remote queue or storage: ' + path.split('?', 1)[0])


def _job(lesson, seed):
    def identifier(part):
        return str(uuid.uuid5(uuid.NAMESPACE_URL, f'teacher-bench/{seed}/{part}'))
    return {'id': identifier('job'), 'owner_id': identifier('owner'), 'lease_token': identifier('lease'),
            'status': 'running', 'lesson': lesson,
            'lease_until': (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()}


def _read_json(path):
    try:
        return json.loads(Path(path).read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return None


def run_job(lesson, transport, root, *, seed, route='worker', render=True):
    """Run one job exactly as the queue worker would, with no queue and no storage.

    `remote_worker.process_job` is called unchanged; it runs `author_and_render`
    and its own acceptance and upload checks. Only its remote operations are
    replaced (`update_job`, `check_transport`, `heartbeat`, the remote object)
    and the model transport is the one passed in. The author, render and
    feedback functions are wrapped to observe them, not to change them.

    route='general' sends the lesson to the general author even when a local
    author would write it, so that a recorded model reply can be replayed.
    render=False stops after the author stage.
    """
    import general_provider
    import provider
    import remote_worker
    from validation import GenerationError, validate_lesson

    root = Path(root).resolve()
    root.mkdir(parents=True, exist_ok=True)
    job = _job(lesson, seed)
    remote = _FakeRemote()
    seen = {'phases': [], 'final': None, 'first': None, 'metadata': {}, 'revision': None,
            'renders': [], 'feedback': [], 'authorSeconds': 0.0}
    real_author, real_render = remote_worker.author_lesson, remote_worker.render_job
    real_feedback = getattr(remote_worker, 'read_skill_feedback', None)

    def on_update(_remote, _job_row, values):
        if 'phase' in values and 'status' not in values:
            seen['phases'].append(values['phase'])
        if 'status' in values:
            seen['final'] = values

    def author(job_lesson, **options):
        seen['metadata'] = options.get('metadata') if isinstance(options.get('metadata'), dict) else {}
        seen['revision'] = options.get('revision')
        seen['timeout'] = options.get('timeout')
        started = time.monotonic()
        try:
            if route == 'general':
                validate_lesson(job_lesson)
                passed = {k: options[k] for k in ('metadata', 'timeout', 'revision') if k in options}
                payload = general_provider.author_general_lesson(job_lesson, **passed)
            else:
                payload = real_author(job_lesson, **options)
        except GenerationError as exc:
            seen['first'] = {'ok': False, 'code': exc.code, 'detail': str(exc)[:300]}
            raise
        finally:
            seen['authorSeconds'] = round(time.monotonic() - started, 3)
        seen['first'] = {'ok': True}
        return payload

    def rendering(job_lesson, payload, target, *args, **kwargs):
        if not render:
            raise StopBeforeRender()
        entry = {'dir': Path(target), 'manifest': None}
        seen['renders'].append(entry)
        started = time.monotonic()
        try:
            entry['manifest'] = real_render(job_lesson, payload, target, *args, **kwargs)
        except GenerationError as exc:
            entry['error'] = exc.code
            raise
        finally:
            entry['seconds'] = round(time.monotonic() - started, 3)
        return entry['manifest']

    def feedback(workdir, question_count):
        findings = real_feedback(workdir, question_count)
        seen['feedback'].append([{'question': f.get('question'), 'codes': f.get('codes')} for f in findings])
        return findings

    outcome = {'status': 'failed', 'delivered': False, 'code': None}
    started = time.monotonic()
    with ExitStack() as stack:
        # The remote operations and the transport must be replaced, or the run
        # would reach the queue or a model. A missing name stops the bench.
        for owner, name, replacement in (
                (remote_worker, 'update_job', on_update),
                (remote_worker, 'check_transport', lambda _remote: None),
                (remote_worker, 'heartbeat', lambda _remote: None),
                (provider, 'request_author_json', transport)):
            if not hasattr(owner, name):
                raise BenchError(f'{owner.__name__}.{name} is gone; update bench/engine.py before running')
            stack.enter_context(patch.object(owner, name, replacement))
        stack.enter_context(patch.object(remote_worker, 'author_lesson', author))
        stack.enter_context(patch.object(remote_worker, 'render_job', rendering))
        if hasattr(remote_worker, 'read_skill_feedback'):  # observation only
            stack.enter_context(patch.object(remote_worker, 'read_skill_feedback', feedback))
        try:
            remote_worker.process_job(remote, job, root)
            final = seen['final'] or {}
            outcome.update(status=final.get('status', 'failed'), delivered=final.get('status') == 'needs_review',
                           result=final.get('result'))
        except StopBeforeRender:
            outcome.update(status='authored')
        except GenerationError as exc:
            # The worker stores this code and nothing else on a failed job.
            outcome.update(code=exc.code if re.fullmatch('[A-Z_]{1,60}', exc.code) else 'WORKER_FAILED',
                           detail=str(exc)[:300])
        except BenchError:
            raise
        except Exception as exc:
            outcome.update(code='WORKER_FAILED', detail=f'{type(exc).__name__}: {str(exc)[:200]}')
    metadata = seen['metadata']
    calls = list(getattr(transport, 'calls', []))
    revision = seen['revision'] if isinstance(seen['revision'], dict) else {}
    findings = revision.get('sourceFindings')
    outcome['phases'] = seen['phases']
    outcome['author'] = {
        'route': route,
        'contract': metadata.get('authorContract'),
        'firstPass': seen['first'],
        'modelCalls': sum(1 for call in calls if 'refused' not in call),
        'calls': calls,
        'correctionRequested': metadata.get('correctionRequested') is True or len(calls) > 1,
        'sourceValidated': metadata.get('validated') is True if 'validated' in metadata else None,
        'timeoutSeconds': seen.get('timeout'),
        # The engine's own localisation, as handed to its correction request.
        'sourceFindings': ([{'question': f.get('question'), 'codes': f.get('codes'), 'kind': f.get('kind')}
                            for f in findings] if isinstance(findings, list) else []),
    }
    outcome['renders'] = [{'dir': entry['dir'], 'manifest': entry['manifest'],
                           'error': entry.get('error'), 'seconds': entry.get('seconds')}
                          for entry in seen['renders']]
    outcome['skillFeedback'] = seen['feedback']
    outcome['uploads'] = remote.uploads
    outcome['diagnostics'] = _read_json(root / 'author-diagnostics' / (job['id'] + '.json'))
    outcome['jobDir'] = root / job['id']
    outcome['seconds'] = {'total': round(time.monotonic() - started, 3), 'author': seen['authorSeconds'],
                          'render': round(sum(entry.get('seconds') or 0 for entry in seen['renders']), 3)}
    return outcome


def native_contract(lesson):
    """Name the local author that would write this lesson, or None for the model path.

    Uses the engine's own router with a transport that stops at the first
    model request, so no rule about eligibility is repeated here.
    """
    import provider
    from validation import GenerationError

    class _Reached(Exception):
        pass

    def stop(*_args, **_kwargs):
        raise _Reached()

    metadata = {}
    with patch.object(provider, 'request_author_json', stop):
        try:
            provider.author_lesson(lesson, metadata=metadata)
        except _Reached:
            return None
        except GenerationError:
            return None
    return metadata.get('authorContract') if metadata.get('providerCalled') is False else None


# --------------------------------------------------------------------------- compile path

def compile_reply(lesson, transport, skills, *, context=None):
    """Send one reply through the general author's compile path. No render.

    Returns {'ok': True, 'payload': source} or {'ok': False, 'code', 'detail'}.
    """
    import general_provider
    import provider
    from validation import GenerationError
    try:
        with patch.object(provider, 'request_author_json', transport):
            payload = general_provider.author_general_lesson(
                lesson, timeout=1, metadata={}, skill_paths={k: str(v) for k, v in skills.items()},
                authoring_context=context)
    except GenerationError as exc:
        return {'ok': False, 'code': exc.code, 'detail': str(exc)}
    return {'ok': True, 'payload': payload}


def authoring_context(lesson, skills):
    """The engine's authoring context for a lesson, built once and reused across compiles."""
    from authoring_context import build_authoring_context
    from runtime_catalog import catalog
    return build_authoring_context(catalog(), lesson, {k: str(v) for k, v in skills.items()})


def printed_questions(lesson, payload, skills, work):
    """Compile a validated source with the trusted adapter and return what it prints.

    This is the call the render's first step makes. Returns the adapter's own
    canonical record: each item's printed pupil text and its answer key. A
    process should use it for one skill only, as the engine does.
    """
    import general_adapters
    from general_source import GeneralSourceError
    from math_tasks import MathTaskError
    from runtime_catalog import scope_for_lesson
    scope = scope_for_lesson(lesson)
    work = Path(work)
    saved = list(sys.path)
    try:
        general_adapters.compile_source(lesson, {'source': payload}, scope,
                                        str(skills[scope['topic']['skillId']]), work)
    except (GeneralSourceError, MathTaskError) as exc:
        return {'ok': False, 'code': exc.code, 'detail': str(exc)}
    finally:
        sys.path[:] = saved
    record = _read_json(work / 'worksheet-source.json')
    if not isinstance(record, dict) or not isinstance(record.get('questions'), list):
        raise BenchError('The adapter did not write its canonical worksheet record')
    return {'ok': True, 'questions': record['questions']}
