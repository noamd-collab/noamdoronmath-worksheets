"""General intake/provider integration; no network, billing, or queue changes."""
import copy
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

HERE=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(HERE))
import provider
import no_carry_addition as addition
from general_source import GeneralSourceError, validate_source
from runtime_catalog import catalog, question_floor, scope_for_lesson, CURRICULUM_SHA256
from validation import validate_lesson, validate_model, GenerationError, capabilities


def intake(topic):
    return {'version':3,'gradeNumber':topic['gradeNumber'],'topicId':topic['topicId'],
            'level':topic['levels'][0],'lessonGoal':'practice','questionCount':question_floor(topic['gradeNumber']),
            'minutes':40,'lastLesson':'למדנו את המושג הראשון בנושא ותרגלנו בכיתה',
            'alreadyLearned':[],'explicitShortSheet':False,
            'lessonBoundary':{'version':1,'kind':'curriculum_scope','curriculumSha256':CURRICULUM_SHA256,
                              'conceptIds':[topic['concepts'][0]['id']]}}


def source(lesson):
    # Synthetic schema fixture only, not topic/pedagogy qualification.
    words=lambda value:[{'kind':'text','text':value}]
    return {'version':4,'title':'תרגול','rule':words('קראו ופתרו את התרגילים.'),
            'sections':[{'title':'תרגול','conceptIds':lesson['lessonBoundary']['conceptIds'],
                         'questions':[{'intro':words('חשבו את ערך הביטוי.'),'star':i>=lesson['questionCount']-3,
                                       'items':[{'prompt':words('חשבו.'),'answer':{
                                           'kind':'computed','unit':'','task':{'kind':'evaluate',
                                           'expression':{'type':'number','numerator':i*3+j+1,'denominator':1}}}} for j in range(3)]}
                                      for i in range(lesson['questionCount'])]}]}


class Response:
    def __init__(self,value): self.value=json.dumps(value,ensure_ascii=False).encode()
    def __enter__(self): return self
    def __exit__(self,*args): pass
    def read(self,size): return self.value[:size]


