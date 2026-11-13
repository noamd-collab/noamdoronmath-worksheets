"""Repair the two-step linear-equation pilot for editable Word web output.

Only the pinned emitter's simple integer x/k expressions are supported.
Every printed text node and bookmark stays in document order. Complex math
and unknown formatting fail closed. The original package is never modified.
The runner applies this only to the verified grade 7 basic linear pilot, then
reruns the pinned G90/G91 checker on the final file. New outputs still require
human review; successful representative tests are not approval of every job.
"""
from __future__ import annotations
import argparse
import copy
import hashlib
import json
from pathlib import Path
from zipfile import ZipFile
from lxml import etree as E

NS = {'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
      'm':'http://schemas.openxmlformats.org/officeDocument/2006/math'}
W, M = '{'+NS['w']+'}', '{'+NS['m']+'}'


def _hash(value):
    return hashlib.sha256(value).hexdigest()


def _sequence_hash(values):
    return _hash(json.dumps(values, ensure_ascii=False, separators=(',',':')).encode())


def invariants(root):
    return {
        'textNodes': _sequence_hash([(e.tag,e.text or '',dict(e.attrib)) for e in root.iter() if e.tag in (W+'t',M+'t')]),
        'mathXml': _sequence_hash([E.tostring(e,method='c14n').decode() for e in root.iter(M+'oMath')]),
        'bookmarks': _sequence_hash([(e.tag,dict(e.attrib)) for e in root.iter() if e.tag in (W+'bookmarkStart',W+'bookmarkEnd')]),
        'nativeMathCount': len(list(root.iter(M+'oMath'))),
    }


def _shape(node, tag, attributes, children=()):
    if node is None or node.tag != tag or dict(node.attrib) != attributes:
        raise ValueError('Unexpected mathematical formatting')
    if [child.tag for child in node] != list(children):
        raise ValueError('Unsupported mathematical formatting properties')


def _validate_run_properties(properties):
    _shape(properties, W+'rPr', {}, (W+'rFonts', W+'sz', W+'szCs', W+'rtl'))
    fonts,size,cs_size,rtl=list(properties)
    _shape(fonts,W+'rFonts',{W+'ascii':'Cambria Math',W+'cs':'Cambria Math',W+'hAnsi':'Cambria Math'})
    value=size.get(W+'val')
    if value not in ('20','23'):
        raise ValueError('Unsupported pinned math font size')
    _shape(size,W+'sz',{W+'val':value})
    _shape(cs_size,W+'szCs',{W+'val':value})
    _shape(rtl,W+'rtl',{W+'val':'0'})


def _validate_simple_omml(math):
    _shape(math,M+'oMath',{},(M+'box',))
    box=math[0]
    _shape(box,M+'box',{},(M+'boxPr',M+'e'))
    box_properties,expression=list(box)
    _shape(box_properties,M+'boxPr',{},(M+'noBreak',M+'ctrlPr'))
    _shape(box_properties[0],M+'noBreak',{})
    _shape(box_properties[1],M+'ctrlPr',{},(W+'rPr',))
    _validate_run_properties(box_properties[1][0])
    _shape(expression,M+'e',{},(M+'r',))
    run=expression[0]
    _shape(run,M+'r',{},(M+'rPr',W+'rPr',M+'t'))
    style,properties,text=list(run)
    _shape(style,M+'rPr',{},(M+'sty',))
    _shape(style[0],M+'sty',{M+'val':'p'})
    _validate_run_properties(properties)
    _shape(text,M+'t',{'{http://www.w3.org/XML/1998/namespace}space':'preserve'})
    if E.tostring(box_properties[1][0],method='c14n') != E.tostring(properties,method='c14n'):
        raise ValueError('Inconsistent mathematical formatting')
    return text.text or '',properties


def _publish_zip_without_overwrite(destination, infos, members):
    """Build privately, then atomically link the completed file at its new name."""
    import os
    import tempfile
    descriptor,tempname=tempfile.mkstemp(prefix='.teacher-word-',suffix='.docx',dir=str(destination.parent))
    temporary=Path(tempname)
    try:
        with os.fdopen(descriptor,'wb') as output:
            with ZipFile(output,'w') as archive:
                for entry in infos:archive.writestr(entry,members[entry.filename])
            output.flush();os.fsync(output.fileno())
        os.link(temporary,destination)
    finally:
        temporary.unlink(missing_ok=True)


