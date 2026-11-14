"""Small authenticated wake adapter; never interprets lessons or arbitrary commands.

The existing worker alone claims jobs and writes genuine heartbeats. This HTTP
process starts disabled, performs no work on startup/health, and has no automatic
model retry. Render Free is a private pilot with ephemeral disk, not durable
production compute. Native children retain their existing per-step timeouts.
"""
from __future__ import annotations

import hmac
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import sys
import threading
import time

WORKER = Path('/opt/noam/app/remote_worker.py')
WINDOW_SECONDS = 60
POLL_SECONDS = 5
# 745 + 30 + 5 = 13 minutes, including drain and reaping. Starting a cycle
# within the 60-second wake window therefore remains within 14 minutes of the
# last authenticated request, before Render's documented 15-minute idle limit.
# This is not a promise against provider restarts or platform termination.
CYCLE_SECONDS = 745
DRAIN_SECONDS = 30
REAP_SECONDS = 5
PREFLIGHT_SECONDS = 110
PREFLIGHT_CACHE_SECONDS = 60
SECRET = re.compile(r'^[a-f0-9]{64}$')
CHILD_ENV = frozenset({
    'PATH', 'HOME', 'LANG', 'LC_ALL', 'TMPDIR', 'FONTCONFIG_PATH',
    'ELEMENTARY_SKILL_PATH', 'MIDDLE_SKILL_PATH', 'PYTHONDONTWRITEBYTECODE',
    'PYTHONUNBUFFERED', 'PYTHONNOUSERSITE', 'QWEN_API_KEY', 'DASHSCOPE_API_KEY',
    'QWEN_BASE_URL', 'QWEN_MODEL', 'TEACHER_GENERATION_SERVICE_KEY',
})


def configuration(environ):
    port = environ.get('PORT', '10000')
    if not re.fullmatch(r'[0-9]{1,5}', port) or not 1 <= int(port) <= 65535:
        raise ValueError('INVALID_PORT')
    key = environ.get('WORKER_WAKE_SECRET', '')
    # Only the exact, explicitly reviewed activation value enables claims.
    enabled = environ.get('TEACHER_FREE_WORKER_ENABLED', 'false') == 'true'
    # The first guarded deployment is disabled and secretless: /healthz can
    # become available before keys are installed. No empty key authenticates.
    if not SECRET.fullmatch(key) and (key or enabled):
        raise ValueError('INVALID_WAKE_SECRET')
    return int(port), key, enabled


def preflight_pass(data):
    try:
        value = json.loads(data)
    except (ValueError, UnicodeDecodeError):
        return False
    return (isinstance(value, dict) and value.get('event') == 'worker_preflight_pass'
            and value.get('claimVerified') is False
            and value.get('providerCalled') is False
            and value.get('heartbeatWritten') is False)


class ProcessRunner:
    """Fixed child, a bounded stdout pipe for checks only, and process-group cleanup."""

    def __init__(self, environ=None):
        source = os.environ if environ is None else environ
        self.env = {key: value for key, value in source.items() if key in CHILD_ENV}

    def run(self, check_only, stop):
        if stop.is_set():
            return False
        command = [sys.executable, '-B', str(WORKER)]
        command += ['--check-only'] if check_only else ['--once', '--work-dir', '/work/jobs']
        process = subprocess.Popen(command, env=self.env, start_new_session=True,
                                   stdout=subprocess.PIPE if check_only else subprocess.DEVNULL,
                                   stderr=subprocess.DEVNULL, stdin=subprocess.DEVNULL)
        output = bytearray()
        oversized = threading.Event()
        reader = None
        if check_only:
            def collect():
                try:
                    data = process.stdout.read(4097)
                    if len(data) > 4096:
                        oversized.set()
                    else:
                        output.extend(data)
                finally:
                    process.stdout.close()
            reader = threading.Thread(target=collect, daemon=True)
            reader.start()
        deadline = time.monotonic() + (PREFLIGHT_SECONDS if check_only else CYCLE_SECONDS)
        draining = False
        interrupted = False

        def kill_group():
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass

        try:
            while process.poll() is None:
                now = time.monotonic()
                if not draining and (stop.is_set() or oversized.is_set() or now >= deadline):
                    draining = interrupted = True
                    deadline = now + (1 if check_only else DRAIN_SECONDS)
                    # Signal only the worker: it drains its owned job. Sending
                    # TERM to the process group would kill its renderer first.
                    try:
                        process.send_signal(signal.SIGTERM)
                    except ProcessLookupError:
                        pass
                elif draining and now >= deadline:
                    kill_group()
                    process.wait(timeout=REAP_SECONDS)
                    return False
                time.sleep(0.1)
            if reader:
                reader.join(timeout=1)
            return (not interrupted and not oversized.is_set() and process.returncode == 0
                    and (not check_only or preflight_pass(bytes(output))))
        finally:
            # Reap any surviving Chromium/render descendants, even after a
            # successful worker parent exit. Never leave an unowned process.
            kill_group()
            if process.poll() is None:
                try:
                    process.wait(timeout=REAP_SECONDS)
                except subprocess.TimeoutExpired:
                    pass


