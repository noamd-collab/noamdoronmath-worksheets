import copy
import json
import sys
import tempfile
import unittest
from pathlib import Path

HERE=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(HERE))
from validation import GenerationError, read_json, validate_model
from runner import verify_skill
from provider import qwen_chat_url, NoRedirects


class ValidationTests(unittest.TestCase):
    def setUp(self):
        self.lesson=read_json(HERE/'examples/elementary-lesson.json')
        self.lesson.update(version=2, lessonBoundary={'version':1,'kind':'division_facts','allowedDivisors':list(range(1,11)),'maxDividend':100})
        self.payload=read_json(HERE/'examples/elementary-model.json')

    def fails(self, code, payload=None, lesson=None):
        with self.assertRaises(GenerationError) as caught:
            validate_model(lesson or self.lesson,payload or self.payload)
        self.assertEqual(caught.exception.code,code)

    def test_fixtures(self):
        validate_model(self.lesson,self.payload)
        validate_model(read_json(HERE/'examples/middle-lesson.json'),read_json(HERE/'examples/middle-model.json'), allow_legacy=True)

    def test_learned_context_uses_same_120_character_boundary_as_web_intake(self):
        validate_model(dict(self.lesson, alreadyLearned=['א' * 120]), self.payload)
        self.fails('INVALID_LESSON', lesson=dict(self.lesson, alreadyLearned=['א' * 121]))

    def test_model_cannot_supply_code_html_paths_or_approvals(self):
        for field in ['python','html','svg','path','outputDir','approved','STRICT_FIGURES']:
            payload=copy.deepcopy(self.payload);payload[field]='__import__("os").system("id")'
            self.fails('INVALID_MODEL_OUTPUT',payload)

    def test_nested_injection_rejected(self):
        for value in ['<img src="file:///etc/passwd">','__import__("os")','../../target',True,float('inf')]:
            payload=copy.deepcopy(self.payload);payload['questions'][0]['items'][0]['left']=value
            self.fails('INVALID_MODEL_OUTPUT',payload)

    def test_wrong_answer_rejected(self):
        payload=copy.deepcopy(self.payload);payload['questions'][0]['items'][0]['answer']=9
        self.fails('WRONG_ANSWER',payload)

    def test_divide_zero_rejected(self):
        payload=copy.deepcopy(self.payload);payload['questions'][0]['items'][0]['right']=0
        self.fails('INVALID_MODEL_OUTPUT',payload)

    def test_unknown_topic_fails_closed(self):
        self.fails('UNSUPPORTED_TOPIC',lesson=dict(self.lesson,topicId='g8:systems_basic',gradeNumber=8))

    def test_no_silent_goal_or_volume_fallback(self):
        self.fails('UNSUPPORTED_GOAL',lesson=dict(self.lesson,lessonGoal='assessment'))
        self.fails('UNSUPPORTED_VOLUME',lesson=dict(self.lesson,questionCount=4,explicitShortSheet=True))
        self.fails('UNSUPPORTED_LEVEL',lesson=dict(self.lesson,level='e'))
        self.fails('UNSUPPORTED_LEVEL',lesson=dict(self.lesson,level='a'))

    def test_challenge_requires_changed_structure(self):
        payload=copy.deepcopy(self.payload);payload['questions'][0]['star']=True
        self.fails('UNSUPPORTED_CHALLENGE',payload)

    def test_operation_outside_topic_rejected(self):
        payload=copy.deepcopy(self.payload);payload['questions'][0]['items'][0]['op']='multiply'
        self.fails('INVALID_MODEL_OUTPUT',payload)

    def test_duplicate_json_fields_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)/'bad.json';p.write_text('{"version":1,"version":2}')
            with self.assertRaises(GenerationError):read_json(p)

    def test_skill_tampering_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(GenerationError) as caught:verify_skill('elementary',tmp)
            self.assertEqual(caught.exception.code,'SKILL_HASH_MISMATCH')

    def test_provider_allowlist_and_no_redirects(self):
        base='https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
        self.assertEqual(qwen_chat_url(base),base+'/chat/completions')
        for bad in ['https://example.com/compatible-mode/v1',base+'?key=x',base.replace('https:','http:'),'https://dashscope-intl.aliyuncs.com/other','https://dashscope-intl.aliyuncs.com.evil.example/compatible-mode/v1']:
            with self.assertRaises(GenerationError):qwen_chat_url(bad)
        self.assertIsNone(NoRedirects().redirect_request(None,None,302,'Found',{},'https://example.com'))


if __name__=='__main__':unittest.main()
