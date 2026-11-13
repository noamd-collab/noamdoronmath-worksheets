import json
import copy
import random
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
        self.lesson['version']=2
        self.lesson['lessonBoundary']=({'version':1,'kind':'division_facts','allowedDivisors':list(range(1,11)),'maxDividend':100}
            if family=='elementary' else {'version':1,'kind':'linear_equations','allowSignedNumbers':True})
        self.cap=validate_lesson(self.lesson)
        plan=provider.question_plan(self.lesson,self.cap)
        self.expected={'version':1,'questions':[]}
        self.payload={'version':3 if family=='middle' else 2,'questions':[]}
        # Fixed once, before quality evaluation: no seed search or gate-driven
        # retries. Valid fixtures vary both parameters instead of enumerating a
        # fact table or repeating a short cycle. Rejection cases below remain
        # explicit mechanical inputs.
        rng=random.Random(20261113)
        pairs=rng.sample([(a,x) for a in range(1,13) for x in range(-15,16)],3*len(plan)) if family=='middle' else None
        quotients={d:rng.sample(list(range(1,11)),10) for d in range(1,11)} if family=='elementary' else None
        for qi,p in enumerate(plan):
            if family=='middle':
                items=[{'a':a,'solution':x} for a,x in pairs[qi*3:qi*3+3]]
                offsets=[qi*3+1,-(qi*3+1),qi*3+2]
                expected=[{**item,'b':b,'c':item['a']*item['solution']+b} for item,b in zip(items,offsets)]
            else:
                divisors=rng.sample([d for d,values in quotients.items() if values],3)
                items=[{'divisor':d,'quotient':quotients[d].pop()} for d in divisors]
                expected=[{'left':item['divisor']*item['quotient'],'op':'divide','right':item['divisor'],'answer':item['quotient']} for item in items]
            self.payload['questions'].append({'items':items})
            self.expected['questions'].append({'kind':p['kind'],'star':p['star'],'items':expected})

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
                    self.assertEqual(set(sent),{'lesson','capability','questionPlan'})
                    self.assertNotIn('example',body['messages'][1]['content'])
                    self.assertEqual(body['response_format']['json_schema']['schema']['properties']['version']['enum'],[self.payload['version']])
                    self.assertIn('"version":'+str(self.payload['version']),body['messages'][0]['content'])
                    if family=='middle':
                        self.assertIn('zero-based global slot=questionIndex*6+itemIndex',body['messages'][0]['content'])
                        self.assertIn('fixed signed offsets conflict',body['messages'][0]['content'])
                    build.return_value.open.assert_called_once()
                self.assertEqual(result,self.expected)
                self.assertEqual(self.payload,original)
                validate_model(self.lesson,result)
                self.assertTrue(metadata['validated'])
                self.assertTrue(metadata['authorQuality']['passed'])
                self.assertEqual(metadata['authorContract'],f"worksheet-parameters/{self.payload['version']}")
                self.assertTrue(metadata['derivation']['performed'])
                self.assertEqual(metadata['derivation']['canonicalVersion'],1)
                self.assertEqual(metadata['requestedModel'],'qwen3.8-flash')
                self.assertEqual(metadata['responseModel'],'qwen3.8-flash')
                self.assertEqual(metadata['usage']['total_tokens'],579)
                self.assertNotIn('api_key',metadata['usage'])
                self.assertNotIn('unsafe',metadata['usage']['prompt_tokens_details'])
                self.assertGreaterEqual(metadata['elapsedSeconds'],0)

    def test_legacy_intake_needs_explicit_offline_opt_in_before_provider_call(self):
        self.lesson=read_json(HERE/'examples/elementary-lesson.json')
        with patch('provider.build_opener') as build:
            with self.assertRaises(GenerationError) as caught:
                provider.author_lesson(self.lesson,**self.config)
            build.assert_not_called()
        self.assertEqual(caught.exception.code,'LESSON_VERSION_REQUIRES_NEW_DRAFT')
        with patch('provider.build_opener') as build:
            build.return_value.open.return_value=Response(self.envelope())
            provider.author_lesson(self.lesson,allow_legacy=True,**self.config)
            build.return_value.open.assert_called_once()

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

    def test_middle_v3_schema_omits_b_c_and_all_answer_fields(self):
        self.use_fixture('middle');schema=provider.author_schema(self.lesson,self.cap)
        self.assertEqual(schema['properties']['version']['enum'],[3])
        full=schema['properties']['questions']['anyOf'][0]
        self.assertEqual((full['minItems'],full['maxItems']),(20,20))
        item=schema['$defs']['equation_parameters']['properties']['items']['items']
        self.assertEqual(set(item['required']),{'a','solution'})
        self.assertEqual(item['properties']['a'],{'type':'integer','minimum':1,'maximum':12})
        self.assertEqual(item['properties']['solution'],{'type':'integer','minimum':-15,'maximum':15})
        self.assertFalse(item['additionalProperties'])

    def test_positive_only_contract_has_three_parts_and_sixty_unique_positive_offsets(self):
        self.use_fixture('middle');self.lesson['lessonBoundary']['allowSignedNumbers']=False
        schema=provider.author_schema(self.lesson,self.cap)
        array=schema['$defs']['equation_parameters']['properties']['items']
        self.assertEqual((array['minItems'],array['maxItems']),(3,3))
        self.assertEqual(array['items']['properties']['solution'],{'type':'integer','minimum':0,'maximum':15})
        for a in (1,12):
            for x in (0,15):
                raw={'version':3,'questions':[{'items':[{'a':a,'solution':x} for _ in range(3)]} for _ in range(20)]}
                result=provider.derive_author_parameters(self.lesson,self.cap,raw)
                items=[it for q in result['questions'] for it in q['items']]
                self.assertEqual([it['b'] for it in items],list(range(1,61)))
                self.assertTrue(all(0<=it['c']<=240 for it in items))
                self.assertEqual(len({(it['a'],it['b'],it['c']) for it in items}),60)
                validate_model(self.lesson,result)

    def test_positive_only_prompt_and_derived_outputs_are_consistent(self):
        self.use_fixture('middle');self.lesson['lessonBoundary']['allowSignedNumbers']=False
        pairs=random.Random(20261113).sample([(a,x) for a in range(1,13) for x in range(16)],60)
        for qi,q in enumerate(self.payload['questions']):
            for ii,it in enumerate(q['items']):
                a,x=pairs[qi*3+ii];it.update(a=a,solution=x)
        with patch('provider.build_opener') as build:
            build.return_value.open.return_value=Response(self.envelope())
            result=provider.author_lesson(self.lesson,**self.config)
            body=json.loads(build.return_value.open.call_args.args[0].data)
            self.assertIn('exactly 3 items per question',body['messages'][0]['content'])
            self.assertIn('b=questionIndex*3+itemIndex+1',body['messages'][0]['content'])
            self.assertNotIn('solution -15..15',body['messages'][0]['content'])
            self.assertNotIn('six reserved slots',body['messages'][0]['content'])
            self.assertNotIn('one_question_example_only',body['messages'][1]['content'])
        self.assertTrue(all(v>=0 for q in result['questions'] for item in q['items'] for v in item.values()))

    def test_positive_only_rejects_negative_parameters_or_four_parts_without_clamping(self):
        for variant in ('negative','four_parts'):
            self.use_fixture('middle');self.lesson['lessonBoundary']['allowSignedNumbers']=False
            for q in self.payload['questions']:
                for it in q['items']:it['solution']=abs(it['solution'])
            if variant=='negative':self.payload['questions'][0]['items'][0]['solution']=-1
            else:self.payload['questions'][0]['items'].append({'a':2,'solution':4})
            metadata=self.fail_author()
            self.assertFalse(metadata['derivation']['performed'])

    def test_restricted_division_schema_and_validator_enforce_product_and_divisor(self):
        self.lesson['lessonBoundary'].update(allowedDivisors=[2,5],maxDividend=20)
        self.cap=validate_lesson(self.lesson)
        schema=provider.author_schema(self.lesson,self.cap)
        missing=schema['$defs']['division_positive_quotient']['properties']['items']
        self.assertEqual(missing['maxItems'],4)
        variants=missing['items']['anyOf']
        self.assertEqual([(v['properties']['divisor']['enum'],v['properties']['quotient']['maximum']) for v in variants],[([2],10),([5],4)])
        for d,q in ((7,1),(5,5)):
            self.payload['questions'][0]['items'][0]={'divisor':d,'quotient':q}
            self.assertFalse(self.fail_author('OUTSIDE_LESSON_BOUNDARY')['derivation']['performed'])

    def test_impossible_division_boundary_is_rejected_before_billed_request(self):
        self.lesson['lessonBoundary'].update(allowedDivisors=[10],maxDividend=10)
        with patch('provider.build_opener') as build:
            with self.assertRaises(GenerationError) as caught:provider.author_lesson(self.lesson,**self.config)
            build.assert_not_called()
        self.assertEqual(caught.exception.code,'BOUNDARY_TOO_NARROW')

    def test_known_long_pattern_and_example_are_rejected_after_one_call_without_repair(self):
        for copied in (False,True):
            self.use_fixture('middle')
            values=list(range(1,16))+list(range(-1,-16,-1))
            for qi,q in enumerate(self.payload['questions']):
                for ii,it in enumerate(q['items']):
                    index=qi*3+ii;it.update(a=(index+1)%12+1,solution=values[(index+(3 if copied else 4))%30])
            metadata=self.fail_author('AUTHOR_EXAMPLE_COPY' if copied else 'AUTHOR_NUMERIC_PATTERN')
            self.assertTrue(metadata['derivation']['performed'])

    def test_injected_answer_or_equation_c_is_rejected_before_derivation(self):
        for family,field in (('elementary','answer'),('middle','b'),('middle','c'),('middle','answer')):
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

    def test_v3_parameter_ranges_and_types_are_rejected_not_clamped(self):
        for field,values in [('a',(0,13,True,1.5,'2',None)),('solution',(-16,16,True,1.5,'2',None))]:
            for value in values:
                with self.subTest(field=field,value=value):
                    self.use_fixture('middle')
                    self.payload['questions'][0]['items'][0][field]=value
                    metadata=self.fail_author()
                    self.assertFalse(metadata['derivation']['performed'])

    def test_all_raw_parameters_are_validated_before_derivation(self):
        self.use_fixture('middle')
        self.payload['questions'][-1]['items'][-1]['c']=123
        with patch('provider.integer',wraps=provider.integer) as checked:
            metadata=self.fail_author()
        self.assertIn('expected fields a,solution',metadata['validationError']['detail'])
        self.assertFalse(metadata['derivation']['performed'])
        self.assertFalse(any('derived c' in call.args[-1] for call in checked.call_args_list))

    def test_v3_all_120_slots_are_distinct_and_bounded_at_parameter_corners(self):
        self.use_fixture('middle')
        expected_offsets=[sign*n for n in range(1,61) for sign in (1,-1)]
        for a in (1,12):
            for solution in (-15,15):
                with self.subTest(a=a,solution=solution):
                    raw={'version':3,'questions':[{'items':[{'a':a,'solution':solution} for _ in range(6)]} for _ in range(20)]}
                    original=copy.deepcopy(raw)
                    result=provider.derive_author_parameters(self.lesson,self.cap,raw)
                    items=[item for question in result['questions'] for item in question['items']]
                    self.assertEqual([item['b'] for item in items],expected_offsets)
                    self.assertEqual(len({(item['a'],item['b'],item['c']) for item in items}),120)
                    self.assertTrue(all(-240<=item['c']<=240 and item['a']*solution+item['b']==item['c'] for item in items))
                    if a==12:self.assertIn(240 if solution==15 else -240,[item['c'] for item in items])
                    self.assertEqual(raw,original)
                    validate_model(self.lesson,result)
                    provider.validate_author_plan(self.lesson,self.cap,result)

    def test_v3_variable_item_counts_reserve_six_slots_without_reordering(self):
        self.use_fixture('middle')
        for counts in ([3]*20,[4]*20,[5]*20,[6]*20,[3,4,5,6]*5):
            with self.subTest(counts=counts):
                raw={'version':3,'questions':[{'items':[{'a':1,'solution':0} for _ in range(count)]} for count in counts]}
                result=provider.derive_author_parameters(self.lesson,self.cap,raw)
                self.assertEqual([len(q['items']) for q in result['questions']],counts)
                self.assertEqual([q['items'][0]['b'] for q in result['questions']],list(range(1,59,3)))
                self.assertEqual([q['items'][1]['b'] for q in result['questions']],list(range(-1,-59,-3)))
                all_items=[item for q in result['questions'] for item in q['items']]
                self.assertEqual(len({item['b'] for item in all_items}),sum(counts))
                validate_model(self.lesson,result)
                provider.validate_author_plan(self.lesson,self.cap,result)

    def test_v3_is_exact_topic_only_not_other_linear_equation_candidates(self):
        self.use_fixture('middle')
        for change in ('grade','topic','disabled'):
            lesson=copy.deepcopy(self.lesson);cap=copy.deepcopy(self.cap)
            if change=='grade':lesson['gradeNumber']=cap['gradeNumber']=9
            elif change=='topic':lesson['topicId']=cap['topicId']='g9m:equations'
            else:cap['enabled']=False
            with self.assertRaises(GenerationError) as caught:provider.author_schema(lesson,cap)
            self.assertEqual(caught.exception.code,'AUTHOR_PARAMETERS_UNSUPPORTED')

    def test_v3_does_not_relax_the_original_canonical_duplicate_or_math_gates(self):
        self.use_fixture('middle')
        canonical=provider.derive_author_parameters(self.lesson,self.cap,self.payload)
        repeat=next(i for i,q in enumerate(canonical['questions'][1:],1) if q['kind']==canonical['questions'][0]['kind'])
        duplicate=copy.deepcopy(canonical)
        duplicate['questions'][repeat]['items'][0]=copy.deepcopy(duplicate['questions'][0]['items'][0])
        with self.assertRaises(GenerationError) as caught:validate_model(self.lesson,duplicate)
        self.assertEqual(caught.exception.code,'DUPLICATE_ITEM')
        wrong=copy.deepcopy(canonical);wrong['questions'][0]['items'][0]['c']+=1
        with self.assertRaises(GenerationError) as caught:validate_model(self.lesson,wrong)
        self.assertEqual(caught.exception.code,'WRONG_ANSWER')

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

    def test_v3_rejects_v2_wrong_counts_and_fields_at_every_level_before_construction(self):
        for change in ('version2','version1','version_bool','short_questions','long_questions','few_items','many_items','root_field','question_field','item_field','missing_solution'):
            with self.subTest(change=change):
                self.use_fixture('middle')
                if change.startswith('version'):self.payload['version']={'version2':2,'version1':1,'version_bool':True}[change]
                elif change=='short_questions':self.payload['questions'].pop()
                elif change=='long_questions':self.payload['questions'].append(copy.deepcopy(self.payload['questions'][0]))
                elif change=='few_items':self.payload['questions'][0]['items']=self.payload['questions'][0]['items'][:2]
                elif change=='many_items':self.payload['questions'][0]['items']=[{'a':1,'solution':0} for _ in range(7)]
                elif change=='root_field':self.payload['private_field']='do-not-store'
                elif change=='question_field':self.payload['questions'][0]['star']=True
                elif change=='item_field':self.payload['questions'][0]['items'][0]['b']=1
                else:self.payload['questions'][0]['items'][0].pop('solution')
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
        for family,version in (('elementary',2),('middle',3)):
            self.use_fixture(family)
            self.payload={'version':version,'questions':[]}
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
