"""No credentials, network provider or queue. Only local HTTP and fake children."""
import http.client
import importlib.util
import io
import json
from pathlib import Path
import signal
import threading
import time
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location('free_http', Path(__file__).with_name('http_supervisor.py'))
m = importlib.util.module_from_spec(SPEC); SPEC.loader.exec_module(m)
KEY = 'a' * 64  # Explicit synthetic fixture, never an operator credential.


class FakeRunner:
    def __init__(self, ok=True):
        self.calls = []
        self.started = threading.Event()
        self.finish = threading.Event()
        self.ok = ok
        self.active = 0
        self.peak = 0
    def run(self, check, stop):
        self.calls.append(check)
        self.active += 1
        self.peak = max(self.peak, self.active)
        self.started.set()
        self.finish.wait(2)
        self.active -= 1
        return self.ok


def settle(supervisor):
    with supervisor.lock:
        thread = supervisor.thread
    if thread:
        thread.join(2)
        assert not thread.is_alive(), 'fake child did not finish'


class ConfigurationTests(unittest.TestCase):
    def test_standalone_image_keeps_locked_native_prefix_and_exact_allowlist(self):
        folder = Path(__file__).resolve().parent
        base = (folder.parent / 'container/Dockerfile').read_text().split('ENTRYPOINT ',1)[0]
        free = (folder / 'Dockerfile').read_text()
        self.assertTrue(free.startswith(base))
        self.assertNotIn('ARG ', free)
        self.assertIn('ENV TEACHER_FREE_WORKER_ENABLED=false PORT=10000', free)
        original = (folder.parent / 'container/Dockerfile.dockerignore').read_text().splitlines()
        actual = (folder / 'Dockerfile.dockerignore').read_text().splitlines()
        self.assertEqual(actual, original + [
            '!tools/teacher-generation/cloud/render/Dockerfile',
            '!tools/teacher-generation/cloud/render/Dockerfile.dockerignore',
            '!tools/teacher-generation/cloud/render/http_supervisor.py'])

    def test_disabled_unless_exact_activation(self):
        for value in (None, '', 'false', 'TRUE', '1'):
            env = {'WORKER_WAKE_SECRET': KEY}
            if value is not None: env['TEACHER_FREE_WORKER_ENABLED'] = value
            self.assertEqual(m.configuration(env), (10000, KEY, False))
        self.assertTrue(m.configuration({'WORKER_WAKE_SECRET': KEY, 'TEACHER_FREE_WORKER_ENABLED': 'true'})[2])

    def test_invalid_configuration_stops_without_echo(self):
        for key in ('x'*64, 'A'*64, 'a'*63, 'a'*65):
            with self.assertRaisesRegex(ValueError, '^INVALID_WAKE_SECRET$'):
                m.configuration({'WORKER_WAKE_SECRET': key})
        self.assertEqual(m.configuration({}), (10000, '', False))
        with self.assertRaisesRegex(ValueError, '^INVALID_WAKE_SECRET$'):
            m.configuration({'TEACHER_FREE_WORKER_ENABLED':'true'})
        for port in ('0', '65536', '-1', '10000x', ' 80', '1e3'):
            with self.assertRaisesRegex(ValueError, '^INVALID_PORT$'):
                m.configuration({'WORKER_WAKE_SECRET': KEY, 'PORT': port})

    def test_child_environment_excludes_wake_and_python_injection(self):
        r = m.ProcessRunner({'WORKER_WAKE_SECRET': KEY, 'QWEN_API_KEY': 'fake',
                             'PYTHONPATH': '/tmp/untrusted', 'LD_PRELOAD': 'bad',
                             'TEACHER_FREE_WORKER_ENABLED': 'true', 'HOME': '/home/worker'})
        self.assertEqual(r.env, {'QWEN_API_KEY': 'fake', 'HOME': '/home/worker'})
        # The author switch and the selected provider's own credential pass; nothing else does.
        r = m.ProcessRunner({'WORKER_WAKE_SECRET': KEY, 'TEACHER_AUTHOR_PROVIDER': 'gemini', 'GEMINI_API_KEY': 'fake',
                             'GEMINI_MODEL': 'model', 'GEMINI_BASE_URL': 'https://example.invalid', 'GOOGLE_API_KEY': 'other'})
        self.assertEqual(r.env, {'TEACHER_AUTHOR_PROVIDER': 'gemini', 'GEMINI_API_KEY': 'fake', 'GEMINI_MODEL': 'model'})

    def test_preflight_requires_all_no_side_effect_flags(self):
        proof = {'event': 'worker_preflight_pass', 'claimVerified': False,
                 'providerCalled': False, 'heartbeatWritten': False}
        self.assertTrue(m.preflight_pass(json.dumps(proof)))
        for field in ('claimVerified', 'providerCalled', 'heartbeatWritten'):
            self.assertFalse(m.preflight_pass(json.dumps({**proof, field: True})))
            self.assertFalse(m.preflight_pass(json.dumps({k:v for k,v in proof.items() if k != field})))
        self.assertFalse(m.preflight_pass(b'not-json'))


