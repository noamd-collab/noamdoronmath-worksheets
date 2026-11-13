import json
import copy
from collections import Counter
from pathlib import Path
import ssl
import sys
import unittest
from unittest.mock import patch
from urllib.error import URLError

HERE=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(HERE))
import provider
from validation import GenerationError, read_json, validate_lesson, validate_model


class Response:
    def __init__(self,envelope):self.raw=json.dumps(envelope,ensure_ascii=False).encode()
    def __enter__(self):return self
    def __exit__(self,*args):pass
    def read(self,limit):return self.raw[:limit]


class ProviderTests(unittest.TestCase):
    def setUp(self):
        self.use_fixture('elementary')
        self.config={'api_key':'fixture-not-a-secret','base_url':'https://fixture.eu-central-1.maas.aliyuncs.com/compatible-mode/v1','model':'qwen3.8-flash'}

    def use_fixture(self,family):
        self.lesson=read_json(HERE/f'examples/{family}-lesson.json')
        self.cap=validate_lesson(self.lesson)
        source=read_json(HERE/f'examples/{family}-model.json')
        groups={kind:[] for kind in self.cap['questionKinds']}
        for q in source['questions']:groups[q['kind']].append(q)
        self.expected={'version':1,'questions':[{**groups[p['kind']].pop(0),'star':p['star']} for p in provider.question_plan(self.lesson,self.cap)]}
        self.payload={'version':2,'questions':[]}
        for q in self.expected['questions']:
            items=[{k:item[k] for k in ('a','b','solution')} if family=='middle' else {'divisor':item['right'],'quotient':item['answer']} for item in q['items']]
            self.payload['questions'].append({'items':items})

    def envelope(self,finish='stop'):
        return {'model':'qwen3.8-flash','usage':{'prompt_tokens':123,'completion_tokens':456,'total_tokens':579,'api_key':'must-not-survive','prompt_tokens_details':{'cached_tokens':0,'unsafe':'omit'}},'choices':[{'finish_reason':finish,'message':{'content':json.dumps(self.payload,ensure_ascii=False)}}]}

    def fail_author(self,expected_code='INVALID_MODEL_OUTPUT'):
        metadata={};original=copy.deepcopy(self.payload)
        with patch('provider.build_opener') as build:
            build.return_value.open.return_value=Response(self.envelope())
            with self.assertRaises(GenerationError) as caught:provider.author_lesson(self.lesson,metadata=metadata,**self.config)
            build.return_value.open.assert_called_once()
        self.assertEqual(caught.exception.code,expected_code)
        self.assertEqual(self.payload,original)
        self.assertFalse(metadata['validated'])
        self.assertEqual(metadata['validationError']['code'],expected_code)
        return metadata

    def test_certifi_context_requires_certificate_and_hostname_verification(self):
        context=provider.verified_tls_context()
        self.assertEqual(context.verify_mode,ssl.CERT_REQUIRED)
        self.assertTrue(context.check_hostname)
        self.assertGreater(len(context.get_ca_certs()),0)

    def test_author_constructs_canonical_from_parameters_without_network(self):
        for family in ('elementary','middle'):
            with self.subTest(family=family):
                self.use_fixture(family);metadata={};original=copy.deepcopy(self.payload)
                with patch('provider.build_opener') as build:
                    build.return_value.open.return_value=Response(self.envelope())
                    result=provider.author_lesson(self.lesson,metadata=metadata,**self.config)
                    body=json.loads(build.return_value.open.call_args.args[0].data)
                    self.assertFalse(body['enable_thinking'])
                    self.assertEqual(body['max_tokens'],14000)
                    self.assertEqual(body['response_format']['type'],'json_schema')
                    self.assertTrue(body['response_format']['json_schema']['strict'])
                    sent=json.loads(body['messages'][1]['content'])
                    self.assertEqual(set(sent['one_question_example_only']),{'items'})
                    self.assertEqual(len(sent['one_question_example_only']['items']),3)
                    build.return_value.open.assert_called_once()
                self.assertEqual(result,self.expected)
                self.assertEqual(self.payload,original)
                validate_model(self.lesson,result)
                self.assertTrue(metadata['validated'])
                self.assertEqual(metadata['authorContract'],'worksheet-parameters/2')
                self.assertTrue(metadata['derivation']['performed'])
                self.assertEqual(metadata['derivation']['canonicalVersion'],1)
                self.assertEqual(metadata['requestedModel'],'qwen3.8-flash')
                self.assertEqual(metadata['responseModel'],'qwen3.8-flash')
                self.assertEqual(metadata['usage']['total_tokens'],579)
                self.assertNotIn('api_key',metadata['usage'])
                self.assertNotIn('unsafe',metadata['usage']['prompt_tokens_details'])
                self.assertGreaterEqual(metadata['elapsedSeconds'],0)

    def test_schema_allows_parameters_only_and_unique_missing_divisor(self):
        schema=provider.author_schema(self.lesson,self.cap)
        self.assertEqual(schema['properties']['version']['enum'],[2])
        full,unsupported=schema['properties']['questions']['anyOf']
        self.assertEqual((full['minItems'],full['maxItems']),(12,12))
        self.assertEqual(unsupported['maxItems'],0)
        self.assertFalse(schema['additionalProperties'])
        for plan,ref in zip(provider.question_plan(self.lesson,self.cap),full['prefixItems']):
            question=schema['$defs'][ref['$ref'].split('/')[-1]]
            self.assertEqual(question['required'],['items'])
            self.assertFalse(question['additionalProperties'])
            array=question['properties']['items'];item=array['items']
            self.assertEqual((array['minItems'],array['maxItems']),(3,6))
            self.assertEqual(set(item['required']),{'divisor','quotient'})
            self.assertFalse(item['additionalProperties'])
            self.assertEqual(item['properties']['divisor'],{'type':'integer','minimum':1,'maximum':10})
            self.assertEqual(item['properties']['quotient']['minimum'],1 if plan['kind']=='missing_right' else 0)

    def test_middle_schema_omits_c_and_all_answer_fields(self):
        self.use_fixture('middle');schema=provider.author_schema(self.lesson,self.cap)
        full=schema['properties']['questions']['anyOf'][0]
        self.assertEqual((full['minItems'],full['maxItems']),(20,20))
        item=schema['$defs']['equation_parameters']['properties']['items']['items']
        self.assertEqual(set(item['required']),{'a','b','solution'})
        self.assertEqual(item['properties']['solution'],{'type':'integer','minimum':-20,'maximum':20})
        self.assertFalse(item['additionalProperties'])

    def test_injected_answer_or_equation_c_is_rejected_before_derivation(self):
        for family,field in (('elementary','answer'),('middle','c')):
            with self.subTest(family=family):
                self.use_fixture(family);self.payload['questions'][0]['items'][0][field]='never-store-this'
                metadata=self.fail_author()
                self.assertFalse(metadata['derivation']['performed'])
                self.assertNotIn('never-store-this',json.dumps(metadata))

    def test_kind_star_and_unknown_fields_cannot_be_supplied(self):
        for field,value in (('kind','calculate'),('star',True),('private_field','do-not-store')):
            self.use_fixture('elementary');self.payload['questions'][0][field]=value
            metadata=self.fail_author()
            self.assertNotIn('do-not-store',json.dumps(metadata))
            self.assertFalse(metadata['derivation']['performed'])

    def test_zero_missing_and_wrongly_typed_divisor_rejected(self):
        for value in (0,True,'3',11,None):
            self.use_fixture('elementary');item=self.payload['questions'][0]['items'][0]
            if value is None:item.pop('divisor')
            else:item['divisor']=value
            self.assertFalse(self.fail_author()['derivation']['performed'])

    def test_missing_divisor_task_cannot_use_zero_quotient(self):
        position=next(i for i,p in enumerate(provider.question_plan(self.lesson,self.cap)) if p['kind']=='missing_right')
        self.payload['questions'][position]['items'][0]['quotient']=0
        self.assertFalse(self.fail_author()['derivation']['performed'])

    def test_zero_quotient_is_allowed_for_regular_calculation(self):
        self.payload['questions'][0]['items'][0]={'divisor':10,'quotient':0}
        canonical=provider.derive_author_parameters(self.lesson,self.cap,self.payload)
        self.assertEqual(canonical['questions'][0]['items'][0],{'left':0,'op':'divide','right':10,'answer':0})
        validate_model(self.lesson,canonical)

    def test_out_of_range_derived_c_is_rejected_not_clamped(self):
        self.use_fixture('middle');self.payload['questions'][0]['items'][0]={'a':12,'b':100,'solution':20}
        metadata=self.fail_author()
        self.assertIn('derived c',metadata['validationError']['detail'])
        self.assertFalse(metadata['derivation']['performed'])

    def test_all_raw_parameters_are_validated_before_derivation(self):
        self.use_fixture('middle')
        self.payload['questions'][0]['items'][0]={'a':12,'b':100,'solution':20}
        self.payload['questions'][-1]['items'][-1]['c']=123
        metadata=self.fail_author()
        self.assertIn('expected fields a,b,solution',metadata['validationError']['detail'])
        self.assertNotIn('derived c',metadata['validationError']['detail'])

    def test_duplicate_parameters_still_fail_original_canonical_duplicate_gate(self):
        plan=provider.question_plan(self.lesson,self.cap)
        repeat=next(i for i,p in enumerate(plan[1:],1) if p['kind']==plan[0]['kind'])
        self.payload['questions'][repeat]['items'][0]=copy.deepcopy(self.payload['questions'][0]['items'][0])
        metadata=self.fail_author('DUPLICATE_ITEM')
        self.assertTrue(metadata['derivation']['performed'])

    def test_counts_and_old_contract_are_not_repaired(self):
        for change in ('question','item','version'):
            self.use_fixture('elementary')
            if change=='question':self.payload['questions'].pop()
            elif change=='item':self.payload['questions'][0]['items']=self.payload['questions'][0]['items'][:2]
            else:self.payload['version']=1
            self.assertFalse(self.fail_author()['derivation']['performed'])

    def test_truncation_keeps_billable_usage_and_does_not_retry(self):
        metadata={}
        with patch('provider.build_opener') as build:
            build.return_value.open.return_value=Response(self.envelope('length'))
            with self.assertRaises(GenerationError) as caught:provider.author_lesson(self.lesson,metadata=metadata,**self.config)
            build.return_value.open.assert_called_once()
        self.assertEqual(caught.exception.code,'PROVIDER_INCOMPLETE')
        self.assertFalse(metadata['validated'])
        self.assertEqual(metadata['usage']['completion_tokens'],456)

    def test_tls_error_is_bounded_without_fallback_or_credential_output(self):
        metadata={}
        with patch('provider.build_opener') as build:
            build.return_value.open.side_effect=URLError(ssl.SSLCertVerificationError('fixture TLS failure'))
            with self.assertRaises(GenerationError) as caught:provider.author_lesson(self.lesson,metadata=metadata,**self.config)
            build.return_value.open.assert_called_once()
        self.assertEqual(caught.exception.code,'PROVIDER_TLS_ERROR')
        self.assertFalse(metadata['responseReceived'])
        self.assertNotIn(self.config['api_key'],json.dumps(metadata)+str(caught.exception))

    def test_empty_questions_is_explicit_unsupported_not_short_sheet(self):
        self.payload={'version':2,'questions':[]}
        self.fail_author('AUTHOR_UNSUPPORTED')

    def test_plan_retains_exact_balance_and_noncalculation_challenges(self):
        for fixture in ('elementary','middle'):
            self.use_fixture(fixture);plan=provider.question_plan(self.lesson,self.cap)
            self.assertEqual(len(plan),self.lesson['questionCount'])
            self.assertEqual(dict(Counter(q['kind'] for q in plan)),self.cap['requiredKindCounts'])
            self.assertIn(sum(q['star'] for q in plan),(2,3,4))
            self.assertFalse(any(q['star'] and q['kind'] in ('calculate','solve') for q in plan))

    def test_missing_trusted_balance_cannot_make_an_author_plan(self):
        cap=copy.deepcopy(self.cap);cap.pop('requiredKindCounts')
        with self.assertRaises(GenerationError) as caught:provider.author_schema(self.lesson,cap)
        self.assertEqual(caught.exception.code,'AUTHOR_PLAN_CONFIG_INVALID')


if __name__=='__main__':unittest.main()