def simple_ltr_math(source, destination):
    """Editable LTR text for the pilot's linear math only.

    The pinned G90 checker explicitly permits LRM-bounded rtl=0 runs (R7/R8).
    This is intentionally NOT a converter for fractions, powers or other OMML.
    """
    import re
    source,destination=Path(source),Path(destination)
    if source.resolve()==destination.resolve() or destination.exists():
        raise ValueError('Diagnostic requires a new output path')
    with ZipFile(source) as archive:
        infos=archive.infolist()
        if len({i.filename for i in infos})!=len(infos) or sum(i.file_size for i in infos)>25_000_000:
            raise ValueError('Unexpected DOCX package')
        members={i.filename:archive.read(i) for i in infos}
    root=E.fromstring(members['word/document.xml'],E.XMLParser(resolve_entities=False,no_network=True))
    if root.getroottree().docinfo.doctype:
        raise ValueError('DTD is not part of the pinned DOCX contract')
    before=invariants(root)
    def printed(r):
        return [(e.text or '').replace('\u200e','') for e in r.iter() if e.tag in (W+'t',M+'t')]
    old_printed=printed(root)
    math_nodes=list(root.iter(M+'oMath'))
    if not math_nodes:raise ValueError('No pilot math found')
    math_texts=[]
    for math in math_nodes:
        if math.getparent().tag!=W+'p':raise ValueError('Unsupported non-inline math')
        value,rp=_validate_simple_omml(math)
        term=r'(?:[0-9]+[xk]?|[xk])'
        expression=r'[−-]?'+term+r'(?:\s*[+−-]\s*'+term+r')*'
        if len(value)>80 or not re.fullmatch(expression+r'(?:\s*=\s*'+expression+r')?',value.strip()):
            raise ValueError('Outside the simple linear-equation pilot grammar')
        replacement=E.Element(W+'r');replacement.append(copy.deepcopy(rp))
        rtl=replacement[0].find(W+'rtl')
        if rtl is None:raise ValueError('Missing explicit math direction')
        rtl.set(W+'val','0')
        text=E.SubElement(replacement,W+'t');text.set('{http://www.w3.org/XML/1998/namespace}space','preserve')
        text.text='\u200e'+value+'\u200e'
        math.getparent().replace(math,replacement);math_texts.append(value)
    answer_paragraphs=0
    # Split only the emitter's known standalone labels; text/run order is unchanged.
    for paragraph in list(root.iter(W+'p')):
        if paragraph.getparent().tag!=W+'tc':continue
        children=[n for n in paragraph if n.tag!=W+'pPr']
        label_positions=[i for i,n in enumerate(children) if n.tag==W+'r' and ''.join(n.itertext()) in [c+'.' for c in 'אבגדהו']]
        if not label_positions:continue
        if label_positions[0]!=0 or len(label_positions)<2:raise ValueError('Unexpected answer label structure')
        props=paragraph.find(W+'pPr')
        if props is None:raise ValueError('Missing answer paragraph properties')
        replacement_paragraphs=[]
        for item_index,(start,end) in enumerate(zip(label_positions,label_positions[1:]+[len(children)])):
            new=E.Element(W+'p');pp=copy.deepcopy(props)
            spacing=pp.find(W+'spacing')
            if spacing is not None:spacing.set(W+'after','60')
            # Word web may ignore cantSplit on a multi-paragraph answer cell.
            # Chain subitems only within this answer; never into the next row.
            for tag in ('keepNext','keepLines'):
                existing=pp.find(W+tag)
                if existing is not None:pp.remove(existing)
            position=1 if pp.find(W+'pStyle') is not None else 0
            if item_index < len(label_positions)-1:
                keep=E.Element(W+'keepNext');keep.set(W+'val','1');pp.insert(position,keep);position+=1
            keep_lines=E.Element(W+'keepLines');keep_lines.set(W+'val','1');pp.insert(position,keep_lines)
            new.append(pp)
            for n in children[start:end]:new.append(n)
            replacement_paragraphs.append(new)
        parent=paragraph.getparent()
        row=parent.getparent()
        if row.tag!=W+'tr':raise ValueError('Unsupported nested answer structure')
        row_props=row.find(W+'trPr')
        if row_props is None:row_props=E.Element(W+'trPr');row.insert(0,row_props)
        cant_split=row_props.find(W+'cantSplit')
        if cant_split is None:cant_split=E.SubElement(row_props,W+'cantSplit')
        cant_split.set(W+'val','1')
        offset=parent.index(paragraph);parent.remove(paragraph)
        for i,new in enumerate(replacement_paragraphs):parent.insert(offset+i,new)
        answer_paragraphs+=len(replacement_paragraphs)
    after=invariants(root)
    if old_printed!=printed(root) or before['bookmarks']!=after['bookmarks']:
        raise ValueError('Printed text/bookmark parity failed')
    if after['nativeMathCount']!=0:raise ValueError('Unexpected unconverted math')
    members['word/document.xml']=E.tostring(root,xml_declaration=True,encoding='UTF-8',standalone=True)
    destination.parent.mkdir(parents=True,exist_ok=True)
    _publish_zip_without_overwrite(destination,infos,members)
    return {'version':1,'variant':'simple-ltr-text',
            'sourceSha256':_hash(source.read_bytes()),'outputSha256':_hash(destination.read_bytes()),
            'outputBytes':destination.stat().st_size,'convertedSimpleMathRuns':len(math_nodes),
            'mathTextSequenceSha256':_sequence_hash(math_texts),'answerSubitemParagraphs':answer_paragraphs,'answerSubitemKeepLines':True,'withinAnswerKeepNext':True,
            'printedTextSequencePreserved':True,'bookmarksPreserved':True,'before':before,'after':after,
            'changedZipMembers':['word/document.xml'],'tradeoff':'Editable mathematical text; not native equation objects',
            'visualReview':'pending for this output'}


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input',required=True);parser.add_argument('--output',required=True)
    parser.add_argument('--manifest',required=True)
    args=parser.parse_args()
    result=simple_ltr_math(args.input,args.output)
    Path(args.manifest).write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result))
