"""Exact tasks bound to the actual typed figure input, never prose claims."""
from __future__ import annotations

from copy import deepcopy
import math
import xml.etree.ElementTree as ET
from math_tasks import number, operation, validate_and_solve_task


def solve_figure_task(figure, operation_name, point=None):
    """Return the same result envelope as math_tasks for supported quantities.

    This proves the model quantity, not arbitrary claims in nearby prose.
    The pinned renderer and its measured-SVG gates still qualify the drawing.
    """
    def calc(expr):
        return validate_and_solve_task({"kind":"evaluate", "expression":expr})
    add=lambda a,b: operation("add",a,b)
    mul=lambda a,b: operation("multiply",a,b)
    kind=figure["kind"]
    expr=None
    if point is not None and kind!="coordinate_plane":raise ValueError("Point references are only supported by coordinate figures")
    if kind=="coordinate_plane":
        if operation_name in ("x_coordinate","y_coordinate"):
            match=next((p for p in figure["points"] if p["name"]==point),None)
            if match is None:raise ValueError("Unknown coordinate point")
            expr=number(match["x" if operation_name=="x_coordinate" else "y"])
        elif operation_name=="maximum":expr=number(max(p["y"] for p in figure["points"]))
        elif operation_name=="minimum":expr=number(min(p["y"] for p in figure["points"]))
    elif kind=="grid_shape":
        cells=figure["cells"]
        if operation_name=="area":
            expr=number(sum(map(sum,cells)))
        elif operation_name=="perimeter":
            value=0
            for y,row in enumerate(cells):
                for x,filled in enumerate(row):
                    if filled:
                        for dy,dx in ((-1,0),(1,0),(0,-1),(0,1)):
                            ny,nx=y+dy,x+dx
                            value+=int(not(0<=ny<len(cells) and 0<=nx<len(row)) or not cells[ny][nx])
            expr=number(value)
    elif kind=="solid":
        dims=figure["dimensions"]
        if figure["shape"]=="cube":dims=[dims[0]]*3
        if operation_name=="volume" and figure["shape"] in ("box","cube"):
            expr=number(dims[0]*dims[1]*dims[2])
        # The pinned prism/pyramid renderer omits the height label, so their
        # volume is deliberately unsupported. Topology needs no hidden length.
        topology={"box":(8,12),"cube":(8,12),"prism":(6,9),"pyramid":(5,8)}
        if figure["shape"] in topology:
            vertices,edges=topology[figure["shape"]]
            if operation_name=="vertex_count":expr=number(vertices)
            elif operation_name=="edge_count":expr=number(edges)
            elif operation_name=="face_count":expr=number(2-vertices+edges)
    elif kind=="clock":
        if operation_name=="hour":expr=number(figure["hour"])
        elif operation_name=="minute":expr=number(figure["minute"])
    elif kind=="bar_chart":
        if operation_name=="total":expr=number(sum(figure["values"]))
        elif operation_name=="maximum":expr=number(max(figure["values"]))
        elif operation_name=="minimum":expr=number(min(figure["values"]))
    elif kind=="shape":
        p=figure["parameters"];shape=figure["shape"]
        if operation_name=="area":
            if shape=="rectangle":expr=number(p["w"]*p["h"])
            elif shape=="square":expr=number(p["a"]**2)
            elif shape=="rhombus":expr=number(p["d1"]*p["d2"],2)
            elif shape=="trapezoid":expr=number((p["a"]+p["b"])*p["h"],2)
            elif shape=="triangle":
                a,b,c=(p[k] for k in "abc");s=number(a+b+c,2)
                expr=operation("sqrt",mul(mul(s,operation("subtract",s,number(a))),mul(operation("subtract",s,number(b)),operation("subtract",s,number(c)))))
        elif operation_name=="perimeter":
            if shape=="rectangle":expr=number(2*(p["w"]+p["h"]))
            elif shape=="square":expr=number(4*p["a"])
            elif shape=="parallelogram":expr=number(2*(p["a"]+p["b"]))
            elif shape=="triangle":expr=number(sum(p.values()))
            elif shape=="polygon":expr=number(p["n"]*p["a"])
            elif shape=="rhombus":expr=mul(number(2),operation("sqrt",number(p["d1"]**2+p["d2"]**2)))
        elif operation_name=="diameter" and shape=="circle":expr=number(2*p["r"])
        elif operation_name=="side_count" and shape!="circle":expr=number(3 if shape=="triangle" else p["n"] if shape=="polygon" else 4)
    if expr is None:
        raise ValueError("No exact figure solver for this constructor and requested quantity")
    result=calc(expr)
    result["question"]={"kind":"figure_measure","operation":operation_name,"figure":deepcopy(figure),"point":point}
    result["verification"]={"method":"exact formula or exhaustive cell-edge enumeration bound to figure input", "scope":"typed figure quantity only; rendered geometry remains subject to pinned gates"}
    return result


