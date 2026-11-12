import json
from pathlib import Path
import ssl
import sys
import unittest
from unittest.mock import patch
from urllib.error import URLError

HERE=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(HERE))
import provider
from validation import GenerationError, read_json, validate_lesson


class Response:
    def __init__(self, envelope):self.raw=json.dumps(envelope,ensure_ascii=False).encode()
    def __enter__(self):return self
    def __exit__(self,*args):pass
    def read(self,limit):return self.raw[:limit]


class ProviderTests(unittest.TestCase):
    def setUp(self):
        self.lesson=read_json(HERE/'examples/elementary-lesson.json')
        self.payload=read_json(HERE/'examples/elementary-model.json')
        self.config={'api_key':'fixture-not-a-secret','base_url':'https://fixture.eu-central-1.maas.aliyuncs.com/compatible-mode/v1','model':'qwen3.8-flash'}

    def envelope(self, finish='stop'):
        return {'model':'qwen3.8-flash','usage':{'prompt_tokens':123,'completion_tokens':456,'total_tokens':579,'api_key':'must-not-survive','prompt_tokens_details':{'cached_tokens':0,'unsafe':'omit'}},'choices':[{'finish_reason':finish,'message':{'content':json.dumps(self.payload,ensure_ascii=False)}}]}

    def test_certifi_context_requires_certificate_and_hostname_verification(self):
        context=provider.verified_tls_context()
        self.assertEqual(context.verify_mode,ssl.CERT_REQUIRED)
        self.assertTrue(context.check_hostname)
        self.assertGreater(len(context.get_ca_certs()),0)

    def test_author_returns_payload_and_safe_usage_without_real_network(self):
        metadata={}
        with patch('provider.build_opener') as build:
            build.return_value.open.return_value=Response(self.envelope())
            result=provider.author_lesson(self.lesson,metadata=metadata,**self.config)
            request=build.return_value.open.call_args.args[0]
            body=json.loads(request.data)
            self.assertFalse(body['enable_thinking'])
            self.assertEqual(body['response_format']['type'],'json_schema')
            self.assertTrue(body['response_format']['json_schema']['strict'])
            schema=body['response_format']['json_schema']['schema']
            full,unsupported=schema['properties']['questions']['anyOf']
            self.assertEqual((full['minItems'],full['maxItems']),(12,12))
            self.assertEqual(unsupported['maxItems'],0)
            self.assertFalse(schema['additionalProperties'])
            question=full['items'];item=question['properties']['items']
            self.assertEqual((item['minItems'],item['maxItems']),(3,6))
            self.assertEqual(item['items']['properties']['op']['enum'],['divide'])
            self.assertEqual(item['items']['properties']['right']['maximum'],10)
            self.assertFalse(item['items']['additionalProperties'])
            example=json.loads(body['messages'][1]['content'])['one_question_example_only']
            self.assertEqual(len(example['items']),3)
            self.assertEqual(body['max_tokens'],14000)
            self.assertEqual(build.return_value.open.call_count,1)
        self.assertEqual(result,self.payload)
        self.assertTrue(metadata['validated'])
        self.assertEqual(metadata['requestedModel'],'qwen3.8-flash')
        self.assertEqual(metadata['responseModel'],'qwen3.8-flash')
        self.assertEqual(metadata['usage']['total_tokens'],579)
        self.assertNotIn('api_key',metadata['usage'])
        self.assertNotIn('unsafe',metadata['usage']['prompt_tokens_details'])
        self.assertGreaterEqual(metadata['elapsedSeconds'],0)

    def test_truncation_keeps_billable_usage_and_does_not_retry(self):
        metadata={}
        with patch('provider.build_opener') as build:
            build.return_value.open.return_value=Response(self.envelope('length'))
            with self.assertRaises(GenerationError) as caught:
                provider.author_lesson(self.lesson,metadata=metadata,**self.config)
            self.assertEqual(build.return_value.open.call_count,1)
        self.assertEqual(caught.exception.code,'PROVIDER_INCOMPLETE')
        self.assertFalse(metadata['validated'])
        self.assertEqual(metadata['usage']['completion_tokens'],456)

    def test_tls_error_is_bounded_without_fallback_or_credential_output(self):
        metadata={}
        with patch('provider.build_opener') as build:
            build.return_value.open.side_effect=URLError(ssl.SSLCertVerificationError('fixture TLS failure'))
            with self.assertRaises(GenerationError) as caught:
                provider.author_lesson(self.lesson,metadata=metadata,**self.config)
            self.assertEqual(build.return_value.open.call_count,1)
        self.assertEqual(caught.exception.code,'PROVIDER_TLS_ERROR')
        self.assertFalse(metadata['responseReceived'])
        self.assertNotIn(self.config['api_key'],json.dumps(metadata)+str(caught.exception))

    def test_equation_schema_is_topic_specific_with_exact_volume(self):
        lesson=read_json(HERE/'examples/middle-lesson.json')
        schema=provider.author_schema(lesson,validate_lesson(lesson))
        full=schema['properties']['questions']['anyOf'][0]
        self.assertEqual((full['minItems'],full['maxItems']),(20,20))
        question=full['items'];item=question['properties']['items']['items']
        self.assertEqual(set(item['required']),{'a','b','c','solution'})
        self.assertEqual(item['properties']['solution'],{'type':'integer','minimum':-20,'maximum':20})
        self.assertEqual(question['properties']['kind']['enum'],['solve','check_solution','construct'])

    def test_local_validation_failure_preserves_safe_reason_and_usage(self):
        metadata={};self.payload['questions'][0]['items'][0]['private_field']='never-store-this'
        with patch('provider.build_opener') as build:
            build.return_value.open.return_value=Response(self.envelope())
            with self.assertRaises(GenerationError):provider.author_lesson(self.lesson,metadata=metadata,**self.config)
            self.assertEqual(build.return_value.open.call_count,1)
        self.assertEqual(metadata['validationError'],{'code':'INVALID_MODEL_OUTPUT','detail':'arithmetic: expected fields left,op,right,answer'})
        self.assertEqual(metadata['usage']['completion_tokens'],456)
        self.assertNotIn('never-store-this',json.dumps(metadata))
        self.assertNotIn('private_field',json.dumps(metadata))

    def test_empty_questions_is_explicit_unsupported_not_short_sheet(self):
        self.payload={'version':1,'questions':[]};metadata={}
        with patch('provider.build_opener') as build:
            build.return_value.open.return_value=Response(self.envelope())
            with self.assertRaises(GenerationError) as caught:provider.author_lesson(self.lesson,metadata=metadata,**self.config)
        self.assertEqual(caught.exception.code,'AUTHOR_UNSUPPORTED')
        self.assertFalse(metadata['validated'])
        self.assertEqual(metadata['validationError']['code'],'AUTHOR_UNSUPPORTED')


if __name__=='__main__':unittest.main()
