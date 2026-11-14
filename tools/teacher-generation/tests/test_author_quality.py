"""Offline pedagogy regressions; no model, renderer, storage or queue calls."""
import copy
import json
from pathlib import Path
import random
import sys
import unittest
from unittest.mock import patch

HERE=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(HERE))
from author_quality import (answer_concentration, division_template, division_order,
    missing_divisor_variety, numerical_pattern, prepare_didactics, unit_step_edit_distance)
from distractors import candidates, plan_distractors
from provider import derive_author_parameters, question_plan
from validation import GenerationError, read_json, validate_lesson, validate_model


def lesson(family, signed=True):
    value=read_json(HERE/f'examples/{family}-lesson.json')
    value['version']=2
    value['lessonBoundary']=({'version':1,'kind':'division_facts','allowedDivisors':list(range(1,11)),'maxDividend':100}
        if family=='elementary' else {'version':1,'kind':'linear_equations','allowSignedNumbers':signed})
    return value


def equations(known_pattern=False, shifted=False, signed=True):
    context=lesson('middle',signed);cap=validate_lesson(context)
    varied_a=[2,7,3,11,4,9,6,12,5,8,1,10]
    varied_x=[-12,4,9,-2,0,13,-7,6,15,-4,11,-14,1,8,-9,5,-15,12,-1,10,-8,3,14,-5,7,-10,2,-13,-3,-11]
    positive_x=[0,4,9,2,13,7,6,15,1,11,14,8,5,12,10,3]
    observed_x=list(range(1,16))+list(range(-1,-16,-1))
    pool=[(a,x) for a in range(1,13) for x in range(-15 if signed else 0,16)]
    sampled=random.Random(20261113 if signed else 20261114).sample(pool,60)
    raw={'version':3,'questions':[]}
    for qi in range(20):
        items=[]
        for ii in range(3):
            index=qi*3+ii
            a=(index+1)%12+1 if known_pattern else sampled[index][0]
            x=observed_x[(index+3+int(shifted))%30] if known_pattern else sampled[index][1]
            items.append({'a':a,'solution':x})
        raw['questions'].append({'items':items})
    payload=derive_author_parameters(context,cap,raw)
    validate_model(context,payload)
    return context,payload,cap