class GeneralRuntimeTests(unittest.TestCase):
    def setUp(self):
        self.lesson=intake(next(t for t in catalog().topics if t['topicId']=='g8:percentages'))
        self.config={'api_key':'synthetic-fixture-key','base_url':'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
                     'model':'fixture-model'}

    def test_all_232_intakes_resolve_their_actual_skill_track_and_levels(self):
        for topic in catalog().topics:
            with self.subTest(topic=topic['topicId']):
                lesson=intake(topic)
                cap=validate_lesson(lesson)
                self.assertEqual(cap['topicId'],topic['topicId'])
                self.assertEqual(cap['skill'],topic['skillId'])
                self.assertEqual(cap['levels'],list(topic['levels']))
                self.assertEqual(cap['family'],'general')

    def test_catalog_copy_is_exact_and_does_not_claim_all_topics_e2e(self):
        public=HERE.parents[1]/'headless/astro-poc/public/teachers/generation-curriculum.json'
        if public.is_file():
            self.assertEqual((HERE/'generation-curriculum.json').read_bytes(),public.read_bytes())
        cap=capabilities()
        self.assertEqual(len(cap['topics']),232)
        self.assertEqual(cap['curriculumSha256'],CURRICULUM_SHA256)
        self.assertLessEqual(len(json.dumps(cap,ensure_ascii=False,separators=(', ',': ')).encode()),64000)
        self.assertFalse(any(t.get('e2eVerified') for t in cap['topics']))
        self.assertEqual([t['topicId'] for t in cap['topics'] if t.get('legacy',{}).get('e2eVerified')],['ג10','g7:equations'])

    def test_boundary_tampering_or_cross_grade_is_rejected_before_provider(self):
        changes=[{'curriculumSha256':'0'*64},{'conceptIds':['g8:congruence#0']},
                 {'conceptIds':[]},{'conceptIds':[self.lesson['topicId']+'#999']}]
        for change in changes:
            lesson=copy.deepcopy(self.lesson);lesson['lessonBoundary'].update(change)
            with patch('provider.build_opener') as network, self.assertRaises(GenerationError):
                provider.author_lesson(lesson,**self.config)
            network.assert_not_called()
        with self.assertRaises(GenerationError):
            validate_lesson({**self.lesson,'gradeNumber':9})

    def test_source_cannot_add_approvals_or_paths(self):
        for field in ('approved','e2eVerified','html','path','code'):
            payload=source(self.lesson);payload[field]='untrusted'
            with self.assertRaises(GenerationError): validate_model(self.lesson,payload)

    def test_general_author_receives_skill_and_scope_and_calls_once(self):
        payload=source(self.lesson)
        context={'scope':scope_for_lesson(self.lesson),'sourceContext':{'notYetAllowedTools':[]},
                 'authoringSkill':{'version':'7.2.0-noam','documents':[{'text':'fixed skill text'}]}}
        envelope={'model':'fixture-model','usage':{'prompt_tokens':123,'private':'discard'},
                  'choices':[{'finish_reason':'stop','message':{'content':json.dumps(payload,ensure_ascii=False)}}]}
        measured={}
        with patch('general_provider.build_authoring_context',return_value=context), patch('provider.build_opener') as network:
            network.return_value.open.return_value=Response(envelope)
            got=provider.author_lesson(self.lesson,metadata=measured,**self.config)
            network.return_value.open.assert_called_once()
            body=json.loads(network.return_value.open.call_args.args[0].data)
        self.assertEqual(got,payload)
        self.assertEqual(measured['authorContract'],'worksheet-source/4')
        self.assertTrue(measured['validated'])
        self.assertEqual(measured['usage'],{'prompt_tokens':123})
        sent=json.loads(body['messages'][1]['content'])
        self.assertEqual(sent['authoringContext'],context)
        schema=body['response_format']['json_schema']['schema']
        self.assertEqual(schema['properties']['version']['const'],4)
        self.assertEqual(body['response_format']['type'],'json_schema')
        self.assertIs(body['response_format']['json_schema']['strict'],True)
        self.assertEqual(schema['properties']['sections']['items']['properties']['questions']['minItems'],20)
        self.assertEqual(sent['teacherStoppingPoint'],self.lesson['lastLesson'])
        self.assertRegex(measured['requestSchemaSha256'],r'^[a-f0-9]{64}$')
        self.assertRegex(measured['requestBodySha256'],r'^[a-f0-9]{64}$')
        self.assertNotIn('synthetic-fixture-key',json.dumps(body))

    def test_singleton_table_cells_from_provider_are_validated_without_changing_math(self):
        payload = source(self.lesson)
        cell = {"kind":"math","expression":{"type":"number","numerator":3,"denominator":1}}
        question = payload["sections"][0]["questions"][0]
        question["table"] = {"head":[{"kind":"text","text":"כמות"}, "מחיר"], "rows":[[cell, [cell]]]}
        scope = scope_for_lesson(self.lesson)
        with self.assertRaisesRegex(GeneralSourceError, "table.head.1"):
            validate_source(self.lesson, payload, scope)
        untouched = copy.deepcopy(payload)
        with patch('general_provider.build_authoring_context',return_value={}), patch('provider.request_author_json',return_value=payload) as author:
            corrected = provider.author_lesson(self.lesson, **self.config)
        author.assert_called_once()
        table = corrected["sections"][0]["questions"][0]["table"]
        self.assertEqual(table["rows"], [[[cell], [cell]]])
        self.assertEqual(table["head"], [[{"kind":"text","text":"כמות"}], [{"kind":"text","text":"מחיר"}]])
        validate_source(self.lesson, corrected, scope)
        self.assertEqual(payload, untouched)
        for invalid in (None, [], "", {}, [{"kind":"unknown"}], "סכום 3+4", "כמות <תג>", "כמות ≤ אחת",
                        {"kind":"math","expression": {"type":"number","numerator":1,"denominator":0}}):
            with self.subTest(invalid=invalid), self.assertRaises(GeneralSourceError):
                question["table"]["head"][0] = invalid
                validate_source(self.lesson, payload, scope, provider=True)

    def test_addition_choices_author_original_pairs_and_complete_verified_prompts(self):
        topic = next(t for t in catalog().topics if t["topicId"] == "ב05")
        lesson = intake(topic)
        lesson["lessonBoundary"]["conceptIds"] = ["ב05#1"]
        lesson["level"] = "b"
        for count in range(8, 13):
            lesson["questionCount"] = count
            scope = scope_for_lesson(lesson)
            plan = addition.parameter_plan(count)
            authored = {"version":1, "questions":[{"theme":(q % 10)+1, "choices":[(i + q) % 4 + 1 for i in range(5)]}
                                                 for q in range(count)]}
            measured = {}
            with patch('general_provider.build_authoring_context',return_value={}), patch('provider.request_author_json',return_value=authored) as author:
                result = provider.author_lesson(lesson, metadata=measured, **self.config)
                body = author.call_args.args[2]
            author.assert_called_once()
            self.assertEqual(measured["authorContract"], "no-carry-addition/1")
            self.assertTrue(measured["validated"])
            sent = json.loads(body["messages"][1]["content"])
            wire_schema = body["response_format"]["json_schema"]
            self.assertEqual(len(sent["additionPlan"]), count)
            self.assertEqual(sent["sourceSchema"], wire_schema["schema"])
            self.assertEqual(wire_schema["name"], "worksheet_authoring_choice")
            evidence = validate_source(lesson, result, scope)["evidence"]["computations"]
            self.assertEqual(len(evidence), 5 * count)
            seen = set()
            for qi, question in enumerate(result["sections"][0]["questions"]):
                self.assertEqual(question["star"], qi >= count-3)
                for sub, item in enumerate(question["items"]):
                    options = plan[qi]["options"][sub]
                    for a,b in options:
                        self.assertTrue(10 <= min(a,b) and a+b < 100 and a%10+b%10 < 10)
                        self.assertNotIn(tuple(sorted((a,b))), seen)
                        seen.add(tuple(sorted((a,b))))
                    a,b = options[authored["questions"][qi]["choices"][sub]-1]
                    args = item["answer"]["task"]["expression"]["args"]
                    self.assertEqual([value["numerator"] for value in args], [a,b])
                    self.assertEqual(evidence[qi*5+sub]["computed"]["result"]["value"], {"type":"number","numerator":a+b,"denominator":1})
                    self.assertEqual(addition.states_entire_task(lesson,qi,sub,item),
                                     plan[qi]["kind"] in ("combine","increase","days","digits","choose"))
                    incomplete = {**item, "prompt":[{"kind":"text", "text":"חַשְּׁבוּ."}]}
                    self.assertFalse(addition.states_entire_task(lesson,qi,sub,incomplete))
            for bad_row in ({"theme":1, "choices":[0]*5}, {"theme":True, "choices":[1]*5}, {"theme":1, "choices":[1]*5,"answer":0}):
                with self.subTest(row=bad_row), self.assertRaises(GeneralSourceError):
                    addition.build_source(lesson,{**authored,"questions":[bad_row]+authored["questions"][1:]},plan)

    def test_addition_teacher_specific_alternative_keeps_original_source_in_one_call(self):
        fixture = HERE / 'cloud/container/fixtures/general/grade2-vocalized'
        lesson = json.loads((fixture/'lesson.json').read_text())
        lesson["lastLesson"] = "הכינו רק שאלות עם ספרים ובלי מדבקות"
        payload = json.loads((fixture/'model-output.json').read_text())
        for i,q in enumerate(payload["sections"][0]["questions"]):
            q["star"] = i >= lesson["questionCount"]-3
        with patch('general_provider.build_authoring_context',return_value={}), patch('provider.request_author_json',return_value=payload) as author:
            self.assertEqual(provider.author_lesson(lesson, **self.config), payload)
        author.assert_called_once()
        self.assertEqual(json.loads(author.call_args.args[2]["messages"][1]["content"])["teacherStoppingPoint"], lesson["lastLesson"])
        for override in ({"level":"a"}, {"lessonGoal":"review"}, {"questionCount":13},
                         {"lessonBoundary":{"conceptIds":["ב05#0","ב05#1"]}}):
            self.assertFalse(addition.compatible({**lesson, **override}))

    def test_bad_general_response_never_retries_or_becomes_approved(self):
        envelope={'choices':[{'finish_reason':'stop','message':{'content':'{"version":4,"approved":true}'}}]}
        measured={}
        with patch('general_provider.build_authoring_context',return_value={}), patch('provider.build_opener') as network:
            network.return_value.open.return_value=Response(envelope)
            with self.assertRaises(GenerationError): provider.author_lesson(self.lesson,metadata=measured,**self.config)
            network.return_value.open.assert_called_once()
        self.assertFalse(measured['validated'])

    def test_three_stars_in_wrong_slots_rejected_without_paid_retry(self):
        payload=source(self.lesson)
        questions=payload['sections'][0]['questions']
        # Real development regression: three stars at 17/18/19 instead of
        # 18/19/20. Generic source validation accepts the count, but the exact
        # authoring plan must reject misplaced slots without silently fixing it.
        for index,question in enumerate(questions):
            question['star']=len(questions)-4<=index<len(questions)-1
        self.assertEqual(sum(question['star'] for question in questions),3)
        validate_model(self.lesson,payload)
        envelope={'choices':[{'finish_reason':'stop','message':{
            'content':json.dumps(payload,ensure_ascii=False)}}]}
        measured={}
        with patch('general_provider.build_authoring_context',return_value={}), patch('provider.build_opener') as network:
            network.return_value.open.return_value=Response(envelope)
            with self.assertRaises(GenerationError) as raised:
                provider.author_lesson(self.lesson,metadata=measured,**self.config)
            network.return_value.open.assert_called_once()
        self.assertEqual(raised.exception.code,'AUTHOR_PLAN_MISMATCH')
        self.assertEqual(measured['validationError']['code'],'AUTHOR_PLAN_MISMATCH')
        self.assertFalse(measured['validated'])
        self.assertEqual([i+1 for i,q in enumerate(questions) if q['star']],[17,18,19])


if __name__=='__main__':unittest.main()