class SupervisorTests(unittest.TestCase):
    def test_startup_and_disabled_wake_do_nothing(self):
        r = FakeRunner(); s = m.Supervisor(enabled=False, runner=r)
        self.assertEqual(s.wake(), (503, {'ok':False, 'state':'disabled'}))
        self.assertEqual(r.calls, [])
        s.shutdown()
        self.assertEqual(s.wake()[1]['state'], 'draining')

    def test_concurrent_wakes_are_singleflight_and_extend_window(self):
        now = [100.0]; r = FakeRunner(); s = m.Supervisor(enabled=True, runner=r, clock=lambda:now[0])
        self.assertEqual(s.wake()[0], 202); self.assertTrue(r.started.wait(1))
        threads = [threading.Thread(target=s.wake) for _ in range(20)]
        for t in threads: t.start()
        for t in threads: t.join()
        self.assertEqual(r.calls, [False]); self.assertEqual(r.peak, 1)
        now[0] = 110; self.assertEqual(s.wake()[1]['state'], 'running')
        self.assertEqual(s.until, 170)
        now[0] = 171; r.finish.set()
        with patch.object(m, 'POLL_SECONDS', 0.01): settle(s)
        self.assertEqual(r.calls, [False])

    def test_expired_window_cannot_start_another_cycle(self):
        now=[0]; r=FakeRunner(); s=m.Supervisor(enabled=True,runner=r,clock=lambda:now[0])
        with patch.object(m, 'POLL_SECONDS', 0.01):
            s.wake(); self.assertTrue(r.started.wait(1)); now[0]=61; r.finish.set(); settle(s)
        self.assertEqual(r.calls,[False]); self.assertIsNone(s.thread)

    def test_failed_cycle_has_no_automatic_retry(self):
        r=FakeRunner(False); s=m.Supervisor(enabled=True,runner=r)
        s.wake(); r.finish.set(); settle(s)
        self.assertEqual(r.calls,[False]); self.assertEqual(s.until,0)

    def test_post_enqueue_wake_survives_an_older_child_failure(self):
        now=[100.0]; queued=[]; consumed=[]; started=threading.Event(); finish=threading.Event()
        class Runner:
            calls=0
            def run(self,check,stop):
                self.calls+=1
                if self.calls==1:
                    started.set(); self.assert_finished=finish.wait(1)
                    return False
                consumed.extend(queued);queued.clear();now[0]=162.0
                return True
        r=Runner();s=m.Supervisor(enabled=True,runner=r,clock=lambda:now[0])
        with patch.object(m,'POLL_SECONDS',0.01):
            s.wake();self.assertTrue(started.wait(1));now[0]=101.0
            queued.append('one-unique-job')
            self.assertEqual(s.wake(),(202,{'ok':True,'state':'running'}));self.assertEqual(s.until,161.0)
            finish.set();settle(s)
        self.assertTrue(r.assert_finished);self.assertEqual(r.calls,2);self.assertEqual(consumed,['one-unique-job']);self.assertEqual(queued,[])
        self.assertIsNone(s.thread)

    def test_new_wake_grants_one_attempt_not_an_unbounded_failure_retry(self):
        r=FakeRunner(False);s=m.Supervisor(enabled=True,runner=r)
        with patch.object(m,'POLL_SECONDS',0.01):
            s.wake();self.assertTrue(r.started.wait(1));self.assertEqual(s.wake()[0],202)
            r.finish.set();settle(s)
        self.assertEqual(r.calls,[False,False]);self.assertEqual(s.until,0);self.assertIsNone(s.thread)

    def test_new_wake_cannot_extend_its_deadline_by_failing_later(self):
        now=[100.0];r=FakeRunner(False);s=m.Supervisor(enabled=True,runner=r,clock=lambda:now[0])
        s.wake();self.assertTrue(r.started.wait(1));now[0]=101.0;s.wake()
        self.assertEqual(s.until,161.0);now[0]=162.0;r.finish.set();settle(s)
        self.assertEqual(r.calls,[False]);self.assertEqual(s.until,0);self.assertIsNone(s.thread)

    def test_later_wake_near_deadline_is_not_lost_to_idle_pause(self):
        for old_ok in (False, True):
            with self.subTest(old_cycle_succeeded=old_ok):
                now=[100.0];started=threading.Event();finish=threading.Event();attempt_times=[]
                class Runner:
                    def run(self,check,stop):
                        attempt_times.append(now[0])
                        if len(attempt_times)==1:
                            started.set();finish.wait(1);return old_ok
                        now[0]=162.0
                        return False
                s=m.Supervisor(enabled=True,runner=Runner(),clock=lambda:now[0])
                real_wait=s.stop.wait
                def idle_wait(seconds):
                    now[0]+=seconds
                    return real_wait(0)
                with patch.object(s.stop,'wait',side_effect=idle_wait):
                    s.wake();self.assertTrue(started.wait(1));now[0]=101.0;s.wake()
                    now[0]=159.0;finish.set();settle(s)
                self.assertEqual(attempt_times,[100.0,159.0])
                self.assertIsNone(s.thread)

    def test_preflight_only_and_cached_then_expires(self):
        now=[1]; r=FakeRunner(); s=m.Supervisor(enabled=False,runner=r,clock=lambda:now[0])
        self.assertEqual(s.preflight()[0],202); self.assertTrue(r.started.wait(1))
        for _ in range(10): self.assertEqual(s.preflight()[1]['state'],'checking')
        self.assertEqual(r.calls,[True]); r.finish.set(); settle(s)
        self.assertEqual(s.preflight(),(200,{'ok':True,'state':'ready'}))
        now[0]=62; self.assertEqual(s.preflight()[0],202); settle(s)
        self.assertEqual(r.calls,[True,True])

    def test_preflight_never_overlaps_worker_and_shutdown_blocks_both(self):
        r=FakeRunner(); s=m.Supervisor(enabled=True,runner=r)
        s.wake(); self.assertTrue(r.started.wait(1))
        self.assertEqual(s.preflight(),(503,{'ok':False,'state':'busy'}))
        r.finish.set(); s.shutdown()
        self.assertEqual(s.preflight()[1]['state'],'draining')
        self.assertEqual(r.calls,[False])

    def test_wake_cannot_overlap_preflight(self):
        r=FakeRunner(); s=m.Supervisor(enabled=True,runner=r)
        s.preflight(); self.assertTrue(r.started.wait(1))
        self.assertEqual(s.wake()[1]['state'],'unavailable')
        r.finish.set(); settle(s); self.assertEqual(r.calls,[True])


