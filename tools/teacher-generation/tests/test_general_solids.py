"""Real pinned solid renderers: visible givens, topology and fail-closed probes."""
import copy
import os
from pathlib import Path
import sys
import unittest
import xml.etree.ElementTree as ET

APP=Path(__file__).resolve().parents[1]
SKILL=Path(os.environ.get('ELEMENTARY_SKILL_PATH',str(Path.home()/'.codex/skills/hebrew-math-worksheet-elementary')))
sys.path[:0]=[str(APP),str(SKILL/'scripts')]
import svg_elementary_ext as SX
from general_geometry import measure_elementary_svg,solve_figure_task
from math_tasks import number


def render(figure):
    shape='triangular_prism' if figure['shape']=='prism' else figure['shape']
    return SX.polyhedron_3d(shape,tuple(figure['dimensions']))


class SolidTests(unittest.TestCase):
    def test_all_supported_shapes_and_clamped_size_extremes_have_measured_topology(self):
        for shape,counts in [('box',(8,12,6)),('cube',(8,12,6)),('prism',(6,9,5)),('pyramid',(5,8,5))]:
            for dims in ([1,1,1],[3,4,5],[8,8,8],[8,1,3],[1,8,6]):
                with self.subTest(shape=shape,dims=dims):
                    figure={'kind':'solid','shape':shape,'dimensions':dims}
                    passed,evidence=measure_elementary_svg(figure,render(figure))
                    self.assertTrue(passed)
                    self.assertEqual(tuple(evidence[k] for k in ('vertices','edges','faces')),counts)
                    self.assertEqual(evidence['projection'],'schematic, not to scale')
                    for operation,expected in zip(('vertex_count','edge_count','face_count'),counts):
                        self.assertEqual(solve_figure_task(figure,operation)['result']['value'],number(expected))

    def test_volume_requires_all_three_visible_dimensions(self):
        for shape,volume in [('box',60),('cube',27)]:
            figure={'kind':'solid','shape':shape,'dimensions':[3,4,5]}
            passed,evidence=measure_elementary_svg(figure,render(figure))
            self.assertTrue(passed)
            self.assertEqual(len(evidence['labelledDimensions']),3)
            self.assertEqual(solve_figure_task(figure,'volume')['result']['value'],number(volume))
        for shape in ('prism','pyramid'):
            with self.assertRaisesRegex(ValueError,'No exact figure solver'):
                solve_figure_task({'kind':'solid','shape':shape,'dimensions':[3,4,5]},'volume')

    def test_changed_missing_or_moved_length_labels_fail(self):
        figure={'kind':'solid','shape':'box','dimensions':[3,4,5]}
        original=ET.fromstring(render(figure))
        for change in ('value','remove','position','opacity','font'):
            with self.subTest(change=change):
                root=copy.deepcopy(original)
                label=next(e for e in root if e.tag.endswith('text'))
                if change=='value':label.text='9'
                elif change=='remove':root.remove(label)
                elif change=='position':label.set('x','999')
                elif change=='opacity':label.set('opacity','0')
                else:label.set('font-size','0')
                self.assertFalse(measure_elementary_svg(figure,ET.tostring(root,encoding='unicode'))[0])

    def test_changed_duplicate_or_invisible_edges_and_overlay_fail(self):
        for shape in ('box','cube','prism','pyramid'):
            figure={'kind':'solid','shape':shape,'dimensions':[3,4,5]}
            original=ET.fromstring(render(figure))
            for change in ('endpoint','remove','duplicate','opacity','colour','overlay','path'):
                with self.subTest(shape=shape,change=change):
                    root=copy.deepcopy(original)
                    line=next(e for e in root if e.tag.endswith('line'))
                    if change=='endpoint':line.set('x2',str(float(line.get('x2'))+1))
                    elif change=='remove':root.remove(line)
                    elif change=='duplicate':root.append(copy.deepcopy(line))
                    elif change=='opacity':line.set('stroke-opacity','0')
                    elif change=='colour':line.set('stroke','#FFFFFF')
                    elif change=='path':ET.SubElement(root,'path',{'d':'M 0 0 L 100 0 L 100 100 L 0 100 Z','fill':'white','stroke':'none','stroke-width':'0'})
                    else:ET.SubElement(root,'rect',{'x':'0','y':'0','width':'500','height':'500','fill':'white','stroke':'none','stroke-width':'0'})
                    self.assertFalse(measure_elementary_svg(figure,ET.tostring(root,encoding='unicode'))[0])

    def test_wrong_typed_solid_or_dimensions_cannot_reuse_svg(self):
        figure={'kind':'solid','shape':'box','dimensions':[3,4,5]}
        svg=render(figure)
        for changed in ({'kind':'solid','shape':'prism','dimensions':[3,4,5]}, {'kind':'solid','shape':'box','dimensions':[4,3,5]}, {'kind':'solid','shape':'box','dimensions':[3,4,6]}):
            self.assertFalse(measure_elementary_svg(changed,svg)[0])


if __name__=='__main__':unittest.main()
