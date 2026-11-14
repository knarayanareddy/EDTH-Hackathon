# Exercise evaluator's pure gating without installing PyTorch or running a model.
import sys, types, unittest
fake=types.ModuleType('clearhot_cnn.model');fake.predict_counts=lambda *a,**k:None;sys.modules['clearhot_cnn.model']=fake
from clearhot_cnn.evaluate import evaluate_gates,DEFAULT_GATES
class GateChecks(unittest.TestCase):
 def test_missing_features_fail_closed(self):
  def m(mae):return {'finite':True,'mae_counts':mae,'false_correction_ratio':None,'line_retention':None,'target_retention':None,'ring_bias_ratio':None,'overshoot_p99_ratio':None,'clip_increase':0,'motion_err_counts':1}
  scenes=[{'scene_id':'fixture','kind':'real','methods':{'candidate':m(1),'raw':m(2),'argos2':m(2)}}]
  result=evaluate_gates(scenes,False,DEFAULT_GATES);status={x['name']:x['passed'] for x in result}
  for name in ['no_stripe_false_correction','line_retention_range','target_retention_range','max_ring_bias_ratio','max_overshoot_p99_ratio']:self.assertFalse(status[name],name)
if __name__=='__main__':unittest.main()
