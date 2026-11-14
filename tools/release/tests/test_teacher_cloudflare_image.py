import hashlib
import importlib.util
import io
import json
from pathlib import Path
import sys
import tarfile
import tempfile
import unittest
import zipfile
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
import teacher_cloudflare_image as image
spec=importlib.util.spec_from_file_location('image_guard',ROOT/'teacher-cloudflare-release.py')
guard=importlib.util.module_from_spec(spec);spec.loader.exec_module(guard)
SHA='1'*40


def fixture(root, *, source=SHA, architecture='amd64', extra=None):
    blobs={}
    def blob(data):
        value=json.dumps(data,separators=(',',':')).encode() if not isinstance(data,bytes) else data
        digest='sha256:'+hashlib.sha256(value).hexdigest();blobs['blobs/sha256/'+digest[7:]]=value
        return {'digest':digest,'size':len(value)}
    config=blob({'os':'linux','architecture':architecture,'config':{'Labels':{'org.opencontainers.image.revision':source}}})
    layer=blob(b'fixed-layer-fixture')
    manifest={'schemaVersion':2,'mediaType':'application/vnd.oci.image.manifest.v1+json','config':config,'layers':[layer]}
    desc=blob(manifest);desc['mediaType']='application/vnd.oci.image.manifest.v1+json'
    files={'oci-layout':b'{"imageLayoutVersion":"1.0.0"}',
           'index.json':json.dumps({'schemaVersion':2,'manifests':[desc]}).encode(),**blobs}
    if extra:files.update(extra)
    tar=root/'image.tar'
    with tarfile.open(tar,'w') as archive:
        for name,value in files.items():
            member=tarfile.TarInfo(name);member.size=len(value);archive.addfile(member,io.BytesIO(value))
    params={'archive_sha':image.hash_file(tar),'archive_bytes':tar.stat().st_size,'image_digest':desc['digest'],'source_sha':SHA}
    return tar,params,blobs['blobs/sha256/'+desc['digest'][7:]]


