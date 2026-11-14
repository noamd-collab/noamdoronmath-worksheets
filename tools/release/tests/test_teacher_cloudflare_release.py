import copy
from datetime import datetime, timezone, timedelta
import importlib.util
import json
from pathlib import Path
import tempfile
from unittest.mock import patch
import unittest

PATH = Path(__file__).resolve().parents[1] / 'teacher-cloudflare-release.py'
spec = importlib.util.spec_from_file_location('cloud_guard', PATH)
guard = importlib.util.module_from_spec(spec); spec.loader.exec_module(guard)
NOW = datetime(2026, 11, 14, 12, tzinfo=timezone.utc)
SHA = '1' * 40
VERSION = '12345678-1234-1234-1234-123456789abc'


def plan(phase='preflight'):
    return {'version': 1, 'target': 'teacher-cloudflare', 'phase': phase, 'sourceSha': SHA,
            'accountId': guard.ACCOUNT, 'workerName': 'noam-teacher-generation',
            'imageRef': f'registry.cloudflare.com/{guard.ACCOUNT}/teacher@sha256:'+'2'*64,
            'doClass': 'TeacherGenerationContainer', 'singletonName': 'primary'}


def context(p):
    return {'planSha256': guard.digest(p), 'approved': True, 'approvalReference': 'explicit operator approval of this plan',
            'accountId': guard.ACCOUNT, 'workersPaidConfirmed': True, 'spendingApproved': True,
            'checkedAt': NOW.isoformat(), 'activeJobs': 0, 'queueCheckedAt': NOW.isoformat(),
            'newWorkerConfirmed': True, 'oldWorkerStopped': True, 'oldWorkerStoppedCheckedAt': NOW.isoformat()}


def proof(p):
    return {'schemaVersion':1,'sourceSha':p['sourceSha'],'imageRef':p['imageRef'],
            'versionId': VERSION, 'doId': '3'*64, 'mode': 'disabled', 'running':False,
            'preflight':{'status':'PASS','sourceSha':p['sourceSha'],'imageRef':p['imageRef'],
                         'observedImage':p['imageRef'],'versionId':VERSION,'checkedAt':NOW.isoformat(),
                         'claimVerified':False,'providerCalled':False,'heartbeatWritten':False}}


def secret_fixture():
    return {'TEACHER_CLOUD_OPERATOR_KEY': 'a'*64,
            'TEACHER_GENERATION_SERVICE_KEY': 'fixture-service-not-a-secret',
            'QWEN_API_KEY': 'fixture-provider-not-a-secret',
            'QWEN_BASE_URL': 'https://example.invalid/v1', 'QWEN_MODEL': 'fixture-model'}


