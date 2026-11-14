"""Graceful stop with mocked signals/transport; no model, network or daemon."""
from __future__ import annotations

import io
import json
import signal
import sys
import tempfile
import threading
import time
import unittest
from contextlib import ExitStack, redirect_stdout
from pathlib import Path
from unittest.mock import Mock, patch

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
import remote_worker as worker


class WorkerShutdownTests(unittest.TestCase):
    def setUp(self):
        self.stack = ExitStack()
        self.addCleanup(self.stack.close)
        self.root = Path(self.stack.enter_context(tempfile.TemporaryDirectory()))
        self.original = {signal.SIGTERM: Mock(name='old_term'), signal.SIGINT: signal.SIG_IGN}
        self.handlers = dict(self.original)
        self.installations = []

        def install(signum, handler):
            previous = self.handlers[signum]
            self.handlers[signum] = handler
            self.installations.append(signum)
            return previous

        self.stack.enter_context(patch.object(worker.signal, 'signal', side_effect=install))
        self.stack.enter_context(patch.object(sys, 'argv', ['worker', '--work-dir', str(self.root)]))
        self.ready = self.stack.enter_context(patch.object(worker, 'check_readiness', return_value={'ready': True}))
        self.remote = Mock()
        self.remote.call.return_value = []
        self.stack.enter_context(patch.object(worker, 'Remote', return_value=self.remote))
        self.transport = self.stack.enter_context(patch.object(worker, 'check_transport'))
        self.heartbeat = self.stack.enter_context(patch.object(worker, 'heartbeat'))
        self.process = self.stack.enter_context(patch.object(worker, 'process_job'))
        self.update = self.stack.enter_context(patch.object(worker, 'update_job'))
        self.author = self.stack.enter_context(patch.object(worker, 'author_lesson', side_effect=AssertionError('No model calls')))
        self.output = self.stack.enter_context(redirect_stdout(io.StringIO()))
        self.job = {'id': '22222222-2222-4222-8222-222222222222'}

    def send(self, signum=signal.SIGTERM):
        self.handlers[signum](signum, None)

    def assert_restored(self):
        self.assertEqual(self.handlers, self.original)
        self.author.assert_not_called()

    def test_stop_during_preflight_never_constructs_claim_or_health(self):
        def ready(**kwargs):
            self.send()
            return {'ready': True}
        self.ready.side_effect = ready
        worker.main()
        self.transport.assert_not_called()
        self.remote.call.assert_not_called()
        self.heartbeat.assert_not_called()
        self.process.assert_not_called()
        self.assert_restored()

    def test_stop_after_transport_does_not_begin_new_claim(self):
        self.transport.side_effect = lambda remote: self.send(signal.SIGINT)
        worker.main()
        self.remote.call.assert_not_called()
        self.heartbeat.assert_not_called()
        self.process.assert_not_called()
        self.assert_restored()

    def test_signal_during_inflight_claim_drains_returned_job_once(self):
        def claim(*args, **kwargs):
            self.send()
            return [self.job]
        self.remote.call.side_effect = claim
        worker.main()
        self.remote.call.assert_called_once_with('/rest/v1/rpc/claim_teacher_generation_job', 'POST', {})
        self.process.assert_called_once_with(self.remote, self.job, self.root.resolve())
        self.heartbeat.assert_called_once_with(self.remote)
        self.update.assert_not_called()
        self.assertEqual(json.loads(self.output.getvalue())['event'], 'generation_needs_review')
        self.assert_restored()

    def test_repeated_signals_during_job_do_not_interrupt_or_claim_again(self):
        self.remote.call.return_value = [self.job]
        events = []
        def process(*args):
            events.append('started')
            self.send(signal.SIGINT)
            self.send(signal.SIGTERM)
            self.send(signal.SIGINT)
            events.append('finished')
        self.process.side_effect = process
        worker.main()
        self.assertEqual(events, ['started', 'finished'])
        self.remote.call.assert_called_once()
        self.process.assert_called_once()
        self.update.assert_not_called()
        self.assert_restored()

    def test_empty_claim_with_signal_exits_without_processing_or_reclaim(self):
        def claim(*args, **kwargs):
            self.send()
            return []
        self.remote.call.side_effect = claim
        worker.main()
        self.remote.call.assert_called_once()
        self.process.assert_not_called()
        self.heartbeat.assert_called_once()
        self.assert_restored()

    def test_idle_wait_wakes_promptly_and_restores_handlers(self):
        original_event = threading.Event
        entered_wait = original_event()
        observed = []
        class ObservedEvent(original_event):
            def wait(self, timeout=None):
                observed.append(timeout)
                entered_wait.set()
                return super().wait(timeout)
        def request_stop():
            if entered_wait.wait(2):
                self.send()
        notifier = threading.Thread(target=request_stop)
        with patch.object(worker.threading, 'Event', ObservedEvent):
            notifier.start()
            started = time.monotonic()
            worker.main()
            elapsed = time.monotonic() - started
        notifier.join(timeout=2)
        self.assertFalse(notifier.is_alive())
        self.assertEqual(observed, [5])
        self.assertLess(elapsed, 1.0, 'A stop should wake the five-second idle wait')
        self.remote.call.assert_called_once()
        self.assert_restored()

    def test_failure_after_signal_records_one_failure_without_retry_or_raw_log(self):
        self.remote.call.return_value = [self.job]
        def process(*args):
            self.send()
            raise RuntimeError('PRIVATE_PROVIDER_RESPONSE')
        self.process.side_effect = process
        worker.main()
        self.remote.call.assert_called_once()
        self.process.assert_called_once()
        self.update.assert_called_once_with(self.remote, self.job, {
            'status': 'failed', 'phase': 'failed', 'error_code': 'WORKER_FAILED',
            'lease_token': None, 'lease_until': None})
        self.assertNotIn('PRIVATE_', self.output.getvalue())
        self.assert_restored()

    def test_handlers_restore_on_preflight_system_exit(self):
        self.ready.return_value = {'ready': False}
        with self.assertRaises(SystemExit) as caught:
            worker.main()
        self.assertEqual(caught.exception.code, 1)
        self.assert_restored()

    def test_handlers_restore_on_unexpected_base_exception(self):
        self.remote.call.return_value = [self.job]
        self.process.side_effect = KeyboardInterrupt()
        with self.assertRaises(KeyboardInterrupt):
            worker.main()
        self.assert_restored()

    def test_once_empty_queue_returns_without_wait_and_restores_handlers(self):
        with patch.object(sys, 'argv', ['worker', '--once', '--work-dir', str(self.root)]):
            worker.main()
        self.remote.call.assert_called_once()
        self.heartbeat.assert_called_once()
        self.assert_restored()


if __name__ == '__main__':
    unittest.main()