class AuthorQualityTests(unittest.TestCase):
    def test_actual_observed_pattern_is_reproduced_without_private_files(self):
        context,payload,cap=equations(known_pattern=True)
        before=copy.deepcopy(payload)
        stats=numerical_pattern(payload)
        self.assertEqual(stats['items'],60)
        self.assertEqual(stats['coefficientPeriod'],12)
        self.assertEqual(stats['coefficientUnitSteps'],54)
        self.assertEqual(stats['solutionUnitSteps'],55)
        self.assertTrue(stats['strongRepeatedPattern'])
        with self.assertRaises(GenerationError) as caught:prepare_didactics(context,payload,cap)
        self.assertEqual(caught.exception.code,'AUTHOR_EXAMPLE_COPY')
        self.assertEqual(payload,before)

    def test_long_pattern_is_blocked_even_without_the_reserved_example(self):
        context,payload,cap=equations(known_pattern=True,shifted=True)
        before=copy.deepcopy(payload)
        with self.assertRaises(GenerationError) as caught:prepare_didactics(context,payload,cap)
        self.assertEqual(caught.exception.code,'AUTHOR_NUMERIC_PATTERN')
        self.assertEqual(payload,before)

    def test_original_680_with_one_to_three_local_edits_is_blocked(self):
        for edited_indices in ([2],[0],[2,20],[2,20,40],[0,1,2],[2,3,4]):
            with self.subTest(edited_indices=edited_indices):
                context,payload,cap=equations(known_pattern=True)
                flat=[v for q in payload['questions'] for v in q['items']]
                for index in edited_indices:
                    item=flat[index]
                    item['solution']=7 if index==2 else 0
                    item['c']=item['a']*item['solution']+item['b']
                validate_model(context,payload)
                before=copy.deepcopy(payload)
                with self.assertRaises(GenerationError) as caught:
                    prepare_didactics(context,payload,cap)
                self.assertEqual(caught.exception.code,'AUTHOR_NUMERIC_PATTERN')
                self.assertEqual(payload,before)
                self.assertLessEqual(numerical_pattern(payload)['solutionUnitStepEdits'],len(edited_indices))

    def test_independent_cycles_and_near_cycles_are_blocked(self):
        context,payload,cap=equations(signed=False)
        coefficients=[2,7,3,11,4,9,6,12,5,8,1,10]
        roots=[0,4,9,2,13,7,6,15,1,11,14,8,5,12,10,3]
        flat=[v for q in payload['questions'] for v in q['items']]
        for index,item in enumerate(flat):
            item.update(a=coefficients[index%12],solution=roots[index%16])
            item['c']=item['a']*item['solution']+item['b']
        validate_model(context,payload)
        stats=numerical_pattern(payload)
        self.assertEqual(stats['coefficientPeriod'],12)
        self.assertEqual(stats['solutionPeriod'],16)
        for edit_count in range(4):
            changed=copy.deepcopy(payload)
            flat=[v for q in changed['questions'] for v in q['items']]
            for index in [2,20,40][:edit_count]:
                flat[index]['solution']=(flat[index]['solution']+3)%16
                flat[index]['c']=flat[index]['a']*flat[index]['solution']+flat[index]['b']
            validate_model(context,changed)
            with self.assertRaises(GenerationError) as caught:
                prepare_didactics(context,changed,cap)
            self.assertEqual(caught.exception.code,'AUTHOR_NUMERIC_PATTERN')

    def test_solution_cycle_is_measured_independently_of_coefficients(self):
        context,payload,cap=equations(signed=False)
        roots=[0,4,9,2,13,7,6,15,1,11,14,8,5,12,10,3]
        for index,item in enumerate(v for q in payload['questions'] for v in q['items']):
            item['solution']=roots[index%16]
            item['c']=item['a']*item['solution']+item['b']
        validate_model(context,payload)
        self.assertIsNone(numerical_pattern(payload)['coefficientPeriod'])
        with self.assertRaises(GenerationError) as caught:prepare_didactics(context,payload,cap)
        self.assertEqual(caught.exception.code,'AUTHOR_NUMERIC_PATTERN')

    def test_narrow_solution_domain_is_not_itself_a_pattern(self):
        context,payload,cap=equations(signed=False)
        rng=random.Random(113)
        for item in (v for q in payload['questions'] for v in q['items']):
            item.update(a=2,solution=rng.choice([0,1]))
            item['c']=2*item['solution']+item['b']
        validate_model(context,payload)
        self.assertFalse(numerical_pattern(payload)['strongRepeatedPattern'])
        self.assertTrue(prepare_didactics(context,payload,cap)[0]['passed'])

    def test_varied_parameters_and_short_deliberate_warmup_are_allowed(self):
        context,payload,cap=equations()
        quality,plan=prepare_didactics(context,payload,cap)
        self.assertTrue(quality['passed'])
        self.assertGreaterEqual(quality['mistakeFamilies'],3)
        self.assertGreaterEqual(quality['mistakeDeltas'],3)
        self.assertEqual(len(plan),21)
        for index,item in enumerate([item for q in payload['questions'][:4] for item in q['items']]):
            item.update(a=2,solution=index-3)
            item['c']=item['a']*item['solution']+item['b']
        validate_model(context,payload)
        self.assertTrue(prepare_didactics(context,payload,cap)[0]['passed'])
        self.assertFalse(numerical_pattern({'questions':payload['questions'][:4]})['strongRepeatedPattern'])

    def test_one_fixed_coefficient_alone_is_not_a_joint_pattern_failure(self):
        context,payload,cap=equations()
        for q in payload['questions']:
            for item in q['items']:
                item['a']=2;item['c']=2*item['solution']+item['b']
        validate_model(context,payload)
        self.assertTrue(prepare_didactics(context,payload,cap)[0]['passed'])

    def test_varied_coefficients_do_not_hide_one_dominant_answer(self):
        context,payload,cap=equations()
        rng=random.Random(104)
        for q in payload['questions']:
            for item in q['items']:
                item.update(a=rng.randint(1,12),solution=0,c=item['b'])
        validate_model(context,payload)
        self.assertFalse(numerical_pattern(payload)['strongRepeatedPattern'])
        # Count roots even when construct parts ask for c; all equations still
        # use the same x=0 solution, so a change of task form cannot hide it.
        self.assertEqual(answer_concentration(payload,cap)['largestAnswerCount'],60)
        original=copy.deepcopy(payload)
        with self.assertRaises(GenerationError) as caught:prepare_didactics(context,payload,cap)
        self.assertEqual(caught.exception.code,'AUTHOR_ANSWER_CONCENTRATION')
        self.assertEqual(payload,original)

    def test_answer_concentration_threshold_and_short_drill(self):
        cap={'family':'linear_equation'}
        def stats(values):
            return answer_concentration({'questions':[{'kind':'solve','items':[{'solution':v} for v in values]}]},cap)
        self.assertFalse(stats([0]*23)['dominantAnswer'])
        self.assertTrue(stats([0]*22+[1,2])['dominantAnswer'])
        self.assertFalse(stats([0]*21+[1,2,3])['dominantAnswer'])
        self.assertTrue(stats([0]*27+[1,2,3])['dominantAnswer'])
        self.assertFalse(stats([0]*26+[1,2,3,4])['dominantAnswer'])

    def test_answer_concentration_uses_the_answer_requested_by_each_task(self):
        payload={'questions':[
            {'kind':'calculate','items':[{'left':12,'right':3,'answer':4}]},
            {'kind':'missing_operand','items':[{'left':12,'right':3,'answer':4}]},
            {'kind':'missing_right','items':[{'left':12,'right':3,'answer':4}]},
        ]}
        self.assertEqual(answer_concentration(payload,{'family':'arithmetic'})['largestAnswerCount'],1)

    def test_complete_mechanical_divisor_grid_is_blocked(self):
        context=lesson('elementary');cap=validate_lesson(context)
        raw={'version':2,'questions':[{'items':[{'divisor':d,'quotient':qi%10+1} for d in (2,3,5)]} for qi in range(12)]}
        payload=derive_author_parameters(context,cap,raw)
        validate_model(context,payload)
        self.assertTrue(division_template(payload)['strongRepeatedTemplate'])
        with self.assertRaises(GenerationError) as caught:prepare_didactics(context,payload,cap)
        self.assertEqual(caught.exception.code,'AUTHOR_DIVISION_TEMPLATE')
        # Restricting the teacher's domain to those same three divisors is fine
        # when the authored combinations vary within questions.
        context['lessonBoundary']['allowedDivisors']=[2,3,5]
        for qi,q in enumerate(raw['questions']):
            for ii,item in enumerate(q['items']):item['quotient']=(qi+ii*3)%10+1
        varied=derive_author_parameters(context,cap,raw)
        validate_model(context,varied)
        self.assertTrue(division_template(varied)['fixedDivisorTriple'])
        self.assertFalse(division_template(varied)['strongRepeatedTemplate'])
        self.assertTrue(prepare_didactics(context,varied,cap)[0]['passed'])

    def test_single_fixed_divisor_and_short_related_fact_drill_are_allowed(self):
        payload={'questions':[{'items':[{'right':d,'answer':q} for d in (2,3,5)]} for q in range(1,8)]}
        self.assertFalse(division_template(payload)['strongRepeatedTemplate'])
        payload={'questions':[{'items':[{'right':3,'answer':q+ii} for ii in range(3)]} for q in range(12)]}
        self.assertFalse(division_template(payload)['strongRepeatedTemplate'])

    def test_sorted_division_fixture_is_rejected_without_requiring_all_divisors(self):
        context=lesson('elementary');cap=validate_lesson(context)
        facts=[(d,q) for d in range(2,6) for q in range(1,11)][:36]
        raw={'version':2,'questions':[{'items':[{'divisor':d,'quotient':q} for d,q in facts[i:i+3]]} for i in range(0,36,3)]}
        payload=derive_author_parameters(context,cap,raw)
        validate_model(context,payload)
        self.assertTrue(division_order(payload)['sortedFactTable'])
        with self.assertRaises(GenerationError) as caught:prepare_didactics(context,payload,cap)
        self.assertEqual(caught.exception.code,'AUTHOR_DIVISION_ORDER')
        self.assertFalse(division_order({'questions':payload['questions'][:4]})['sortedFactTable'])
        reversed_payload=copy.deepcopy(payload)
        reversed_payload['questions'].reverse()
        for q in reversed_payload['questions']:q['items'].reverse()
        self.assertTrue(division_order(reversed_payload)['sortedFactTable'])

    def test_constant_missing_divisor_is_conditional_on_teacher_domain(self):
        context=lesson('elementary')
        payload={'questions':[{'kind':'missing_right','items':[{'right':3,'answer':q} for q in (2,6,9)]}]}
        self.assertTrue(missing_divisor_variety(context,payload)['degenerateQuestion'])
        context['lessonBoundary']['allowedDivisors']=[3]
        self.assertFalse(missing_divisor_variety(context,payload)['degenerateQuestion'])
        self.assertFalse(division_order(payload)['sortedFactTable'])
        context['lessonBoundary']['allowedDivisors']=[2,3,5]
        for item,d in zip(payload['questions'][0]['items'],(2,3,5)):item['right']=d
        self.assertFalse(missing_divisor_variety(context,payload)['degenerateQuestion'])

    def test_fact_table_cannot_hide_behind_one_to_three_edits(self):
        context=lesson('elementary');cap=validate_lesson(context)
        facts=[(d,q) for d in range(2,6) for q in range(1,11)][:36]
        for changed in ([0],[17],[0,1],[5,19],[0,1,2],[5,19,31]):
            with self.subTest(changed=changed):
                edited=list(facts)
                for i,index in enumerate(changed):edited[index]=(10,i+1)
                raw={'version':2,'questions':[{'items':[{'divisor':d,'quotient':q} for d,q in edited[i:i+3]]}
                                             for i in range(0,36,3)]}
                payload=derive_author_parameters(context,cap,raw)
                validate_model(context,payload)
                before=copy.deepcopy(payload)
                self.assertTrue(division_order(payload)['sortedFactTable'])
                self.assertEqual(payload,before)
                reverse={'questions':[{'items':[{'right':d,'answer':q} for d,q in reversed(edited)]}]}
                self.assertTrue(division_order(reverse)['sortedFactTable'])

    def test_fact_table_rule_allows_bounded_focused_and_merely_sorted_controls(self):
        controls=[[(3,q) for q in range(11)]*3,
                  [(d,q) for d in range(2,11) for q in (1,3,6,10)],
                  random.Random(20261116).sample([(d,q) for d in (2,3,5) for q in range(11)],27)]
        for facts in controls:
            payload={'questions':[{'items':[{'right':d,'answer':q} for d,q in facts]}]}
            self.assertFalse(division_order(payload)['sortedFactTable'])
        facts=[(d,q) for d in range(2,6) for q in range(11)]
        self.assertTrue(division_order({'questions':[{'items':[{'right':d,'answer':q} for d,q in facts]}]})['sortedFactTable'])

    def test_partial_width_and_quotient_major_report_cases_are_rejected(self):
        context=lesson('elementary');cap=validate_lesson(context)
        partial=[(2,q) for q in range(1,11)]+[(d,q) for d in (3,4,5,6) for q in range(1,7)]+[(7,1),(7,2)]
        cases=[partial]
        for index,pair in [(13,(3,8)),(25,(8,4))]:
            changed=list(partial);changed[index]=pair;cases.append(changed)
        cases.append([(d,q) for q in range(1,10) for d in (2,3,4,5)])
        for divisors in [(2,3,4,5),(4,2,5,3),(7,3,9,5)]:
            facts=[(d,q) for d in divisors for q in range(1,10)]
            for index,pair in [(9,(10,1)),(21,(10,2)),(33,(10,3))]:facts[index]=pair
            cases.append(facts)
        for number,facts in enumerate(cases):
            with self.subTest(case=number):
                raw={'version':2,'questions':[{'items':[{'divisor':d,'quotient':q} for d,q in facts[i:i+3]]}
                                             for i in range(0,36,3)]}
                payload=derive_author_parameters(context,cap,raw);validate_model(context,payload)
                before=copy.deepcopy(payload);stats=division_order(payload)['adjacentTableSteps']
                self.assertTrue(stats['dominant'])
                self.assertGreaterEqual(stats['contributingDivisors'],2)
                with self.assertRaises(GenerationError) as caught:prepare_didactics(context,payload,cap)
                self.assertEqual(caught.exception.code,'AUTHOR_DIVISION_ORDER')
                self.assertEqual(payload,before)

    def test_table_adjacency_is_order_independent_and_single_run_is_not_a_gate(self):
        # Nonconsecutive taught divisors have a deterministic sorted rank.
        facts=[(d,q) for q in range(1,11) for d in (2,5)]
        payload={'questions':[{'items':[{'right':d,'answer':q} for d,q in facts]}]}
        stats=division_order(payload)
        self.assertEqual(stats['adjacentTableSteps']['divisorOrder'],[2,5])
        self.assertEqual(stats['adjacentTableSteps']['steps'],10)
        self.assertFalse(stats['sortedFactTable'])  # short drill, below 24 parts
        # Nine deliberate warm-up facts do not condemn the mixed whole sheet.
        warmup=[(2,q) for q in range(1,10)]
        remaining=random.Random(20261117).sample([(d,q) for d in range(3,11) for q in range(1,11)],27)
        facts=warmup+remaining;context=lesson('elementary');cap=validate_lesson(context)
        raw={'version':2,'questions':[{'items':[{'divisor':d,'quotient':q} for d,q in facts[i:i+3]]}
                                     for i in range(0,36,3)]}
        payload=derive_author_parameters(context,cap,raw);validate_model(context,payload)
        stats=division_order(payload)
        self.assertGreaterEqual(stats['adjacentTableSteps']['longestRun'],8)
        self.assertFalse(stats['sortedFactTable'])

    def test_rare_divisor_cannot_change_rank_of_the_whole_table(self):
        context=lesson('elementary');cap=validate_lesson(context)
        original=[(d,q) for q in range(1,10) for d in (2,5,8,10)]
        for edits in ([(14,(3,4))],[(14,(3,4)),(25,(6,7))],
                      [(14,(3,4)),(25,(6,7)),(32,(9,9))]):
            facts=list(original)
            for index,pair in edits:facts[index]=pair
            raw={'version':2,'questions':[{'items':[{'divisor':d,'quotient':q} for d,q in facts[i:i+3]]}
                                         for i in range(0,36,3)]}
            payload=derive_author_parameters(context,cap,raw);validate_model(context,payload)
            before=copy.deepcopy(payload);stats=division_order(payload)['adjacentTableSteps']
            self.assertEqual(stats['pairs'],35)  # no deletion or joining across an outlier
            self.assertGreaterEqual(stats['retainedItems'],33)
            self.assertTrue(stats['dominant'])
            self.assertIn(3,stats['excludedDivisors'])
            with self.assertRaises(GenerationError) as caught:prepare_didactics(context,payload,cap)
            self.assertEqual(caught.exception.code,'AUTHOR_DIVISION_ORDER')
            self.assertEqual(payload,before)

    def test_random_narrow_capacity_nine_and_single_divisor_are_not_table_patterns(self):
        # Capacity is exactly nine positive facts for [9,10], maxDividend45.
        # Facts may recur across different task kinds; canonical validation
        # forbids duplicates within one kind. Each seed is tested once.
        for allowed,maximum in [([9,10],45),([2,5],30),([5],50)]:
            context=lesson('elementary')
            context['lessonBoundary'].update(allowedDivisors=allowed,maxDividend=maximum)
            cap=validate_lesson(context);plan=question_plan(context,cap)
            facts=[(d,q) for d in allowed for q in range(1,min(10,maximum//d)+1)]
            for seed in range(20):
                rng=random.Random(20261120+seed)
                pools={kind:rng.sample(facts,9) for kind in cap['questionKinds']}
                raw={'version':2,'questions':[]}
                for q in plan:
                    chosen=pools[q['kind']][:3];del pools[q['kind']][:3]
                    raw['questions'].append({'items':[{'divisor':d,'quotient':v} for d,v in chosen]})
                payload=derive_author_parameters(context,cap,raw);validate_model(context,payload)
                self.assertFalse(division_order(payload)['sortedFactTable'],(allowed,seed))

    def test_mixed_sheet_rejects_uniform_missing_divisor_without_mutation(self):
        context=lesson('elementary');cap=validate_lesson(context)
        fixed=[(3,1),(3,4),(3,9)]
        available=[(d,q) for d in range(2,11) for q in range(1,11) if (d,q) not in fixed]
        flat=random.Random(20261115).sample(available,33)
        plan=question_plan(context,cap)
        target=next(i for i,q in enumerate(plan) if q['kind']=='missing_right')
        flat[target*3:target*3]=fixed
        raw={'version':2,'questions':[{'items':[{'divisor':d,'quotient':q} for d,q in flat[i:i+3]]}
                                     for i in range(0,36,3)]}
        payload=derive_author_parameters(context,cap,raw)
        validate_model(context,payload)
        self.assertFalse(division_order(payload)['sortedFactTable'])
        before=copy.deepcopy(payload)
        with self.assertRaises(GenerationError) as caught:prepare_didactics(context,payload,cap)
        self.assertEqual(caught.exception.code,'AUTHOR_MISSING_DIVISOR_CONSTANT')
        self.assertEqual(payload,before)

    def test_elementary_reserved_example_is_blocked(self):
        context=lesson('elementary');cap=validate_lesson(context)
        payload=read_json(HERE/'examples/elementary-model.json')
        payload['questions'][0]['items']=[{'left':d*q,'right':d,'answer':q,'op':'divide'} for d,q in [(3,4),(5,6),(7,8)]]
        with self.assertRaises(GenerationError) as caught:prepare_didactics(context,payload,cap)
        self.assertEqual(caught.exception.code,'AUTHOR_EXAMPLE_COPY')

    def test_all_division_candidate_claims_are_false_and_grade_bounded(self):
        for divisor in range(1,11):
            for quotient in range(11):
                item={'left':divisor*quotient,'right':divisor,'answer':quotient,'op':'divide'}
                choices=candidates(item,'arithmetic')
                self.assertTrue(choices)
                self.assertEqual(len({c['proposed'] for c in choices}),len(choices))
                for choice in choices:
                    self.assertGreaterEqual(choice['proposed'],0)
                    self.assertLessEqual(choice['proposed'],100)
                    self.assertNotEqual(choice['proposed']*divisor,item['left'])
                    self.assertTrue(choice['mistake'])

    def test_equation_candidates_are_substituted_and_positive_boundary_is_respected(self):
        for signed in (True,False):
            for a in range(1,13):
                for b in (-60,-1,1,60) if signed else (1,30,60):
                    for x in range(-15 if signed else 0,16):
                        item={'a':a,'b':b,'c':a*x+b,'solution':x}
                        choices=candidates(item,'linear_equation',allow_signed=signed)
                        self.assertTrue(choices,(signed,item))
                        for choice in choices:
                            self.assertNotEqual(a*choice['proposed']+b,item['c'])
                            self.assertLessEqual(abs(choice['proposed']),250)
                            if not signed:
                                self.assertGreaterEqual(choice['proposed'],0)
                                self.assertGreaterEqual(a*choice['proposed']+b,0)

    def test_plan_varies_mistakes_without_changing_exercises(self):
        for family in ('elementary','middle'):
            if family=='middle': context,payload,cap=equations(signed=False)
            else:
                context=lesson(family);payload=read_json(HERE/f'examples/{family}-model.json');cap=validate_model(context,payload)
            original=copy.deepcopy(payload)
            plan=plan_distractors(context,payload,cap)
            self.assertGreaterEqual(len({v['family'] for v in plan.values()}),3)
            self.assertGreaterEqual(len({v['delta'] for v in plan.values()}),3)
            self.assertNotEqual({v['delta'] for v in plan.values()},{1})
            self.assertEqual(plan,plan_distractors(context,payload,cap))
            self.assertEqual(payload,original)


if __name__=='__main__':unittest.main()
