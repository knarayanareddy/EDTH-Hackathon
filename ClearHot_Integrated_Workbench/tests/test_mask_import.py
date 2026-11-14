import hashlib, json, tempfile, unittest
from pathlib import Path
import numpy as np
from clearhot_cnn.data import import_real_pairs, load_split
from clearhot_cnn.common import ClearHotError

def sha(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()
class RealMaskImport(unittest.TestCase):
 def make(self, root):
  root=Path(root); recs=[]
  for ix,sp in enumerate(('train','val')):
   ip=root/f'{sp}_input.u16';tp=root/f'{sp}_target.u16';mp=root/f'{sp}_masks.npy'
   np.full((1,32,32), 6000+100*ix,dtype='<u2').tofile(ip);np.full((1,32,32), 6020+100*ix,dtype='<u2').tofile(tp)
   a=np.zeros((1,32,32),dtype=np.uint8);a[0,2:4,2]=1;a[0,6:8,6:8]=2;a[0,10:12,10:12]=4;np.save(mp,a)
   recs.append({'recording_id':sp,'split':sp,'input':{'path':str(ip),'sha256':sha(ip)},'target':{'path':str(tp),'sha256':sha(tp),'target_kind':'trusted_external_reference','same_count_domain':True,'alignment_attested':True},'pairs':[{'frame_index':0}], 'masks':{'path':str(mp),'sha256':sha(mp),'attested':True,'reviewer':'fixture'},'stripe_free_negative':True,'stripe_free_reviewer':'fixture','stripe_free_statement':'Synthetic unit test, deliberately stripe-free and not real evidence.'})
  m={'schema':'clearhot-real-pairs-v1','decoder':{'width':32,'height':32,'header_bytes':0,'shift':0,'little_endian':True,'bits':14},'attestation':{'attested':True,'reviewer':'fixture','statement':'Synthetic fixture trusted aligned pairs for unit testing only.'},'recordings':recs}; f=root/'manifest.json';f.write_text(json.dumps(m));return f,m
 def test_mask_and_negative_import(self):
  with tempfile.TemporaryDirectory() as d:
   f,_=self.make(d);m=import_real_pairs(f,Path(d)/'out',verbose=lambda *x:None);v=load_split(Path(d)/'out','val');self.assertTrue(m['masks_available']);self.assertEqual(v['meta'][0]['kind'],'nostripe_flat');self.assertEqual(set(np.unique(v['masks'])),{0,1,2,4})
   with self.assertRaises(ClearHotError):import_real_pairs(f,Path(d)/'out',verbose=lambda *x:None)
 def test_invalid_masks_and_missing_attestation_fail(self):
  with tempfile.TemporaryDirectory() as d:
   f,m=self.make(d);m['recordings'][1]['masks']['sha256']='0'*64;f.write_text(json.dumps(m))
   with self.assertRaisesRegex(ClearHotError,'mask full-file SHA-256 mismatch'):import_real_pairs(f,Path(d)/'bad',verbose=lambda *x:None)
   m['recordings'][1]['masks']['sha256']=sha(m['recordings'][1]['masks']['path']);m['recordings'][1]['stripe_free_reviewer']='';f.write_text(json.dumps(m))
   with self.assertRaisesRegex(ClearHotError,'stripe-free classification'):import_real_pairs(f,Path(d)/'bad2',verbose=lambda *x:None)
 def test_wrong_shape_fails(self):
  with tempfile.TemporaryDirectory() as d:
   f,m=self.make(d);p=Path(m['recordings'][1]['masks']['path']);np.save(p,np.zeros((1,31,32),dtype=np.uint8));m['recordings'][1]['masks']['sha256']=sha(p);f.write_text(json.dumps(m))
   with self.assertRaisesRegex(ClearHotError,'masks must be uint8'):import_real_pairs(f,Path(d)/'bad',verbose=lambda *x:None)
if __name__=='__main__':unittest.main()
