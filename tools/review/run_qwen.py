import os,json,requests,base64
imgs=['shots/desk_grade-9-quads.png','shots/phone_grade-9-quads.png','shots/desk_grade-9.png','shots/desk_worksheets_grade_9.png','shots/phone_worksheets_grade_9.png']
spec="""You are a strict visual/UX reviewer for a Hebrew RTL math site. Images, in order: """+", ".join(imgs)+""".
PR 108 moves דלתון to FIRST among grade 9 quadrilaterals on /grade-9. Expected order in section «מרובעים ומשולשים»: דלתון, מקבילית, מלבן, מעוין, ריבוע, טרפז, then the triangle topics. Also a quick check of /worksheets?grade=9. Given below: link list and link check measured in the browser (JSON).
Check PASS/FAIL: A) order; B) links (per JSON); C) layout regressions (overflow, misalignment, RTL, clipped text) on desktop and phone; D) /worksheets?grade=9 looks fine.
Output English Markdown: ## Verdict (APPROVE / APPROVE WITH NITS / REQUEST CHANGES) ## Blockers ## Should-fix ## Nits ## Per-screenshot notes. Cite the screenshot. Do not invent issues."""+", ".join(imgs)+""".
Feature under review (PR 107, "נועם AI" site companion chat): on grade 9 pages, «יש מרובעים?» must list grade 9 quadrilaterals in didactic order, Dalton (דלתון) first, trapezoid after the square, no duplicates, never a grade 3 answer; the input clears after send; on phone the panel is a bottom sheet with a «סגירה» button that does not cover the lesson content (the animation card) and closes properly; the accessibility button (wheelchair icon) must not cover the lesson card.
NOTE: on the preview host the companion API is blocked by a security check, so screenshots show «נועם AI לא זמין כרגע». The real answers, produced by running the server logic directly, are in the transcript below; judge their wording/order there. Also given: geometry JSON (rects [left,top,right,bottom] in CSS px of card, a11y button, panel) measured in the browser.
Check PASS/FAIL: A) answer order & content & no duplicates & no grade 3; B) input empty after send; C) phone bottom sheet: does it cover the important part of the animation card? does «סגירה» exist and does closing restore the page; D) a11y button vs lesson card on desktop and phone; E) other layout regressions, RTL, clutter, tap target sizes.
Output English Markdown: ## Verdict (APPROVE / APPROVE WITH NITS / REQUEST CHANGES) ## Blockers ## Should-fix ## Nits ## Per-screenshot notes. Cite the screenshot. Do not invent issues."""+", ".join(imgs)+""".
Feature under review: after every hint or question from "רמזי" (the hint AI), two buttons «הבנתי» / «לא הבנתי» must appear. «לא הבנתי» must ALWAYS be there (student must never feel embarrassed / dead-ended). «לא הבנתי» flow: warm reply, then a more detailed hint, then the full explanation when hints run out. «הבנתי»: short ack then next step.
Exercise: prove ED = EB given BD bisects ∠ABC, E on AB, DE ∥ BC (D on AC).
Also given: full transcript text of the flow, and a simulation of the guide-less exercise path (live AI was blocked on the preview host by a security check), below.
This is RE-CHECK round 4. NEW parts: buttons now also under the closing message and error/fallback messages (latest bubble only); «לא הבנתי» after the closing message re-explains (live AI blocked on preview host, so it shows the offline fallback); the warm opening rotates from the 4th try. Previous round focus: Focus: student bubble shows only «לא הבנתי» (never an AI instruction); warm opening «זה בסדר גמור, בואו ננסה אחרת.» on each «לא הבנתי» reply; buttons ONLY under the latest reply (none under closing message); fallbacks per button (guide-less live AI is blocked on the preview host, so its plan/fallback JSON is in the transcript); the RTL line «DE ∥ BC והישר DB חותך אותם.» must read in correct order. Then full regression. Check each item PASS/FAIL: A) hint shown with buttons; B) «לא הבנתי» x4+: opens next hint then breaks the full explanation into sub-steps, hint counter synced, no verbatim repeat, warm tone; C) «הבנתי» after full explanation closes politely; D) buttons under every reply (and whether this is cluttered on phone); E) guide-less path (live AI blocked on preview host by security check — judge the fallback text and what the student sees as their own message); F) gender-neutral wording; G) ∠ABC RTL display and any other bidi scrambling of lines mixing Latin and Hebrew. Also: 1) RTL & bidi of math (are ∠ names / equations scrambled visually?), 2) wording warmth & age-appropriateness (also gender: "שמח" vs plural forms), 3) buttons always present & sized/tappable on phone, 4) dead ends / repetition, 5) math correctness, 6) visual hierarchy/clutter, 7) guide-less path quality.
Output English Markdown: ## Verdict (APPROVE / APPROVE WITH NITS / REQUEST CHANGES) ## Blockers ## Should-fix ## Nits ## Per-screenshot notes ## Math check. Cite the screenshot. Do not invent issues."""
txt=open('flow.json').read()
content=[{"type":"text","text":spec+"\n\n## Transcript\n"+txt}]
for p in imgs: content.append({"type":"image_url","image_url":{"url":"data:image/png;base64,"+base64.b64encode(open(p,'rb').read()).decode()}})
r=requests.post('https://token-plan.maas.qwencloudapi.com/compatible-mode/v1/chat/completions',headers={'Authorization':'Bearer '+os.environ['CHINESE_MODELS_API_KEY']},json={"model":"qwen3.8-max","stream":True,"enable_thinking":False,"temperature":0.2,"messages":[{"role":"user","content":content}]},stream=True,timeout=1200)
print(r.status_code);out=[]
for line in r.iter_lines():
    s=line.decode() if line else ''
    if not s: continue
    if not s.startswith('data:'): print(s[:300]);continue
    d=s[5:].strip()
    if d=='[DONE]':break
    try:
        x=json.loads(d)['choices'][0]['delta'].get('content')
        if x: out.append(x)
    except Exception: pass
open('qwen.md','w').write(''.join(out));print(''.join(out))