class GuardTests(unittest.TestCase):
    def test_only_exact_account_digest_and_source(self):
        p=plan(); self.assertEqual(guard.validate_plan(p,SHA),guard.digest(p))
        for field,value in [('accountId','4'*32),('imageRef','registry.cloudflare.com/teacher:latest'),
                            ('sourceSha','4'*40),('workerName','other-worker')]:
            q=copy.deepcopy(p); q[field]=value
            with self.subTest(field=field),self.assertRaises(guard.GuardError): guard.validate_plan(q,SHA)

    def test_no_paid_or_approval_assumption(self):
        p=plan()
        for field,value in [('approved',False),('spendingApproved',False),('workersPaidConfirmed',False),
                            ('planSha256','9'*64),('checkedAt',(NOW-timedelta(minutes=6)).isoformat())]:
            c=context(p);c[field]=value
            with self.subTest(field=field),self.assertRaises(guard.GuardError):guard.validate_context(c,p,guard.digest(p),NOW)

    def test_activation_requires_fresh_empty_queue_and_stop(self):
        p=plan('activate');guard.validate_context(context(p),p,guard.digest(p),NOW)
        for field,value in [('activeJobs',1),('activeJobs',False),('oldWorkerStopped',False),
                            ('queueCheckedAt',(NOW-timedelta(seconds=91)).isoformat()),
                            ('oldWorkerStoppedCheckedAt',(NOW+timedelta(seconds=1)).isoformat())]:
            c=context(p);c[field]=value
            with self.subTest(field=field),self.assertRaises(guard.GuardError):guard.validate_context(c,p,guard.digest(p),NOW)

    def test_runtime_proof_binds_version_image_and_nonclaim(self):
        p=plan();guard.validate_proof(proof(p),p,VERSION,now=NOW)
        for field,value in [('versionId','7'*36),('imageRef',p['imageRef'][:-1]+'a'),
                            ('mode','active'),('running',True),('doId','')]:
            q=proof(p);q[field]=value
            with self.subTest(field=field),self.assertRaises(guard.GuardError):guard.validate_proof(q,p,VERSION,now=NOW)
        for field,value in [('claimVerified',True),('providerCalled',True),('heartbeatWritten',True),
                            ('observedImage',''),('checkedAt',(NOW-timedelta(seconds=91)).isoformat())]:
            q=proof(p);q['preflight'][field]=value
            with self.subTest(field=field),self.assertRaises(guard.GuardError):guard.validate_proof(q,p,VERSION,now=NOW)

    def test_uncertain_ledger_cannot_fall_back(self):
        p=plan('activate')
        for previous in [None,{'target':'wix-production','state':'success'},
                         {'target':'teacher-cloudflare','state':'uncertain'},
                         {'target':'teacher-cloudflare','state':'active'}]:
            with self.subTest(previous=previous),self.assertRaises(guard.GuardError):guard.validate_previous(previous,p)

    def test_activation_cannot_switch_source_or_image(self):
        p=plan('activate');old={'target':'teacher-cloudflare','state':'preflight_verified','identity':guard.identity(p)}
        guard.validate_previous(old,p)
        q=copy.deepcopy(p);q['imageRef']=q['imageRef'][:-1]+'a'
        with self.assertRaises(guard.GuardError):guard.validate_previous(old,q)

    def test_pending_record_precedes_provider_and_failure_is_durable(self):
        p=plan()
        with tempfile.TemporaryDirectory() as tmp:
            ledger=Path(tmp)/'state.json'
            class Adapter:
                def deploy_disabled(self,plan):
                    self.record=json.loads(ledger.read_text())
                    assert self.record['state']=='in_progress'
                    raise RuntimeError('simulated provider failure')
            adapter=Adapter()
            with self.assertRaises(RuntimeError):guard.execute(p,context(p),adapter,ledger,now=NOW)
            self.assertEqual(json.loads(ledger.read_text())['state'],'uncertain')
            self.assertEqual(ledger.stat().st_mode&0o077,0)

    def test_no_provider_action_if_gate_missing(self):
        with tempfile.TemporaryDirectory() as tmp:
            ledger=Path(tmp)/'state.json';p=plan();c=context(p);c['approved']=False
            with self.assertRaises(guard.GuardError):guard.execute(p,c,object(),ledger,now=NOW)
            self.assertFalse(ledger.exists())

    def test_complete_two_phase_flow_has_no_redeploy_or_tick_on_activation(self):
        class Adapter:
            def __init__(self):self.calls=[]
            def deploy_disabled(self,p):self.calls.append('deploy');return 'https://noam-teacher-generation.example.workers.dev'
            def active_version(self,p):self.calls.append('version');return VERSION
            def preflight(self,p):self.calls.append('preflight');return proof(p)
            def use_origin(self,origin,p):self.calls.append('origin')
            def status(self,p):self.calls.append('status');return proof(p)
            def fresh_context(self,c):self.calls.append('context');return c
            def activate(self,p,v):
                self.calls.append('activate');q=proof(p);q.update(mode='active',approved={
                    'sourceSha':p['sourceSha'],'imageRef':p['imageRef'],'activatedAt':NOW.isoformat()});return q
        with tempfile.TemporaryDirectory() as tmp:
            ledger=Path(tmp)/'state.json';a=Adapter();p=plan()
            r=guard.execute(p,context(p),a,ledger,now=NOW)
            self.assertEqual(r['state'],'preflight_verified')
            self.assertEqual(a.calls,['deploy','version','preflight','version'])
            p=plan('activate');a.calls=[];r=guard.execute(p,context(p),a,ledger,now=NOW)
            self.assertEqual(r['state'],'active')
            self.assertEqual(a.calls,['origin','version','status','context','activate','version'])
            with self.assertRaises(guard.GuardError):guard.execute(p,context(p),a,ledger,now=NOW)

    def test_queue_context_is_reread_before_activation(self):
        class Adapter:
            activated=False
            def use_origin(self,*args):pass
            def active_version(self,p):return VERSION
            def status(self,p):return proof(p)
            def fresh_context(self,c):return {**c,'activeJobs':1}
            def activate(self,*args):self.activated=True
        p=plan('activate')
        with tempfile.TemporaryDirectory() as tmp:
            ledger=Path(tmp)/'state.json'
            ledger.write_text(json.dumps({'target':'teacher-cloudflare','state':'preflight_verified',
                'identity':guard.identity(p),'workerOrigin':'https://noam-teacher-generation.example.workers.dev',
                'proof':{'doId':'3'*64,'versionId':VERSION}}))
            ledger.chmod(0o600)
            a=Adapter()
            with self.assertRaises(guard.GuardError):guard.execute(p,context(p),a,ledger,now=NOW)
            self.assertFalse(a.activated)
            self.assertEqual(json.loads(ledger.read_text())['state'],'uncertain')

    def test_replaced_do_or_version_prevents_activation(self):
        class Adapter:
            activated=False
            def use_origin(self,*args):pass
            def active_version(self,p):return VERSION
            def status(self,p):return proof(p)
            def activate(self,*args):self.activated=True
        p=plan('activate')
        for field,value in [('doId','4'*64),('versionId','43215678-1234-1234-1234-123456789abc')]:
            with self.subTest(field=field),tempfile.TemporaryDirectory() as tmp:
                ledger=Path(tmp)/'state.json';previous={'doId':'3'*64,'versionId':VERSION};previous[field]=value
                ledger.write_text(json.dumps({'target':'teacher-cloudflare','state':'preflight_verified',
                    'identity':guard.identity(p),'workerOrigin':'https://noam-teacher-generation.example.workers.dev','proof':previous}))
                ledger.chmod(0o600)
                a=Adapter()
                with self.assertRaises(guard.GuardError):guard.execute(p,context(p),a,ledger,now=NOW)
                self.assertFalse(a.activated)

    def test_private_lock_blocks_second_publisher(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)/'private'
            with guard.ledger_lock(root):
                with self.assertRaises(guard.GuardError):
                    with guard.ledger_lock(root):pass
            self.assertEqual(root.stat().st_mode&0o077,0)

    def test_malformed_operator_key_is_rejected_before_config_or_provider(self):
        for token in ['x'*64,'A'*64,'a'*63,'a'*65,'a'*64+'\n','']:
            with self.subTest(tokenLength=len(token)),tempfile.TemporaryDirectory() as tmp:
                with patch.dict(guard.os.environ,{'TEACHER_CLOUD_OPERATOR_KEY':token}):
                    with self.assertRaisesRegex(guard.GuardError,'OPERATOR_KEY_MUST_BE_LOWER_HEX_64'):
                        guard.WranglerAdapter(Path(tmp),plan(),Path(tmp)/'context',Path(tmp))

    def test_runtime_secrets_require_private_exact_matching_json(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp).resolve();repo=root/'repo';repo.mkdir();path=root/'runtime.json'
            values=secret_fixture()
            def write(value=values):
                path.write_text(json.dumps(value));path.chmod(0o600)
            write()
            self.assertEqual(guard.runtime_secrets(path,repo,'a'*64),values)
            for mode in (0o644,0o400,0o700):
                path.chmod(mode)
                with self.subTest(mode=mode),self.assertRaises(guard.GuardError):guard.runtime_secrets(path,repo,'a'*64)
            write()
            inside=repo/'runtime.json';inside.write_text(json.dumps(values));inside.chmod(0o600)
            link=root/'linked.json';link.symlink_to(path)
            for bad in (None,Path('relative.json'),inside,link):
                with self.subTest(path=str(bad)),self.assertRaises(guard.GuardError):guard.runtime_secrets(bad,repo,'a'*64)
            for changed in ({**values,'EXTRA':'not allowed'}, {k:v for k,v in values.items() if k!='QWEN_MODEL'},
                            {**values,'QWEN_MODEL':''}, {**values,'QWEN_MODEL':'x'*8193},
                            {**values,'QWEN_MODEL':'newline\n'}, {**values,'QWEN_MODEL':42},
                            {**values,'TEACHER_CLOUD_OPERATOR_KEY':'b'*64}):
                write(changed)
                with self.assertRaises(guard.GuardError):guard.runtime_secrets(path,repo,'a'*64)
            write();path.write_text(path.read_text()[:-1]+',"QWEN_MODEL":"duplicate"}')
            with self.assertRaisesRegex(guard.GuardError,'DUPLICATE_RUNTIME_SECRET'):guard.runtime_secrets(path,repo,'a'*64)

    def test_wrangler_environment_pins_destination_and_disables_sensitive_disk_logs(self):
        hostile={'WRANGLER_WRITE_LOGS':'true','WRANGLER_LOG_SANITIZE':'false',
                 'CLOUDFLARE_ENV':'other','CLOUDFLARE_API_BASE_URL':'https://example.invalid',
                 'CF_API_BASE_URL':'https://example.invalid','CLOUDFLARE_CONTAINER_REGISTRY':'evil.invalid',
                 'CLOUDFLARE_ACCOUNT_ID':'other','CLOUDFLARE_API_TOKEN':'fixture-auth','PATH':'fixture-path'}
        result=guard.wrangler_environment(hostile)
        self.assertEqual(result['WRANGLER_WRITE_LOGS'],'false');self.assertEqual(result['WRANGLER_LOG_SANITIZE'],'true')
        self.assertEqual(result['CLOUDFLARE_ACCOUNT_ID'],guard.ACCOUNT)
        self.assertEqual(result['CLOUDFLARE_API_TOKEN'],'fixture-auth')
        for key in ('CLOUDFLARE_ENV','CLOUDFLARE_API_BASE_URL','CF_API_BASE_URL','CLOUDFLARE_CONTAINER_REGISTRY'):
            self.assertNotIn(key,result)
        self.assertEqual(hostile['WRANGLER_WRITE_LOGS'],'true')
        adapter=object.__new__(guard.WranglerAdapter)
        adapter.node='node';adapter.cli=Path('/fixture/wrangler');adapter.config=Path('/fixture/config')
        adapter.cloud=Path('/fixture');adapter.env=result
        with patch.object(guard.subprocess,'run') as run:
            run.return_value.returncode=0;run.return_value.stdout='{}'
            adapter.command('containers','registries','credentials','registry.cloudflare.com','--json')
            self.assertEqual(run.call_args.kwargs['env'],result)

    def test_origin_and_private_secrets_are_bound_to_same_deploy_and_cleaned(self):
        with tempfile.TemporaryDirectory() as tmp:
            adapter=object.__new__(guard.WranglerAdapter);p=plan()
            adapter.config=Path(tmp)/'config.json';adapter._runtime_secrets=secret_fixture()
            seen=[]
            def command(*args):
                if args==('whoami',):return guard.ACCOUNT
                self.assertEqual(args[:2],('deploy','--secrets-file'))
                path=Path(args[2]);seen.append(path)
                self.assertEqual(path.stat().st_mode&0o777,0o600)
                self.assertEqual(json.loads(path.read_text()),secret_fixture())
                for value in secret_fixture().values():self.assertNotIn(value,args)
                return 'https://noam-teacher-generation.example.workers.dev'
            adapter.command=command
            self.assertEqual(adapter.deploy_disabled(p),'https://noam-teacher-generation.example.workers.dev')
            self.assertFalse(seen[-1].exists())
            def failure(*args):
                if args==('whoami',):return guard.ACCOUNT
                command(*args);raise guard.GuardError('SIMULATED_DEPLOY_FAILURE')
            adapter.command=failure
            with self.assertRaises(guard.GuardError):adapter.deploy_disabled(p)
            self.assertFalse(seen[-1].exists())
            adapter.command=lambda *args:guard.ACCOUNT if args==('whoami',) else 'https://evil.example'
            with self.assertRaises(guard.GuardError):adapter.deploy_disabled(p)
            self.assertEqual(list(Path(tmp).glob('.runtime-secrets-*')),[])

    def test_provider_status_requires_one_version_at_full_traffic(self):
        adapter=object.__new__(guard.WranglerAdapter)
        for versions in [[],[{'version_id':VERSION,'percentage':50}],
                         [{'version_id':VERSION,'percentage':100},{'version_id':VERSION,'percentage':0}]]:
            adapter.command=lambda *args:json.dumps({'versions':versions})
            with self.subTest(versions=versions),self.assertRaises(guard.GuardError):adapter.active_version(plan())
        adapter.command=lambda *args:json.dumps({'versions':[{'version_id':VERSION,'percentage':100}]})
        self.assertEqual(adapter.active_version(plan()),VERSION)

    def test_release_dispatch_does_not_touch_wix_default_body(self):
        shell=PATH.with_name('release.sh').read_text()
        self.assertLess(shell.index('teacher-cloudflare)'),shell.index('../.env'))
        self.assertIn('wix) ;;',shell)
        self.assertIn('Unknown RELEASE_TARGET',shell)


if __name__=='__main__':unittest.main()
