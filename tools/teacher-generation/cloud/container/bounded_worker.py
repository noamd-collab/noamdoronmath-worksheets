"""PID1's fixed child: one job, bounded wall time and process-group cleanup.

No shell, retry, payload argv, or configurable command is accepted. Tini reaps
orphans; this wrapper forwards shutdown to the worker's own process group.
"""
import os
from pathlib import Path
import signal
import subprocess
import sys
import time

WALL_SECONDS = 1200
DRAIN_SECONDS = 30


def run(command, *, wall_seconds=WALL_SECONDS, drain_seconds=DRAIN_SECONDS):
    if wall_seconds <= 0 or drain_seconds < 0:
        raise ValueError('Invalid process deadline')
    process = subprocess.Popen(command, start_new_session=True)
    deadline = time.monotonic() + wall_seconds
    terminating = False
    interrupted = False

    def send(sig):
        try:
            os.killpg(process.pid, sig)
        except ProcessLookupError:
            pass

    def request_drain():
        # Give the worker's handler a chance to finish its current render. TERM
        # to the whole group here would kill those renderer children first.
        try:
            process.send_signal(signal.SIGTERM)
        except ProcessLookupError:
            pass

    def stop(signum, frame):
        nonlocal deadline, terminating, interrupted
        interrupted = True
        if not terminating:
            terminating = True
            deadline = min(deadline, time.monotonic() + drain_seconds)
            request_drain()

    handlers = {sig: signal.signal(sig, stop) for sig in (signal.SIGTERM, signal.SIGINT)}
    try:
        while process.poll() is None:
            if time.monotonic() >= deadline:
                if not terminating:
                    terminating = interrupted = True
                    deadline = time.monotonic() + drain_seconds
                    request_drain()
                else:
                    send(signal.SIGKILL)
                    process.wait(timeout=5)
                    return 124
            time.sleep(0.1)
        return 143 if interrupted and process.returncode == 0 else process.returncode
    finally:
        # A completed parent may leave a renderer/browser grandchild behind.
        send(signal.SIGKILL)
        for sig, handler in handlers.items():
            signal.signal(sig, handler)


if __name__ == '__main__':
    if len(sys.argv) != 1:
        raise SystemExit('No wrapper arguments are accepted')
    app = Path(__file__).resolve().parents[2]
    raise SystemExit(run([sys.executable, '-B', str(app / 'remote_worker.py'),
                          '--once', '--work-dir', '/work/jobs']))
