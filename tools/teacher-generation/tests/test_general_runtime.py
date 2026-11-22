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
        with patch('provider.build_authoring_context',return_value=context), patch('provider.build_opener') as network:
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
        self.assertEqual(set(schema['required']), {'title', 'rule', 'practice', 'challenges'})
        self.assertFalse(schema['additionalProperties'])
        self.assertEqual(body['response_format']['type'],'json_schema')
        self.assertIs(body['response_format']['json_schema']['strict'],True)
        section=schema['properties']
        for name, count in [('practice',17),('challenges',3)]:
            self.assertEqual((section[name]['minItems'],section[name]['maxItems']),(count,count))
            self.assertEqual(section[name]['items'],{'$ref':'#/$defs/question'})
            self.assertNotIn('prefixItems',section[name])
        self.assertEqual(set(schema['$defs']['question']['required']),{'intro','items'})
        self.assertEqual(sent['teacherStoppingPoint'],self.lesson['lastLesson'])
        self.assertRegex(measured['requestSchemaSha256'],r'^[a-f0-9]{64}$')
        self.assertRegex(measured['requestBodySha256'],r'^[a-f0-9]{64}$')
        self.assertNotIn('synthetic-fixture-key',json.dumps(body))

    def test_flat_content_round_trip_and_rejection_of_extra_owner_fields(self):
        original = source(self.lesson)
        qs = original['sections'][0]['questions']
        content = {k: copy.deepcopy(original[k]) for k in ('title', 'rule')}
        raw = [{k: v for k, v in q.items() if k != 'star'} for q in qs]
        content.update(practice=raw[:-3], challenges=raw[-3:])
        with patch('provider.build_authoring_context', return_value={}), \
                patch('provider.request_author_json', return_value=content) as network:
            self.assertEqual(provider.author_lesson(self.lesson, **self.config), original)
            network.assert_called_once()
        from skill_authoring import bind_content
        for field in ('approved', 'conceptIds', 'outputPath', 'teacherContext'):
            with self.subTest(field=field), self.assertRaises(GeneralSourceError):
                bind_content({**content, field: True}, scope_for_lesson(self.lesson))

    def test_targeted_revision_spends_at_most_once_and_preserves_other_rows(self):
        original = source(self.lesson)
        qs = original["sections"][0]["questions"]
        rows = [{k: v for k, v in q.items() if k != "star"} for q in qs]
        content = {k: copy.deepcopy(original[k]) for k in ("title", "rule")}
        content.update(practice=copy.deepcopy(rows[:-3]), challenges=copy.deepcopy(rows[-3:]))
        content["practice"][3]["intro"] = "חשבו [[4 @ 2]]."
        findings, measured = {}, {}
        with patch("provider.build_authoring_context", return_value={}), \
                patch("provider.request_author_json", side_effect=[content, {"q4": rows[3]}]) as network:
            with self.assertRaises(GenerationError):
                provider.author_lesson(self.lesson, revision=findings, metadata=measured, **self.config)
            self.assertEqual(network.call_count, 1)
            self.assertEqual([f["question"] for f in findings["sourceFindings"]], [4])
            revised = findings["revise"](findings["sourceFindings"])
            self.assertEqual(revised, original)
            self.assertTrue(measured["validated"])
            body = network.call_args.args[2]
            self.assertEqual(body["response_format"]["json_schema"]["schema"]["required"], ["q4"])
            with self.assertRaises(GenerationError) as error:
                findings["revise"](findings["sourceFindings"])
            self.assertEqual(error.exception.code, "REVISION_LIMIT")
            self.assertEqual(network.call_count, 2)

    def test_correction_rejects_unknown_or_excess_scope(self):
        from skill_authoring import correction_body, question_plan, apply_replacements
        scope = scope_for_lesson(self.lesson)
        rows = question_plan(self.lesson, scope)
        flat = {"title":"כותרת", "rule":"הנחיה", "practice":[{}]*17, "challenges":[{}]*3}
        for indexes in ([], [False], [0], [21], [3,3], list(range(1,8))):
            with self.subTest(indexes=indexes), self.assertRaises(GeneralSourceError):
                correction_body(flat, [{"question":i,"feedback":["fix"]} for i in indexes],
                    self.lesson, scope, rows, {}, "test")
        with self.assertRaises(GeneralSourceError):
            apply_replacements(flat, {"q5": ("practice",4)}, {"q6": {}})

    def test_skill_plan_covers_selected_concepts_and_respects_figure_policy_across_catalog(self):
        from skill_authoring import question_plan, worksheet_schema
        from general_source import geometry_topic
        for topic in catalog().topics:
            lesson = intake(topic)
            ids = [c['id'] for c in topic['concepts']]
            lesson['lessonBoundary']['conceptIds'] = ids
            scope = scope_for_lesson(lesson)
            with self.subTest(topic=topic['topicId']):
                rows = question_plan(lesson, scope)
                self.assertEqual(len(rows), lesson['questionCount'])
                self.assertTrue(all(r['group'] == 'practice' for r in rows[:-3]))
                self.assertTrue(all(r['group'] == 'challenges' for r in rows[-3:]))
                for cohort in (rows[:-3], rows[-3:]):
                    ordered = dict.fromkeys(c for row in cohort for c in row['conceptIds'])
                    self.assertEqual(list(ordered), ids)
                wire = worksheet_schema(lesson, scope)
                supports_figures = 'figure' in wire['$defs']['question']['properties']
                self.assertEqual(supports_figures, geometry_topic(scope))
                if not supports_figures:
                    self.assertFalse(any('representation' in row for row in rows))

    def test_author_receives_skill_content_truth_and_only_applicable_elementary_principles(self):
        from general_provider import author_guidance
        topic = catalog().topics[0]
        scope = scope_for_lesson(intake(topic))
        rules = {'authoring_policy_he': 'כלל לכל הנושאים', 'principles': [
            {'id': 'included', 'topic_ids': [topic['sourceTopicId']]},
            {'id': 'other', 'topic_ids': ['other']}]}
        def doc(path, value):
            return {'path': path, 'text': value, 'sha256': 'a' * 64}
        context = {'skill': {'documents': [
            doc('references/content-truth.md', 'אימות מול הנתונים'),
            doc('didactic_principles_elementary.json', json.dumps(rules))]}}
        actual = author_guidance(context, scope)['skill']
        self.assertEqual(actual['elementaryPrinciples']['applicable'], rules['principles'][:1])
        self.assertEqual(actual['documents'], context['skill']['documents'][:1])

    def test_rejects_incomplete_provider_rows_and_misplaced_challenges(self):
        # Both are real risks when a provider treats its schema as advisory.
        for only_stars in (True, False):
            payload=source(self.lesson)
            questions=payload['sections'][0]['questions']
            if only_stars:
                questions[:]=[{'star':q['star']} for q in questions]
                expected='SOURCE_SHAPE'
            else:
                questions[0]['star'],questions[-1]['star']=True,False
                expected='AUTHOR_PLAN_MISMATCH'
            with self.subTest(only_stars=only_stars), \
                    patch('provider.build_authoring_context',return_value={}), \
                    patch('provider.request_author_json',return_value=payload) as author, \
                    self.assertRaises(GenerationError) as caught:
                provider.author_lesson(self.lesson,**self.config)
            self.assertEqual(caught.exception.code,expected)
            author.assert_called_once()

    def test_provider_schemas_match_grade_specific_printable_notation(self):
        from general_source import authoring_schema
        try:
            import jsonschema
        except ImportError:
            self.skipTest('jsonschema is optional')
        for topic_id, grade, power_allowed in [('א01',1,False),('ג01',3,False),('ד11',4,True)]:
            topic=next(t for t in catalog().topics if t['topicId']==topic_id)
            lesson=intake(topic)
            schema=authoring_schema(lesson,scope_for_lesson(lesson))
            check=lambda ref: jsonschema.Draft202012Validator({'$ref':ref,'$defs':schema['$defs']})
            expression=check('#/$defs/expression')
            number={'type':'number','numerator':2,'denominator':1}
            with self.subTest(grade=grade):
                self.assertFalse(expression.is_valid({'type':'symbol','name':'x'}))
                self.assertFalse(expression.is_valid({'type':'operation','op':'sqrt','args':[number]}))
                self.assertEqual(expression.is_valid({'type':'operation','op':'power','args':[number,number]}),power_allowed)
                self.assertEqual(expression.is_valid({'type':'operation','op':'divide','args':[number,number]}),grade>1)
                title=jsonschema.Draft202012Validator(schema['properties']['title'])
                self.assertEqual(title.is_valid('מונים'),grade>2)
                if grade==1:
                    self.assertTrue(title.is_valid('מוֹנִים'))

    def test_grouped_questions_preserve_full_content_and_bind_challenge_flags(self):
        from general_provider import assemble_sections
        canonical=source(self.lesson)
        payload=copy.deepcopy(canonical)
        section=payload['sections'][0]
        questions=section.pop('questions')
        for question in questions:
            del question['star']
        section.update(practice=questions[:-3], challenges=questions[-3:])
        self.assertEqual(assemble_sections(payload,len(questions)),canonical)
        section['challenges'].pop()
        with self.assertRaises(GeneralSourceError):
            assemble_sections(payload,len(questions))

    def test_singleton_table_cells_from_provider_are_validated_without_changing_math(self):
        payload = source(self.lesson)
        cell = {"kind":"math","expression":{"type":"number","numerator":3,"denominator":1}}
        question = payload["sections"][0]["questions"][0]
        question["table"] = {"head":[{"kind":"text","text":"כמות"}, "מחיר"], "rows":[[cell, [cell]]]}
        scope = scope_for_lesson(self.lesson)
        with self.assertRaisesRegex(GeneralSourceError, "table.head.1"):
            validate_source(self.lesson, payload, scope)
        untouched = copy.deepcopy(payload)
        with patch('provider.build_authoring_context',return_value={}), patch('provider.request_author_json',return_value=payload) as author:
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
            with patch('provider.build_authoring_context',return_value={}), patch('provider.request_author_json',return_value=authored) as author:
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
                        if plan[qi]["kind"] == "digits":
                            self.assertNotEqual(b % 10, b // 10)
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
        with patch('provider.build_authoring_context',return_value={}), patch('provider.request_author_json',return_value=payload) as author:
            self.assertEqual(provider.author_lesson(lesson, **self.config), payload)
        author.assert_called_once()
        self.assertEqual(json.loads(author.call_args.args[2]["messages"][1]["content"])["teacherStoppingPoint"], lesson["lastLesson"])
        for override in ({"level":"a"}, {"lessonGoal":"review"}, {"questionCount":13},
                         {"lessonBoundary":{"conceptIds":["ב05#0","ב05#1"]}}):
            self.assertFalse(addition.compatible({**lesson, **override}))

    def test_full_source_alternative_enforces_the_selected_no_regrouping_concept(self):
        from math_tasks import number, operation
        fixture = HERE / 'cloud/container/fixtures/general/grade2-vocalized'
        lesson = json.loads((fixture/'lesson.json').read_text())
        payload = json.loads((fixture/'model-output.json').read_text())
        scope = scope_for_lesson(lesson)
        question = payload['sections'][0]['questions'][0]
        item = question['items'][0]
        add = lambda a,b: operation("add", number(a), number(b))
        valid = add(23, 14)
        cases = [("evaluate", add(19, 19)), ("evaluate", add(81, 20)),
                 ("evaluate", operation("multiply", number(12), number(2))),
                 ("evaluate", operation("add", number(3,2), number(30))),
                 ("evaluate", number(37)), ("compare", add(19, 19))]
        for kind, expression in cases:
            item["answer"]["task"] = ({"kind": kind, "expression":expression} if kind == "evaluate"
                                      else {"kind":kind, "left":valid, "right":expression})
            with self.subTest(task=item["answer"]["task"]), self.assertRaises(GeneralSourceError) as error:
                validate_source(lesson,payload,scope,provider=True)
            self.assertEqual(error.exception.code,"SOURCE_ADDITION_SCOPE")
        item["answer"]["task"] = {"kind":"compare","left":valid,"right":number(38)}
        validate_source(lesson,payload,scope,provider=True)
        for extra in ({"kind":"math","expression":add(19,19)}, {"kind":"text","text":"כִּתְבוּ 19 + 19"}):
            item["prompt"].append(extra)
            with self.assertRaises(GeneralSourceError) as error:
                validate_source(lesson,payload,scope,provider=True)
            self.assertEqual(error.exception.code,"SOURCE_ADDITION_SCOPE")
            item["prompt"].pop()

    def test_bad_general_response_never_retries_or_becomes_approved(self):
        envelope={'choices':[{'finish_reason':'stop','message':{'content':'{"version":4,"approved":true}'}}]}
        measured={}
        with patch('provider.build_authoring_context',return_value={}), patch('provider.build_opener') as network:
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
        with patch('provider.build_authoring_context',return_value={}), patch('provider.build_opener') as network:
            network.return_value.open.return_value=Response(envelope)
            with self.assertRaises(GenerationError) as raised:
                provider.author_lesson(self.lesson,metadata=measured,**self.config)
            network.return_value.open.assert_called_once()
        self.assertEqual(raised.exception.code,'AUTHOR_PLAN_MISMATCH')
        self.assertEqual(measured['validationError']['code'],'AUTHOR_PLAN_MISMATCH')
        self.assertFalse(measured['validated'])
        self.assertEqual([i+1 for i,q in enumerate(questions) if q['star']],[17,18,19])


if __name__=='__main__':unittest.main()