class ImageTests(unittest.TestCase):
    def test_exact_oci_hashes_source_platform_and_safe_extraction(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);tar,params,_=fixture(root)
            proof=image.inspect_archive(tar,**params,extract_to=root/'layout')
            self.assertEqual(proof['sourceSha'],SHA)
            self.assertEqual((root/'layout').stat().st_mode&0o077,0)
            self.assertEqual((root/'layout/index.json').stat().st_mode&0o077,0)

    def test_source_platform_and_archive_changes_rejected(self):
        for options in [{'source':'2'*40},{'architecture':'arm64'}]:
            with self.subTest(options=options),tempfile.TemporaryDirectory() as d:
                tar,params,_=fixture(Path(d),**options)
                with self.assertRaises(image.ImageError):image.inspect_archive(tar,**params)
        with tempfile.TemporaryDirectory() as d:
            tar,params,_=fixture(Path(d));tar.write_bytes(tar.read_bytes()+b'x')
            with self.assertRaises(image.ImageError):image.inspect_archive(tar,**params)

    def test_paths_unreferenced_blobs_and_links_rejected(self):
        for extra in [{'../escape':b'x'},{'/absolute':b'x'},{'secrets.txt':b'x'},
                      {'blobs/sha256/'+hashlib.sha256(b'orphan').hexdigest():b'orphan'}]:
            with self.subTest(extra=list(extra)),tempfile.TemporaryDirectory() as d:
                tar,params,_=fixture(Path(d),extra=extra)
                with self.assertRaises(image.ImageError):image.inspect_archive(tar,**params)
        with tempfile.TemporaryDirectory() as d:
            tar,params,_=fixture(Path(d))
            with tarfile.open(tar,'a') as archive:
                member=tarfile.TarInfo('blobs/sha256/'+'8'*64);member.type=tarfile.SYMTYPE;member.linkname='/etc/passwd';archive.addfile(member)
            params.update(archive_sha=image.hash_file(tar),archive_bytes=tar.stat().st_size)
            with self.assertRaises(image.ImageError):image.inspect_archive(tar,**params)

    def test_image_phase_requires_explicit_temporary_credential_grant(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);tar,params,_=fixture(root);p=self.plan(params)
            self.assertEqual(guard.validate_plan(p,SHA),guard.digest(p))
            c=self.context(p);c['temporaryRegistryCredentialsApproved']=False
            with self.assertRaises(guard.GuardError):guard.validate_context(c,p,guard.digest(p))

    def plan(self,params):
        return {'version':1,'target':'teacher-cloudflare','phase':'image-push','sourceSha':SHA,
            'accountId':guard.ACCOUNT,'workerName':'noam-teacher-generation',
            'imageRef':f'registry.cloudflare.com/{guard.ACCOUNT}/teacher@'+params['image_digest'],
            'doClass':'TeacherGenerationContainer','singletonName':'primary','buildRunId':123,
            'archiveSha256':params['archive_sha'],'archiveBytes':params['archive_bytes'],
            'craneSha256':hashlib.sha256(b'fake-reviewed-tool').hexdigest()}

    def context(self,p):
        return {'planSha256':guard.digest(p),'approved':True,'approvalReference':'explicit test approval',
            'accountId':guard.ACCOUNT,'workersPaidConfirmed':True,'spendingApproved':True,
            'temporaryRegistryCredentialsApproved':True,'checkedAt':guard.utcnow().isoformat()}

    def test_ci_evidence_must_match_source_workflow_and_archive(self):
        with tempfile.TemporaryDirectory() as d:
            tar,params,_=fixture(Path(d));p=self.plan(params)
            metadata={'sourceSha':SHA,'archiveSha256':p['archiveSha256'],'archiveBytes':p['archiveBytes'],'imageDigest':params['image_digest']}
            def make_zip(data):
                stream=io.BytesIO()
                with zipfile.ZipFile(stream,'w') as z:z.writestr('image-metadata.json',json.dumps(data))
                return stream.getvalue()
            def run(args,**kwargs):
                suffix=args[-1]
                if suffix.endswith('/123'):value={'head_sha':SHA,'conclusion':'success','status':'completed','path':'.github/workflows/teacher-generation-cloud.yml'}
                elif suffix.endswith('/artifacts'):value={'artifacts':[{'name':'teacher-cloud-qualification-'+SHA,'expired':False,'size_in_bytes':1000,'id':456}]}
                elif suffix.endswith('/456/zip'):return type('Result',(),{'returncode':0,'stdout':make_zip(metadata)})()
                else:raise AssertionError(suffix)
                return type('Result',(),{'returncode':0,'stdout':json.dumps(value).encode()})()
            with patch.object(guard.subprocess,'run',run):
                self.assertEqual(guard.verify_ci_image(p)['runId'],123)
                metadata['sourceSha']='5'*40
                with self.assertRaises(guard.GuardError):guard.verify_ci_image(p)

    def test_mock_upload_private_auth_cleanup_and_remote_digest(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);tar,params,manifest=fixture(root);p=self.plan(params);c=self.context(p)
            crane=root/'crane';crane.write_bytes(b'fake-reviewed-tool');ledger=root/'image-ledger.json';calls=[];private_auth=[]
            class Adapter:
                def fresh_context(self,c):return c
                def command(self,*args):
                    if args==('whoami',):return guard.ACCOUNT
                    assert json.loads(ledger.read_text())['state']=='in_progress'
                    assert '--expiration-minutes' in args and '15' in args
                    return json.dumps({'username':'temporary-user','password':'private-test-password'})
            def run(args,**kwargs):
                calls.append(args);self.assertNotIn('private-test-password',' '.join(args))
                if args[1]=='version':stdout=b'0.22.1\n'
                elif args[1]=='push':
                    auth=Path(kwargs['env']['DOCKER_CONFIG'])/'config.json';private_auth.append(auth)
                    self.assertEqual(auth.stat().st_mode&0o077,0);self.assertTrue(auth.exists());stdout=p['imageRef'].encode()
                elif args[1]=='digest':stdout=params['image_digest'].encode()
                elif args[1]=='manifest':stdout=manifest
                else:raise AssertionError(args)
                return type('Result',(),{'returncode':0,'stdout':stdout})()
            with patch.object(guard.subprocess,'run',run):
                result=guard.execute_image(p,c,Adapter(),ledger,tar,crane,{'runId':123})
            self.assertEqual(result['state'],'image_verified')
            self.assertFalse(private_auth[0].exists())
            self.assertNotIn('private-test-password',ledger.read_text())
            self.assertEqual([c[1] for c in calls],['version','push','digest','manifest'])


if __name__=='__main__':unittest.main()
