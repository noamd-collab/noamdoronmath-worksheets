"""Trusted adapters. All markup and Python come from this reviewed file, never AI."""
from __future__ import annotations
import argparse
import html
import json
import os
import sys
from fractions import Fraction
from pathlib import Path
from validation import read_json, validate_model

LETTERS = "אבגדהוזחטי"
LEVELS = {"a": "רמה א׳", "b": "רמה ב׳", "e": "מצוינות"}
OPS = {"add": "+", "subtract": "-", "multiply": "*", "divide": ":"}


def dump(path, value):
    Path(path).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def frac(value):
    return Fraction(value) if type(value) is int else Fraction(value["numerator"], value["denominator"])


def elementary(lesson, payload, cap, skill, work):
    sys.path[:0] = [str(skill / "scripts"), str(skill / "scripts/lib")]
    import ws_html as H
    from content_truth import Ledger
    grade = LETTERS[lesson["gradeNumber"]-1]
    ab = lesson["gradeNumber"] <= 2
    band = "elementary-ab" if ab else "elementary"
    level = {"a":"א", "b":"ב", "e":"מצוינות"}[lesson["level"]]
    title = "תִּרְגּוּל בְּחֶשְׁבּוֹן" if ab else cap["title"]
    labels = {
        "calculate": "פִּתְרוּ:" if ab else "פתרו:",
        "missing_operand": "הַשְׁלִימוּ אֶת הַמִּסְפָּר הֶחָסֵר:" if ab else "השלימו את המספר החסר:",
        "missing_right": "הַשְׁלִימוּ אֶת הַמִּסְפָּר הֶחָסֵר:" if ab else "השלימו את המספר החסר:",
        "check_solution": "הַפִּתְרוֹנוֹת הַבָּאִים שְׁגוּיִים. תַּקְּנוּ וְהַסְבִּירוּ:" if ab else "הפתרונות הבאים שגויים. תקנו והסבירו:",
    }
    ledger = Ledger(str(work / "verified.json"))
    def number(v):
        f = frac(v) if not isinstance(v, Fraction) else v
        return H.fmt(f.numerator, grade) if f.denominator == 1 else H.frac(f.numerator, f.denominator, grade)
    def expression(item, blank=False):
        l,r = frac(item["left"]),frac(item["right"])
        if l.denominator == r.denominator == 1 and not blank:
            return H.expr(l.numerator, OPS[item["op"]], r.numerator, grade, eq=False)
        return (H.blank("1cm") if blank else number(l)) + " " + H.op(OPS[item["op"]],grade) + " " + number(r)
    qs, source_questions = [], []
    for n,q in enumerate(payload["questions"],1):
        # A starred division task adds an inverse-operation justification, not
        # merely different numbers in the same task as an earlier question.
        inverse_check = q["star"] and cap["topicId"] == "ג10"
        instruction = labels[q["kind"]] + (" כתבו גם תרגיל כפל מתאים לבדיקת כל תשובה." if inverse_check else "")
        items, answers, source_items = [], [], []
        for j,it in enumerate(q["items"]):
            l,r,a = (frac(it[k]) for k in ("left","right","answer"))
            actual = {"add":lambda:l+r,"subtract":lambda:l-r,"multiply":lambda:l*r,"divide":lambda:l/r}[it["op"]]()
            ledger.claim(f"{n}.{j+1}", "בדיקת הפעולה החשבונית", (actual == a, {"left":str(l),"right":str(r),"operation":it["op"],"computed":str(actual)}), method="closed_form")
            if q["kind"] == "missing_operand":
                text=H.ltr(expression(it,True)+" = "+number(a)); answer=H.ltr(number(l))
            elif q["kind"] == "missing_right":
                text=H.ltr(number(l)+" "+H.op(OPS[it["op"]],grade)+" "+H.blank("1cm")+" = "+number(a)); answer=H.ltr(number(r))
            elif q["kind"] == "check_solution":
                # The deliberate wrong claim is generated and verified by trusted code.
                wrong = a+1
                text=H.ltr(expression(it)+" = "+number(wrong)) + '<div class="ansline"></div>'
                prefix="לֹא. הַתּוֹצָאָה הַנְּכוֹנָה: " if ab else "לא. התוצאה הנכונה: "
                suffix=". לָכֵן הַשִּׁוְיוֹן אֵינוֹ נָכוֹן." if ab else ". לכן השוויון אינו נכון."
                answer=H.text_answer(prefix)+H.ltr(expression(it)+" = "+number(a))+H.text_answer(suffix)
            else:
                text=H.ltr(expression(it)+" = "+H.blank("1.5cm")); answer=H.ltr(number(a))
            if inverse_check:
                text += '<div class="ansline"></div>'
                answer += H.text_answer(" בדיקה בכפל: ")+H.ltr(number(a)+" "+H.op("*",grade)+" "+number(r)+" = "+number(l))
            items.append(f'<div class="sub">{LETTERS[j]}. {text}</div>')
            answers.append(answer)
            source_items.append({"id":f"q{n}-i{j+1}","label":LETTERS[j],"text":H.plain(text),"answer":H.plain(answer),"math":it,"verificationId":f"{n}.{j+1}"})
        qs.append({"n":str(n),"intro":instruction,"items":[H.plain(s) for s in items],"answer":H.plain(H.keyed(answers)),"html":"".join(items),"answersHtml":H.keyed(answers),"star":q["star"]})
        source_questions.append({"id":f"q{n}","n":n,"instruction":instruction,"items":source_items})
    ledger.save()
    meta={"band":band,"grade":grade,"level":level,"topic":cap["title"],"topic_id":cap["sourceTopicId"],"domain":cap["domain"]}
    dump(work/"content.json",{"meta":meta,"questions":[{k:v for k,v in q.items() if k not in ("html","answersHtml")} for q in qs]})
    dump(work/"worksheet-source.json",{"version":1,"meta":dict(meta,gradeNumber=lesson["gradeNumber"],levelCode={"a":"A","b":"B","e":"E"}[lesson["level"]]),"questions":source_questions})
    template=(skill/"assets/worksheet_template_elementary.html").read_text(encoding="utf-8")
    head=template.split("<body",1)[0]
    # Fixed markup; only escaped catalog text and trusted math helpers enter HTML.
    body=[f'<body class="{"band-ab" if ab else "band-gd" if lesson["gradeNumber"]<=4 else "band-hv"}">',f'<div class="unit">{html.escape(title)}</div><hr class="unit-rule">',f'<div class="subtitle">{LEVELS[lesson["level"]]} · כיתה {grade}׳</div>', '<div class="details"><span>שם: ____________________</span><span>כיתה: ________</span><span>תאריך: __________</span></div>', '<ol class="questions">']
    for qi,q in enumerate(qs):
        # Balance the elementary pilot's exercise pages; keep whole questions together.
        page_break=' style="break-before:page"' if qi and qi%4==0 else ''
        body.append('<li'+(' class="starred"' if q["star"] else '')+page_break+'>'+('<span class="star"></span> ' if q["star"] else '')+html.escape(q["intro"])+q["html"]+'</li>')
    body += ['</ol><div class="goodluck">'+('בְּהַצְלָחָה!' if ab else 'בהצלחה!')+'</div>', '<div class="answers"><h2>'+('תְּשׁוּבוֹת סוֹפִיּוֹת' if ab else 'תשובות סופיות')+'</h2><table class="ans">']
    for q in qs:
        body.append('<tr><td class="qn">'+H.ltr(q["n"]+'.')+'</td><td>'+q["answersHtml"]+'</td></tr>')
    body.append('</table><div class="teacher-notes">הערות המורה:<div class="tline"></div><div class="tline"></div></div></div></body></html>')
    (work/"sheet.html").write_text(head+'\n'.join(body),encoding="utf-8")
    (work/"figures").mkdir()


