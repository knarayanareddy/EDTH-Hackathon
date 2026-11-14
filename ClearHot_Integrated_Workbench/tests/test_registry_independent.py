# Tests registry policy without PyTorch. Fake report_csv only; no training/inference exercised.
import sys, types, tempfile, unittest
from pathlib import Path
fake=types.ModuleType('clearhot_cnn.evaluate');fake.report_csv=lambda r:'report\n';sys.modules['clearhot_cnn.evaluate']=fake
from clearhot_cnn.registry import Registry
from clearhot_cnn.common import ClearHotError
class RegistryChecks(unittest.TestCase):
 def test_approval_identity_and_rollback(self):
  with tempfile.TemporaryDirectory() as d:
   r=Registry(d);info={'weights_sha256':'a'*64,'arch_sha256':'b'*64,'steps':1,'dataset':{'domain':'SYNTHETIC','version':'test'},'config':{},'code_sha256':'c'*64,'env':{}}
   a=r.register_candidate(b'synthetic-weights-not-a-model',info,simulated_demo=True)
   with self.assertRaises(ClearHotError):r.register_candidate(b'synthetic-weights-not-a-model',info)
   with self.assertRaises(ClearHotError):r.approve_and_promote(a,'test','not validated',a)
   report={'split':'val','all_mandatory_passed':True,'failed_gates':[],'dataset':{'version':'test'},'gates_config_is_test_only':True,'created':'test'}
   r.attach_validation(a,report);r.approve_and_promote(a,'tester','synthetic demo only',a);self.assertEqual(r.active()[0],a)
   # Flip record status without updating pointer: reject rather than relabel a candidate active.
   record=r.record(a);record['status']='candidate';r._save(a,record)
   with self.assertRaisesRegex(ClearHotError,'inconsistent'):r.active()
   record['status']='active';r._save(a,record)
   Path(r.checkpoint_path(a)).chmod(0o644);Path(r.checkpoint_path(a)).write_bytes(b'tampered')
   with self.assertRaisesRegex(ClearHotError,'modified'):r.active()
 def test_explicit_failure_cannot_promote(self):
  with tempfile.TemporaryDirectory() as d:
   r=Registry(d);info={'weights_sha256':'a'*64,'arch_sha256':'b'*64,'steps':1,'dataset':{'domain':'SYNTHETIC','version':'test'},'config':{},'code_sha256':'c'*64,'env':{}}
   a=r.register_candidate(b'candidate',info,simulated_demo=True)
   report={'split':'val','all_mandatory_passed':False,'failed_gates':['thin_feature_missing'],'dataset':{'version':'test'},'gates_config_is_test_only':False,'created':'test'}
   r.attach_validation(a,report)
   with self.assertRaises(ClearHotError):r.approve_and_promote(a,'test','failed gate',a)
   self.assertEqual(r.active(),(None,None))
if __name__=='__main__':unittest.main()
