import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

PATH = Path(__file__).resolve().parents[1] / 'teacher-free-host-probe.py'
spec = importlib.util.spec_from_file_location('probe', PATH)
probe = importlib.util.module_from_spec(spec); spec.loader.exec_module(probe)

class ProbeTests(unittest.TestCase):
    def sample(self):
        return {'memory.max': probe.MEMORY, 'memory.swap.max': 0, 'cpu.max': '10000 100000',
                'memory.peak': 300000000, 'memory.events': {'oom': 0, 'oom_kill': 0},
                'cpu.stat': {'usage_usec': 2000000, 'user_usec': 1500000, 'system_usec': 500000}}
    def test_rejects_missing_or_weaker_limits(self):
        self.assertTrue(probe.limits_match(self.sample()))
        for key,value in [('memory.max','max'),('memory.max',probe.MEMORY*2),('memory.swap.max',probe.MEMORY),
                          ('cpu.max','max 100000'),('cpu.max','20000 100000'),('cpu.max','10000 0')]:
            with self.subTest(key=key,value=value):self.assertFalse(probe.limits_match({**self.sample(),key:value}))
    def test_native_failure_oom_or_budget_cannot_pass(self):
        report={'ok':True,'elapsedSeconds':40};state={'Running':True,'OOMKilled':False}
        self.assertTrue(probe.successful(report,self.sample(),state))
        for r,s,d in [({**report,'ok':False},self.sample(),state),({**report,'elapsedSeconds':1200.1},self.sample(),state),
                      (report,{**self.sample(),'memory.peak':None},state),
                      (report,{**self.sample(),'memory.events':{'oom_kill':1}},state),
                      (report,self.sample(),{**state,'OOMKilled':True}),(report,self.sample(),{**state,'Running':False})]:
            self.assertFalse(probe.successful(r,s,d))
    def test_cgroup_snapshot_retains_cpu_and_oom_counters(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            for key,value in self.sample().items():
                (root/key).write_text('\n'.join(k+' '+str(v) for k,v in value.items()) if isinstance(value,dict) else str(value))
            result=probe.metrics(root)
            self.assertTrue(probe.limits_match(result))
            self.assertEqual(result['cpu.stat']['usage_usec'],2000000)
            self.assertEqual(result['memory.events']['oom_kill'],0)
            (root/'memory.peak').unlink();self.assertIsNone(probe.metrics(root)['memory.peak'])

if __name__=='__main__':unittest.main()