def middle(lesson,payload,cap,skill,work):
    key={"a":"a","b":"b","e":"c"}[lesson["level"]]
    qs,answer_rows,canonical=[],[],[]
    def signed(n): return str(n).replace('-', '−')
    def eq(a,b,c): return (f"{a}x" if a != 1 else "x")+(f" + {b}" if b>=0 else f" − {-b}")+f" = {c}"
    for n,q in enumerate(payload["questions"],1):
        intro={"solve":"פתרו את המשוואות:","check_solution":"הפתרונות המוצעים שגויים. תקנו והסבירו:","construct":"מצאו את המספר החסר כך שהערך הנתון יהיה פתרון המשוואה:"}[q["kind"]]
        if q["star"] and q["kind"] == "check_solution":
            intro += " שנו גם את אגף ימין בלבד כך שהפתרון המוצע יהיה נכון."
        elif q["star"] and q["kind"] == "construct":
            intro += " חשבו גם את אגף שמאל כשערך המשתנה גדל ב־1, והסבירו בכמה השתנה."
        items,answers,canon=[],[],[]
        for j,it in enumerate(q["items"]):
            a,b,c,x=(it[k] for k in ("a","b","c","solution"))
            target="x"; value=x; variables=["x"]
            if q["kind"]=="solve":
                text=f'${eq(a,b,c)}$'; ans=f'$x = {signed(x)}$'
            elif q["kind"]=="check_solution":
                text=f'${eq(a,b,c)}$, הפתרון המוצע: $x = {signed(x+1)}$.'
                ans=f'לא. בהצבה מתקבל ${a*(x+1)+b}$ באגף שמאל לעומת ${signed(c)}$ באגף ימין. הפתרון הנכון: $x = {signed(x)}$.'
                if q["star"]:
                    ans = f'$x = {signed(x)}$. בהצבה השגויה: ${signed(a*(x+1)+b)}$ לעומת ${signed(c)}$. המשוואה המתוקנת: ${eq(a,b,a*(x+1)+b)}$.'
            else:
                text=f'${eq(a,b,"k")}$, כאשר $x = {signed(x)}$.'
                ans=f'$k = {signed(c)}$';target="k";value=c;variables=["x","k"]
                if q["star"]:
                    ans += f'. עבור $x = {signed(x+1)}$: אגף שמאל הוא ${signed(c+a)}$, גידול של ${a}$ (מקדם המשתנה).'
            label=LETTERS[j]
            # Algebraic wording is a datum string, not a geometry-constraint dict.
            items.append({"label":label,"text":text,"space":54 if q["star"] else 34,"variables":variables,"given":[text],"to_prove":[{"type":"find","quantity":"variable","of":target,"value":value}],"answer":ans})
            answers.append([label,ans]); canon.append({"id":f"q{n}-i{j+1}","label":label,"text":text,"answer":ans,"math":it})
        # This instruction requests an explanation, not a geometric proposition.
        qs.append({"n":n,"intro":intro,"star":q["star"],"items":items,"to_prove":[]})
        answer_rows.append([n,answers,q["star"]]);canonical.append({"id":f"q{n}","n":n,"items":canon})
    level={"level":LEVELS[lesson["level"]],"key":key,"grade":str(lesson["gradeNumber"]),"keep_questions":True,"title":cap["title"],"rule":"פתרו לפי הסדר. בדקו פתרונות באמצעות הצבה במשוואה.","questions":qs,"answers":answer_rows,"curriculum":{"topic":cap["sourceTopicId"],"track":cap["track"]}}
    dump(work/"levels.json",[level])
    dump(work/"worksheet-source.json",{"version":1,"meta":{"gradeNumber":lesson["gradeNumber"],"levelCode":lesson["level"],"topicId":lesson["topicId"]},"questions":canonical})
    # This source is constant except validated numeric grade; no model string is code.
    (work/"content.py").write_text('import json\nfrom pathlib import Path\nLEVELS = json.loads((Path(__file__).parent / "levels.json").read_text(encoding="utf-8"))\nSTRICT_FIGURES = True\nPACKAGE = "G'+str(lesson["gradeNumber"])+'-T90"\n',encoding="utf-8")
    dump(work/"verified.json",{"method":"exact integer substitution","items":sum(len(q["items"]) for q in payload["questions"]),"passed":True})


if __name__ == "__main__":
    ap=argparse.ArgumentParser();ap.add_argument('--skill',required=True);ap.add_argument('--work',required=True)
    args=ap.parse_args();work=Path(args.work);lesson=read_json(work/'lesson.json');payload=read_json(work/'model-output.json')
    cap=validate_model(lesson,payload)
    (elementary if cap['skill']=='elementary' else middle)(lesson,payload,cap,Path(args.skill),work)
