import copy
import importlib.util
import math
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('crop_curation', Path(__file__).resolve().parents[1] / 'scripts/apply-crop-curation.py')
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class CropCurationTests(unittest.TestCase):
    def setUp(self):
        first = dict(page=1, x=0, y=.1, w=1, h=.5)
        second = dict(page=2, x=0, y=.1, w=1, h=.1)
        self.m = dict(pdfHash='media', sourceSha256='source', exercises=[dict(id='7א', q=7, pin=dict(page=1, x=.8, y=.3), crops=[first, second], crop=copy.deepcopy(first), untouched='value')])
        self.patch = dict(level='a', question=7, page=1, exerciseIds=['7א'], expectedOldBottom=.6, operation='resize', trimBottomY=.7)
        self.r = dict(schema='crop-curation/1', levels=dict(a=dict(mediaId='media', sourceSha256='source')), trims=[self.patch])
    def run_case(self):
        return mod.apply_curation(self.m, self.r, 'a')[0]
    def test_extension_restores_lower_region_and_does_not_mutate_input(self):
        original=copy.deepcopy(self.m); out=self.run_case()
        self.assertEqual(out['exercises'][0]['crop']['h'],.6)
        self.assertEqual(self.m,original)
        self.assertEqual(out['exercises'][0]['untouched'],'value')
        self.assertEqual(out['exercises'][0]['pin'],original['exercises'][0]['pin'])
    def test_trim_keeps_own_pin(self):
        self.patch['trimBottomY']=.4
        self.assertEqual(self.run_case()['exercises'][0]['crops'][0]['h'],.3)
    def test_drop_foreign_only_page(self):
        self.patch.update(page=2,operation='drop',expectedOldBottom=.2)
        self.assertEqual(len(self.run_case()['exercises'][0]['crops']),1)
    def test_wrong_source_or_media_rejected(self):
        for key in ('sourceSha256','mediaId'):
            with self.subTest(key=key):
                old=self.r['levels']['a'][key];self.r['levels']['a'][key]='wrong'
                with self.assertRaises(ValueError):self.run_case()
                self.r['levels']['a'][key]=old
    def test_wrong_or_absent_id_rejected(self):
        for ids in ([],['7ב']):
            self.patch['exerciseIds']=ids
            with self.assertRaises(ValueError):self.run_case()
    def test_missing_question_rejected(self):
        self.patch['question']=99
        with self.assertRaises(ValueError):self.run_case()
    def test_duplicate_patch_rejected(self):
        self.r['trims'].append(copy.deepcopy(self.patch))
        with self.assertRaises(ValueError):self.run_case()
    def test_stale_crop_rejected(self):
        self.patch['expectedOldBottom']=.5
        with self.assertRaises(ValueError):self.run_case()
    def test_nonfinite_or_offpage_or_pin_clipping_rejected(self):
        for v in (math.nan,math.inf,1.1,-.1,.2):
            self.patch['trimBottomY']=v
            with self.subTest(bottom=v),self.assertRaises(ValueError):self.run_case()
    def test_own_pin_page_drop_rejected(self):
        self.patch['operation']='drop'
        with self.assertRaises(ValueError):self.run_case()
    def test_multiple_matching_slices_rejected(self):
        self.m['exercises'][0]['crops'].append(copy.deepcopy(self.m['exercises'][0]['crops'][0]))
        with self.assertRaises(ValueError):self.run_case()

if __name__=='__main__':unittest.main()