FIGURE_OPERATIONS=("area","perimeter","volume","face_count","edge_count","vertex_count","hour","minute","total","maximum","minimum","diameter","side_count","x_coordinate","y_coordinate")
FIGURE_PROMPTS={"area":"חשבו את השטח.","perimeter":"חשבו את ההיקף.","volume":"חשבו את הנפח.","hour":"כתבו איזו שעה מציין מחוג השעות.","minute":"כתבו כמה דקות מציין מחוג הדקות.","total":"חשבו את הסכום הכולל של הערכים בגרף.","maximum":"כתבו את הערך הגבוה ביותר בגרף.","minimum":"כתבו את הערך הנמוך ביותר בגרף.","diameter":"חשבו את קוטר המעגל.","side_count":"כתבו כמה צלעות יש למצולע."}


def _measure_solid_svg(figure, root):
    """Check the actual pinned schematic's edges and visible dimension labels.

    polyhedron_3d clamps its projected sizes; this verifies its documented
    projection, topology and printed lengths, not metric lengths from pixels.
    A missing/altered edge, dimension label or invisible overlay fails closed.
    """
    shape=figure['shape'];dims=figure['dimensions']
    if shape not in ('box','cube','prism','pyramid'):
        return False,{'reason':'Unsupported solid constructor'}
    length,width,height=([dims[0]]*3 if shape=='cube' else dims)
    fw=max(68,min(150,length*26));fh=max(56,min(120,height*26))
    dx=max(28,min(64,int(width*26*.55)));dy=max(22,min(48,int(width*26*.42)))
    x,y=26,24+dy
    a,b,t=(x,y+fh),(x+fw,y+fh),(x+fw/2,y)
    d,c=(x+dx,y+fh-dy),(x+fw+dx,y+fh-dy)
    tl,tr,bt,br=(x,y),(x+fw,y),(x+dx,y-dy),(x+fw+dx,y-dy)
    if shape=='pyramid':
        apex=(x+fw/2+dx/2,18)
        visible=[(a,b),(b,c),(a,apex),(b,apex),(c,apex)]
        hidden=[(a,d),(d,c),(d,apex)];polygons=[];fronts=[];hidden_width=1.3
    elif shape=='prism':
        t2=(t[0]+dx,t[1]-dy)
        visible=[(a,b),(b,t),(t,a),(b,c),(t,t2),(c,t2)]
        hidden=[(a,d),(d,c),(d,t2)];polygons=[];fronts=[];hidden_width=1.3
    else:
        visible=[(tl,tr),(tr,b),(b,a),(a,tl),(tl,bt),(tr,br),(b,c),(bt,br),(br,c)]
        hidden=[(a,d),(d,c),(d,bt)];hidden_width=1.4
        polygons=[([tl,tr,br,bt],'#DCECFB'),([tr,b,c,br],'#D7F0ED')]
        fronts=[(x,y,fw,fh,'#F8FAFC',0),(x,y,fw,fh,'none',2)]
    expected_labels=[(str(length),x+fw/2,y+fh+18,'middle'),(str(width),x+fw+dx/2+12,y+fh-dy/2+6,'middle')]
    if shape in ('box','cube'):expected_labels.append((str(height),x-10,y+fh/2+5,'end'))
    def num(value):
        result=float(value)
        if not math.isfinite(result):raise ValueError('Nonfinite SVG coordinate')
        return round(result,3)
    def edge(p,q):return tuple(sorted((tuple(map(num,p)),tuple(map(num,q)))))
    expected_edges={(edge(p,q),2.0,False) for p,q in visible}|{(edge(p,q),hidden_width,True) for p,q in hidden}
    measured_edges=[];labels=[];paths=[];rects=[]
    allowed={
        'svg':{'width','height','dir'},
        'line':{'x1','y1','x2','y2','stroke','stroke-width','stroke-dasharray'},
        'rect':{'x','y','width','height','fill','stroke','stroke-width'},
        'path':{'d','fill','stroke','stroke-width'},
        'text':{'x','y','font-size','text-anchor','direction','unicode-bidi','font-family','fill','font-weight'},
    }
    try:
        if root.tag.rsplit('}',1)[-1]!='svg' or root.get('dir')!='ltr' or num(root.get('width'))!=fw+dx+76 or num(root.get('height'))!=fh+dy+56:
            raise ValueError('Wrong solid canvas')
        for node in root.iter():
            tag=node.tag.rsplit('}',1)[-1]
            if tag not in allowed or set(node.attrib)-allowed[tag] or tag!='svg' and len(node):
                raise ValueError('Unexpected or hidden SVG markup')
            if tag=='svg':
                if node is not root:raise ValueError('Nested SVG')
            elif tag=='line':
                dashed=node.get('stroke-dasharray')=='5,4'
                if node.get('stroke')!=('#64748B' if dashed else '#1F6FC5') or node.get('stroke-dasharray') not in (None,'5,4'):
                    raise ValueError('Solid edge is not visible')
                measured_edges.append((edge((node.get('x1'),node.get('y1')),(node.get('x2'),node.get('y2'))),num(node.get('stroke-width')),dashed))
            elif tag=='rect':
                xx,yy,ww,hh=(num(node.get(k)) for k in ('x','y','width','height'))
                sw=num(node.get('stroke-width'));fill=node.get('fill')
                rects.append((xx,yy,ww,hh,fill,sw))
                if node.get('stroke')!=('#1F6FC5' if sw else 'none'):raise ValueError('Wrong front-face stroke')
                if sw:
                    points=[(xx,yy),(xx+ww,yy),(xx+ww,yy+hh),(xx,yy+hh)]
                    measured_edges.extend((edge(points[i],points[(i+1)%4]),sw,False) for i in range(4))
            elif tag=='path':
                tokens=node.get('d','').split()
                if len(tokens)!=13 or tokens[::3]!=['M','L','L','L','Z'] or node.get('stroke')!='none' or num(node.get('stroke-width'))!=0:
                    raise ValueError('Unexpected face path')
                paths.append(([(num(tokens[i]),num(tokens[i+1])) for i in (1,4,7,10)],node.get('fill')))
            elif tag=='text':
                if node.get('fill')!='#1A1A2E' or node.get('font-family')!='David Libre' or num(node.get('font-size'))!=13 or node.get('direction')!='ltr' or node.get('unicode-bidi')!='embed' or node.get('font-weight')!='bold':
                    raise ValueError('Dimension label is not visibly rendered')
                labels.append((''.join(node.itertext()),num(node.get('x')),num(node.get('y')),node.get('text-anchor')))
        if len(measured_edges)!=len(expected_edges) or set(measured_edges)!=expected_edges or rects!=fronts or paths!=polygons or sorted(labels)!=sorted(expected_labels):
            raise ValueError('Solid edges, faces or dimension labels differ from typed figure')
        vertices={point for item in measured_edges for point in item[0]}
        return True,{'method':'measured projected edges, face polygons and visible dimension labels','projection':'schematic, not to scale','vertices':len(vertices),'edges':len(measured_edges),'faces':2-len(vertices)+len(measured_edges),'labelledDimensions':[label[0] for label in labels]}
    except (TypeError,ValueError,KeyError):
        return False,{'reason':'Solid SVG does not match its typed constructor and visible dimension labels'}


