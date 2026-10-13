import os, json, requests
spec = r"""You are a senior TypeScript reviewer. Review PR 108 (noamd-collab/noamdoronmath-worksheets, branch cursor/g9-kite-first-f014). It moves דלתון (kite) to FIRST place among grade 9 quadrilaterals on the /grade-9 hub page; expected order: דלתון, מקבילית, מלבן, מעוין, ריבוע, טרפז. Check correctness, that no other grade/section changes, links (hrefs) intact, no duplicates/missing items, the Noam AI topic-order consistency, and test quality. Do not invent issues; cite diff lines.
Output English Markdown: ## Verdict (PASS / PASS WITH NITS / FAIL) ## Blockers ## Should-fix ## Nits"""
content = spec + "\n\n## Diff\n```diff\n" + open("review.diff").read() + "\n```"
r = requests.post("https://token-plan.maas.qwencloudapi.com/compatible-mode/v1/chat/completions",
    headers={"Authorization": "Bearer " + os.environ["CHINESE_MODELS_API_KEY"], "Content-Type": "application/json"},
    json={"model": "deepseek-v4-pro", "stream": True, "temperature": 0.2, "messages": [{"role": "user", "content": content}]},
    stream=True, timeout=1800)
print("status", r.status_code, flush=True)
out=[]
for line in r.iter_lines():
    if not line: continue
    s=line.decode()
    if not s.startswith("data:"): print(s[:300]); continue
    d=s[5:].strip()
    if d=="[DONE]": break
    try:
        x=json.loads(d)
        if x.get("choices"):
            c=x["choices"][0]["delta"].get("content")
            if c: out.append(c)
    except Exception: pass
open("deepseek.md","w").write("".join(out)); print("chars",len("".join(out)))