class HTTPTests(unittest.TestCase):
    def setUp(self):
        self.runner=FakeRunner()
        self.supervisor=m.Supervisor(enabled=True,runner=self.runner)
        self.server=m.HTTPServer(('127.0.0.1',0),self.supervisor,KEY)
        self.thread=threading.Thread(target=self.server.serve_forever,kwargs={'poll_interval':0.01})
        self.thread.start()
    def tearDown(self):
        self.runner.finish.set(); self.supervisor.shutdown()
        self.server.shutdown(); self.server.server_close(); self.thread.join(1)
    def request(self,method,path,headers=(),body=b''):
        c=http.client.HTTPConnection('127.0.0.1',self.server.server_port,timeout=2)
        c.putrequest(method,path)
        for k,v in headers: c.putheader(k,v)
        c.endheaders(body)
        response=c.getresponse(); data=response.read(); result=(response.status,response.getheaders(),data)
        c.close(); return result
    def auth(self): return [('Authorization','Bearer '+KEY),('Content-Length','0')]

    def test_public_health_is_small_non_sensitive_and_no_child(self):
        status,headers,data=self.request('GET','/healthz')
        self.assertEqual(status,200); self.assertEqual(json.loads(data),{'ok':True})
        self.assertEqual(self.runner.calls,[])
        self.assertIn(('Cache-Control','no-store'),headers)
        self.assertFalse(any(k.lower().startswith('access-control') for k,v in headers))

    def test_only_empty_authenticated_post_can_wake(self):
        status,_,data=self.request('POST','/wake',self.auth())
        self.assertEqual(status,202); self.assertEqual(json.loads(data),{'ok':True,'state':'starting'})
        self.assertTrue(self.runner.started.wait(1)); self.assertEqual(self.runner.calls,[False])

    def test_anonymous_invalid_duplicate_auth_never_wake(self):
        for headers in ([],[('Authorization','Bearer '+'b'*64)],self.auth()+[('Authorization','Bearer '+KEY)]):
            self.assertEqual(self.request('POST','/wake',headers)[0],401)
        self.assertEqual(self.runner.calls,[])

    def test_secretless_disabled_deploy_serves_health_but_cannot_authenticate(self):
        self.server.key = ''
        self.supervisor.enabled = False
        self.assertEqual(self.request('GET','/healthz')[0],200)
        for path in ('/wake','/preflight'):
            self.assertEqual(self.request('POST',path,[('Authorization','Bearer '),('Content-Length','0')])[0],401)
        self.assertEqual(self.runner.calls,[])

    def test_origin_body_transfer_and_duplicate_lengths_rejected(self):
        bad=[(self.auth()+[('Origin','https://example.com')],b'',403),
             ([('Authorization','Bearer '+KEY),('Content-Length','2')],b'{}',400),
             (self.auth()+[('Transfer-Encoding','chunked')],b'0\r\n\r\n',400),
             (self.auth()+[('Content-Length','0')],b'',400)]
        for headers,body,status in bad:
            self.assertEqual(self.request('POST','/wake',headers,body)[0],status)
        self.assertEqual(self.runner.calls,[])

    def test_query_unknown_paths_and_wrong_methods_do_not_work(self):
        for method,path,status in [('GET','/wake',404),('POST','/wake?command=x',404),
                                   ('POST','/anything',404),('OPTIONS','/wake',405),('PUT','/wake',405)]:
            self.assertEqual(self.request(method,path,self.auth())[0],status)
        self.assertEqual(self.runner.calls,[])

    def test_preflight_is_async_and_never_a_wake(self):
        self.assertEqual(self.request('POST','/preflight',self.auth())[0],202)
        self.assertTrue(self.runner.started.wait(1)); self.assertEqual(self.runner.calls,[True])
        self.runner.finish.set(); settle(self.supervisor)
        status,_,data=self.request('POST','/preflight',self.auth())
        self.assertEqual(status,200); self.assertEqual(json.loads(data),{'ok':True,'state':'ready'})
        self.assertEqual(self.runner.calls,[True])