class Supervisor:
    """One child at a time; all admission changes share a lock."""

    def __init__(self, *, enabled, runner=None, clock=time.monotonic):
        self.enabled = enabled
        self.runner = runner or ProcessRunner()
        self.clock = clock
        self.lock = threading.Lock()
        self.stop = threading.Event()
        self.until = 0.0
        self.thread = None
        self.child_running = False
        self.checking = False
        self.checked_at = None
        self.checked_ok = False

    def wake(self):
        with self.lock:
            if self.stop.is_set():
                return 503, {'ok': False, 'state': 'draining'}
            if not self.enabled:
                return 503, {'ok': False, 'state': 'disabled'}
            if self.checking:
                return 503, {'ok': False, 'state': 'unavailable'}
            self.until = self.clock() + WINDOW_SECONDS
            state = 'running' if self.child_running else 'starting'
            if self.thread is None:
                self.thread = threading.Thread(target=self._cycles, daemon=True)
                self.thread.start()
            return 202, {'ok': True, 'state': state}

    def preflight(self):
        with self.lock:
            if self.stop.is_set():
                return 503, {'ok': False, 'state': 'draining'}
            if self.checking:
                return 202, {'ok': False, 'state': 'checking'}
            if self.checked_at is not None and self.clock() - self.checked_at < PREFLIGHT_CACHE_SECONDS:
                return (200 if self.checked_ok else 503), {'ok': self.checked_ok,
                                                         'state': 'ready' if self.checked_ok else 'failed'}
            if self.thread is not None:
                return 503, {'ok': False, 'state': 'busy'}
            self.checking = True
            self.thread = threading.Thread(target=self._check, daemon=True)
            self.thread.start()
            return 202, {'ok': False, 'state': 'checking'}

    def _check(self):
        try:
            ok = self.runner.run(True, self.stop)
        except Exception:
            ok = False
        with self.lock:
            self.checked_ok = ok
            self.checked_at = self.clock()
            self.checking = False
            self.thread = None

    def _cycles(self):
        while True:
            with self.lock:
                if self.stop.is_set() or self.clock() >= self.until:
                    self.thread = None
                    self.child_running = False
                    return
                self.child_running = True
            try:
                ok = self.runner.run(False, self.stop)
            except Exception:
                ok = False
            with self.lock:
                self.child_running = False
                if not ok:
                    # A failing transport/process cycle must not produce an
                    # automatic retry storm. A new intentional wake is needed.
                    self.until = 0.0
                    self.thread = None
                    return
            # Including a completed job, wait five seconds before another
            # claim. Existing worker semantics never retry the failed job.
            self.stop.wait(POLL_SECONDS)

    def shutdown(self):
        with self.lock:
            self.stop.set()
            self.until = 0.0
            thread = self.thread
        if thread:
            thread.join(timeout=DRAIN_SECONDS + REAP_SECONDS + 2)


class HTTPServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True
    request_queue_size = 8

    def __init__(self, address, supervisor, key):
        self.supervisor = supervisor
        self.key = key
        self.slots = threading.BoundedSemaphore(8)
        super().__init__(address, Handler)

    def process_request(self, request, address):
        if not self.slots.acquire(blocking=False):
            self.shutdown_request(request)
            return
        try:
            super().process_request(request, address)
        except BaseException:
            self.slots.release()
            raise

    def process_request_thread(self, request, address):
        try:
            super().process_request_thread(request, address)
        finally:
            self.slots.release()

    def handle_error(self, request, client_address):
        # Base implementation prints request context/tracebacks. Keep server
        # output independent of untrusted URLs, bodies and authorization.
        pass


class Handler(BaseHTTPRequestHandler):
    server_version = 'TeacherPilot'
    sys_version = ''

    def setup(self):
        super().setup()
        self.connection.settimeout(5)

    def log_message(self, format, *args):
        pass

    def send_error(self, code, message=None, explain=None):
        self.reply(code, {'ok': False})

    def reply(self, code, body):
        data = json.dumps(body, separators=(',', ':')).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Connection', 'close')
        self.end_headers()
        self.close_connection = True
        if self.command != 'HEAD':
            self.wfile.write(data)

    def do_GET(self):
        self.reply(200 if self.path == '/healthz' else 404, {'ok': self.path == '/healthz'})

    def do_POST(self):
        if self.path not in ('/wake', '/preflight'):
            return self.reply(404, {'ok': False})
        headers = self.headers
        # These endpoints are server-to-server only. Never reflect an Origin,
        # accept chunking, JSON payloads, duplicate authentication or commands.
        if headers.get_all('Origin'):
            return self.reply(403, {'ok': False})
        auth = headers.get_all('Authorization') or []
        expected = 'Bearer ' + self.server.key
        if (not SECRET.fullmatch(self.server.key) or len(auth) != 1
                or not hmac.compare_digest(auth[0].encode(), expected.encode())):
            return self.reply(401, {'ok': False})
        lengths = headers.get_all('Content-Length') or []
        if headers.get_all('Transfer-Encoding') or (lengths and lengths != ['0']):
            return self.reply(400, {'ok': False})
        code, body = (self.server.supervisor.wake() if self.path == '/wake'
                      else self.server.supervisor.preflight())
        self.reply(code, body)

    def do_OPTIONS(self):
        self.reply(405, {'ok': False})

    do_HEAD = do_OPTIONS
    do_PUT = do_OPTIONS
    do_DELETE = do_OPTIONS
    do_PATCH = do_OPTIONS


def main():
    if len(sys.argv) != 1:
        raise SystemExit('No server arguments accepted')
    try:
        port, key, enabled = configuration(os.environ)
    except ValueError:
        raise SystemExit('HTTP_CONFIGURATION_INVALID') from None
    supervisor = Supervisor(enabled=enabled)
    server = HTTPServer(('0.0.0.0', port), supervisor, key)
    stopping = threading.Event()

    def shutdown(signum, frame):
        if not stopping.is_set():
            stopping.set()
            # server.shutdown cannot run on the serve_forever thread.
            threading.Thread(target=server.shutdown, daemon=True).start()

    for sig in (signal.SIGTERM, signal.SIGINT):
        signal.signal(sig, shutdown)
    try:
        server.serve_forever(poll_interval=0.2)
    finally:
        supervisor.shutdown()
        server.server_close()


if __name__ == '__main__':
    main()