def measure_elementary_svg(figure, svg):
    """Measure emitted SVG, not the requested input, before a figure_assert.

    Only the pinned grid/clock/bar/solid constructors have a measurement contract.
    Unknown constructors fail closed; their presence is not geometric proof.
    """
    root=ET.fromstring(svg);nodes=list(root.iter())
    kind=lambda node:node.tag.rsplit('}',1)[-1]
    close=lambda a,b:abs(float(a)-float(b))<0.11
    if figure['kind']=='solid':
        return _measure_solid_svg(figure,root)
    if figure['kind']=='grid_shape':
        cells=figure['cells'];rects=[e for e in nodes if kind(e)=='rect' and e.get('stroke-width')=='0.8']
        actual={(round(float(e.get('x'))),round(float(e.get('y')))):e for e in rects}
        expected={(10+24*x,10+24*y):bool(c) for y,row in enumerate(cells) for x,c in enumerate(row)}
        holds=set(actual)==set(expected) and all(close(actual[p].get('width'),24) and close(actual[p].get('height'),24) and (actual[p].get('fill')=='#D7F0ED')==filled for p,filled in expected.items())
        edges=[e for e in nodes if kind(e)=='line' and e.get('stroke-width')=='2.2']
        measured=sum(math.hypot(float(e.get('x2'))-float(e.get('x1')),float(e.get('y2'))-float(e.get('y1'))) for e in edges)/24
        perimeter=solve_figure_task(figure,'perimeter')['result']['value']['numerator']
        holds=holds and close(measured,perimeter)
        return holds,{'method':'measured cell rectangles and drawn boundary lines','filledCells':sum(e.get('fill')=='#D7F0ED' for e in rects),'boundaryUnits':measured}
    if figure['kind']=='clock':
        circles=[e for e in nodes if kind(e)=='circle' and close(e.get('r',0),44)]
        if len(circles)!=1:return False,{'reason':'clock rim missing'}
        cx,cy=(float(circles[0].get(k)) for k in ('cx','cy'));measured={}
        for hand,width in [('hour','3.2'),('minute','2')]:
            lines=[e for e in nodes if kind(e)=='line' and e.get('stroke-width')==width]
            if len(lines)!=1:return False,{'reason':'clock hand missing'}
            e=lines[0]
            if not close(e.get('x1'),cx) or not close(e.get('y1'),cy):return False,{'reason':'hand does not start at centre'}
            measured[hand]=math.degrees(math.atan2(float(e.get('x2'))-cx,cy-float(e.get('y2'))))%360
        expected={'hour':((figure['hour']%12)+figure['minute']/60)*30,'minute':figure['minute']*6}
        holds=all(abs((measured[k]-expected[k]+180)%360-180)<0.4 for k in expected)
        return holds,{'method':'angles of drawn hand endpoints from clock centre','degrees':measured}
    if figure['kind']=='bar_chart':
        rects=[e for e in nodes if kind(e)=='rect' and e.get('stroke-width')=='1.6']
        ticks=[e for e in nodes if kind(e)=='text' and e.get('text-anchor')=='end']
        if len(rects)!=len(figure['values']) or len(ticks)<2:return False,{'reason':'bar or axis tick missing'}
        a,b=ticks[:2];dy=float(a.get('y'))-float(b.get('y'));dv=float(''.join(b.itertext()))-float(''.join(a.itertext()))
        if dy<=0 or dv<=0:return False,{'reason':'invalid numeric axis scale'}
        scale=dy/dv;actual=[float(e.get('height'))/scale for e in sorted(rects,key=lambda e:float(e.get('x')))]
        return all(close(a,b) for a,b in zip(actual,figure['values'])),{'method':'bar heights divided by actual labelled axis scale','values':actual}
    return False,{'reason':'No measured-SVG assertion implemented for this elementary constructor'}
