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
from author_quality import answer_concentration, division_template, numerical_pattern, prepare_didactics
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
    raw={'version':3,'questions':[]}
    for qi in range(20):
        items=[]
        for ii in range(3):
            index=qi*3+ii
            a=(index+1)%12+1 if known_pattern else varied_a[index%12]
            x=observed_x[(index+3+int(shifted))%30] if known_pattern else (varied_x[index%30] if signed else positive_x[index%16])
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