class FakeProcess:
    def __init__(self,data=b'',running=False):
        self.stdout=io.BytesIO(data); self.returncode=0; self.pid=77777
        self.running=running; self.signals=[]
    def poll(self): return None if self.running else self.returncode
    def send_signal(self,sig): self.signals.append(sig)
    def wait(self,timeout=None): self.running=False; return self.returncode


class ProcessTests(unittest.TestCase):
    def test_fixed_worker_command_no_shell_and_sanitized_environment(self):
        fake=FakeProcess()
        with patch.object(m.subprocess,'Popen',return_value=fake) as spawn,patch.object(m.os,'killpg'):
            self.assertTrue(m.ProcessRunner({'HOME':'/home/worker','WORKER_WAKE_SECRET':KEY}).run(False,threading.Event()))
        args,kwargs=spawn.call_args
        self.assertEqual(args[0],[m.sys.executable,'-B','/opt/noam/app/remote_worker.py','--once','--work-dir','/work/jobs'])
        self.assertEqual(kwargs['env'],{'HOME':'/home/worker'}); self.assertTrue(kwargs['start_new_session'])
        self.assertNotIn('shell',kwargs)

    def test_fixed_preflight_bounded_proof_and_nonzero_fail_closed(self):
        proof=json.dumps({'event':'worker_preflight_pass','claimVerified':False,'providerCalled':False,'heartbeatWritten':False}).encode()
        for data,code,expected in [(proof,0,True),(b'x'*4097,0,False),(proof,1,False),(b'{}',0,False)]:
            fake=FakeProcess(data); fake.returncode=code
            with patch.object(m.subprocess,'Popen',return_value=fake) as spawn,patch.object(m.os,'killpg'):
                self.assertEqual(m.ProcessRunner({}).run(True,threading.Event()),expected)
                self.assertEqual(spawn.call_args.args[0][-1],'--check-only')

    def test_deadline_sends_term_only_to_worker_then_kills_group(self):
        fake=FakeProcess(running=True); ticks=iter([0,746,777])
        with patch.object(m.subprocess,'Popen',return_value=fake),patch.object(m.os,'killpg') as kill, \
             patch.object(m.time,'monotonic',side_effect=lambda:next(ticks)),patch.object(m.time,'sleep'):
            self.assertFalse(m.ProcessRunner({}).run(False,threading.Event()))
        self.assertEqual(fake.signals,[signal.SIGTERM])
        kill.assert_called_with(fake.pid,signal.SIGKILL)

    def test_stop_before_launch_never_starts_child(self):
        stop=threading.Event(); stop.set()
        with patch.object(m.subprocess,'Popen') as spawn:
            self.assertFalse(m.ProcessRunner({}).run(False,stop)); spawn.assert_not_called()

    def test_shutdown_during_owned_work_drains_parent_before_group_cleanup(self):
        stop=threading.Event(); fake=FakeProcess(running=True); ticks=iter([0,1,32])
        def running():
            stop.set()
            return None if fake.running else 0
        fake.poll=running
        with patch.object(m.subprocess,'Popen',return_value=fake),patch.object(m.os,'killpg') as kill, \
             patch.object(m.time,'monotonic',side_effect=lambda:next(ticks)),patch.object(m.time,'sleep'):
            self.assertFalse(m.ProcessRunner({}).run(False,stop))
        self.assertEqual(fake.signals,[signal.SIGTERM])
        kill.assert_called_with(fake.pid,signal.SIGKILL)


if __name__=='__main__': unittest.main()
