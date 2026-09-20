"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const DidacticGuides = require("../noam-didactic-guides.js");

const html = fs.readFileSync(path.join(__dirname, "../worksheet-viewer-noam.html"), "utf8");
const helpers = html.slice(html.indexOf("function announceNoam(text){"), html.indexOf("function syncMobilePanel(){"));
const askSource = html.slice(html.indexOf("function noamGeometryContext(text){"), html.indexOf("function postJson(endpoint,payload){"));
const mathOutputInstruction = vm.runInNewContext(
  html.match(/var MATH_OUTPUT_INSTRUCTION\s*=\s*([\s\S]*?);\n\nvar GRADE_NAME/)[1]
);

function helperFixture() {
  let nextTimer = 0;
  const timers = new Map();
  const status = { textContent: "" };
  const elements = new Map([["noamAnnouncements", status]]);
  const ctx = {
    noamAnnouncementTimer: null,
    panel: { classList: { contains: () => false } },
    document: { getElementById: id => elements.get(id) },
    setTimeout(fn) { timers.set(++nextTimer, fn); return nextTimer; },
    clearTimeout(id) { timers.delete(id); }
  };
  vm.createContext(ctx);
  vm.runInContext(helpers, ctx);
  return { ctx, status, elements, flush() { for (const fn of timers.values()) fn(); timers.clear(); } };
}

test("status announcements replace the prior event and can repeat the same message", () => {
  const f = helperFixture();
  f.ctx.announceNoam("thinking");
  f.ctx.announceNoam("new answer");
  f.flush();
  assert.equal(f.status.textContent, "new answer");
  f.ctx.announceNoam("new answer");
  assert.equal(f.status.textContent, "");
  f.flush();
  assert.equal(f.status.textContent, "new answer");
});

test("chat focus returns to a recreated control, or the conversation while controls are disabled", () => {
  const f = helperFixture();
  const focused = [];
  const input = { disabled: false, getClientRects: () => [1], focus: () => focused.push("input") };
  const transcript = { focus: () => focused.push("transcript") };
  f.elements.set("noamQuestion", input);
  f.elements.set("noamTranscript", transcript);
  f.ctx.restoreNoamChatFocus("noamQuestion");
  input.disabled = true;
  f.ctx.restoreNoamChatFocus("noamQuestion");
  f.ctx.restoreNoamChatFocus("removed-control");
  f.ctx.restoreNoamChatFocus("");
  f.ctx.panel.classList.contains = () => true;
  f.ctx.restoreNoamChatFocus("noamQuestion");
  assert.deepEqual(focused, ["input", "transcript", "transcript"]);
});

async function requestFixture(result, options = {}) {
  const notices = [];
  const thread = { hintIndex: 0, history: options.history || [], messages: [{ role: "assistant", text: "old answer must not repeat" }] };
  const focusRestores = [];
  const payloads = [];
  const outcomes = Array.isArray(result) ? result.slice() : [result];
  const ctx = {
    selectedExercise: options.exercise || { id: "q1a", q: 1, part: "א" }, busy: false,
    noamDrafts: {}, API: "/test", g: 7, lv: "a", LEVEL: { a: "A" }, ttl: options.topic || "test",
    SOLVER_MESSAGE_MAX: 700, MATH_OUTPUT_INSTRUCTION: "", MIN_WAIT: 0,
    window: {
      NoamLocalVisual: { wantsVisualSupport: options.wantsVisualSupport || (() => false), parseLabeledTriangle: () => null },
      NoamDidacticGuides: options.didacticGuides
    },
    panelBody: { contains: () => true }, document: { activeElement: { id: "noamHint" } },
    exerciseThread: () => thread, exerciseLabel: () => "שאלה 1 · סעיף א",
    saveNoamState() {}, renderNoamChat() {},
    setNoamBusy(value) { ctx.busy = value; },
    restoreNoamChatFocus(id) { focusRestores.push(id); },
    announceNoam(value) { notices.push(value); },
    getExerciseAnalysis: () => Promise.resolve(options.analysis || { readable: true }),
    postJson: (url, payload) => {
      payloads.push(payload);
      const outcome = outcomes.length > 1 ? outcomes.shift() : outcomes[0];
      return outcome instanceof Error ? Promise.reject(outcome) : Promise.resolve(outcome);
    },
    setTimeout(fn) { fn(); }
  };
  vm.createContext(ctx);
  vm.runInContext(askSource, ctx);
  ctx.askNoam(options.helpKind || "hint", options.studentMessage || "help");
  await new Promise(resolve => setImmediate(resolve));
  return { notices, thread, focusRestores, ctx, payloads };
}

test("a successful request announces only its new answer, with the selected question", async () => {
  const f = await requestFixture({ ok: true, answer: "new answer" });
  assert.equal(f.notices.length, 2);
  assert.match(f.notices[0], /מכין תשובה.*שאלה 1/);
  assert.match(f.notices[1], /שאלה 1.*נועם AI: new answer/);
  assert.ok(f.notices.every(text => !text.includes("old answer")));
  assert.deepEqual(f.focusRestores, ["noamHint"]);
  assert.equal(f.ctx.busy, false);
});

test("a refused request announces its actual error without announcing old history", async () => {
  const f = await requestFixture(new Error("verification refused"));
  assert.equal(f.notices.length, 2);
  assert.match(f.notices[1], /שאלה 1.*verification refused/);
  assert.ok(f.notices.every(text => !text.includes("old answer")));
  assert.equal(f.ctx.busy, false);
});

test("geometry follow-ups carry recent context and a non-circular proof guard through the legacy bridge", async () => {
  const history = [
    {role:"user",content:"אפשר רמז?"},
    {role:"assistant",content:"השתמש בנתון DE מקביל ל-BC."}
  ];
  const f = await requestFixture(
    {ok:true,answer:"בדקו את הקודקוד ואת שתי הקרניים."},
    {topic:"משולש שווה שוקיים",history}
  );
  const message = f.payloads[0].studentMessage;
  assert.match(message,/הפרד בין הנתונים לבין מה שצריך להוכיח/);
  assert.match(message,/אסור להשתמש במסקנה כנתון/);
  assert.match(message,/אל תבלבל אותו עם ישר חותך/);
  assert.match(message,/הקשר קודם/);
  assert.match(message,/DE מקביל ל-BC/);
  assert.match(message,/הודעת התלמיד עכשיו: help/);
  assert.ok(message.length <= 700);
});

test("the verified guide fits the backend limit with its goal, chain and angle prohibition intact", () => {
  const ctx = {
    window: { NoamLocalVisual: {}, NoamDidacticGuides: DidacticGuides },
    SOLVER_MESSAGE_MAX: 700,
    MATH_OUTPUT_INSTRUCTION: mathOutputInstruction,
    Set, Math, String, Number, Array, Object, RegExp, Promise
  };
  vm.createContext(ctx);
  vm.runInContext(askSource, ctx);
  const prompt = ctx.noamDidacticPrompt("G9-T15-E-Q04א");
  const message = ctx.noamSolverMessage("אפשר להסביר לי מה הצעד הבא?", { history: [] }, "הוכחה גאומטרית", prompt);
  assert.ok(message.length <= 700);
  assert.match(message, /להוכיח ED = EB/);
  assert.match(message, /∠DBC = ∠EDB/);
  assert.match(message, /∠EBD אינה זווית מתחלפת/);
  assert.match(message, /הודעת התלמיד עכשיו/);
});

const question4Analysis = {
  readable: true,
  transcription: "במשולש ABC הנקודה E נמצאת על AB. הקטע BD חוצה את ∠ABC, וכן DE ∥ BC. הוכיחו: ED = EB."
};

function geometryReviewFixture() {
  const ctx = {
    window: { NoamLocalVisual: {} },
    SOLVER_MESSAGE_MAX: 700,
    MATH_OUTPUT_INSTRUCTION: "",
    API: "/test",
    postJson: () => Promise.reject(new Error("not used")),
    Set, Math, String, Number, Array, Object, RegExp, Promise
  };
  vm.createContext(ctx);
  vm.runInContext(askSource, ctx);
  return ctx;
}

test("the client rejects both exact geometry failures from the question 4 transcript", () => {
  const ctx = geometryReviewFixture();
  const circular = ctx.noamGeometryAnswerReview(
    "שימו לב לנתון ED=EB, ולכן המשולש EDB שווה שוקיים.",
    question4Analysis,
    null
  );
  const wrongAlternate = ctx.noamGeometryAnswerReview(
    "מכיוון ש-DE ∥ BC, הזוויות ∠EBD ו-∠DBC הן זוויות מתחלפות פנימיות.",
    question4Analysis,
    null
  );
  assert.equal(circular.ok, false);
  assert.match(circular.reasons.join(" "), /יעד ההוכחה/);
  assert.equal(wrongAlternate.ok, false);
  assert.match(wrongAlternate.reasons.join(" "), /∠EBD|אותו קודקוד/);
});

test("the alternate-angle guard reads the claimed pair instead of every nearby angle", () => {
  const ctx = geometryReviewFixture();
  const answer = "ידוע ש-∠EBD=∠DBC מחוצה הזווית, ואילו ∠DBC ו-∠EDB הן זוויות מתחלפות פנימיות כי DE ∥ BC. לכן ∠EBD=∠EDB, ומכאן ED=EB.";
  const review = ctx.noamGeometryAnswerReview(answer, question4Analysis, null);
  assert.deepEqual(JSON.parse(JSON.stringify(review)), { ok: true, reasons: [] });
});

test("question 4 angle confusion is answered locally from the verified guide", async () => {
  const f = await requestFixture(new Error("the model must not be called"), {
    exercise: { id: "G9-T15-E-Q04א", q: 4, part: "א" },
    didacticGuides: DidacticGuides,
    topic: "הוכחה גאומטרית",
    helpKind: "free_question",
    studentMessage: "איזה זווית קשה לי לזהות"
  });
  assert.equal(f.payloads.length, 0);
  const response = f.thread.messages.at(-1);
  assert.match(response.text, /∠EDB/);
  assert.match(response.text, /∠DBC/);
  assert.match(response.text, /מתחלפות פנימיות/);
  assert.equal(response.visual.type, "question-image");
  assert.equal(response.visual.focusKey, "q4a-alternate");
});

test("a named-angle question keeps the local answer and diagram on that same angle", async () => {
  const f = await requestFixture(new Error("the model must not be called"), {
    exercise: { id: "G9-T15-E-Q04א", q: 4, part: "א" },
    didacticGuides: DidacticGuides,
    topic: "הוכחה גאומטרית",
    helpKind: "free_question",
    studentMessage: "איפה הזווית ∠EBD?"
  });
  assert.equal(f.payloads.length, 0);
  const response = f.thread.messages.at(-1);
  assert.match(response.text, /∠EBD/);
  assert.doesNotMatch(response.text, /∠EDB|∠DBC/);
  assert.equal(response.visual.focusKey, "q4a-angle-ebd");
});

test("a guided next-step answer keeps the authoritative drawing when the student asks to draw", async () => {
  const f = await requestFixture(new Error("the model must not be called"), {
    exercise: { id: "G9-T15-E-Q04א", q: 4, part: "א" },
    didacticGuides: DidacticGuides,
    wantsVisualSupport: text => /לשרטט/.test(text),
    topic: "הוכחה גאומטרית",
    helpKind: "free_question",
    studentMessage: "ואז מה? אתה יכול לשרטט לי את המשולש?"
  });
  assert.equal(f.payloads.length, 0);
  const response = f.thread.messages.at(-1);
  assert.match(response.text, /∠EBD\s*=\s*∠DBC/);
  assert.equal(response.visual.type, "question-image");
  assert.equal(response.visual.focusKey, "q4a-base-angles");
});

test("two unsafe model answers fall back to the verified proof chain", async () => {
  const f = await requestFixture([
    { ok: true, answer: "שימו לב לנתון ED=EB, ולכן המשולש EDB שווה שוקיים." },
    { ok: true, answer: "מכיוון ש-DE ∥ BC, ∠EBD ו-∠DBC הן זוויות מתחלפות." }
  ], {
    exercise: { id: "G9-T15-E-Q04א", q: 4, part: "א" },
    didacticGuides: Object.assign({}, DidacticGuides, { respond: () => null }),
    analysis: question4Analysis,
    topic: "הוכחה גאומטרית",
    helpKind: "free_question",
    studentMessage: "אפשר הסבר מלא?"
  });
  assert.equal(f.payloads.length, 2);
  assert.match(f.payloads[0].studentMessage, /מדריך מאומת/);
  assert.match(f.payloads[1].studentMessage, /טיוטת התשובה נפסלה/);
  const finalAnswer = f.thread.messages.at(-1).text;
  assert.match(finalAnswer, /∠DBC = ∠EDB/);
  assert.match(finalAnswer, /ED = EB/);
  assert.doesNotMatch(finalAnswer, /נתון ED=EB/);
});

function luminance(hex) {
  return hex.match(/\w\w/g).map(pair => parseInt(pair, 16) / 255)
    .map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4)
    .reduce((sum, c, index) => sum + c * [.2126, .7152, .0722][index], 0);
}

test("active accent controls retain readable text for every grade", () => {
  const defaults = html.match(/:root\{([\s\S]*?)\}/)[1];
  const defaultOnAccent = defaults.match(/--on-accent:(#[0-9a-f]+);/i)[1];
  for (const grade of [7, 8, 9]) {
    const rules = html.match(new RegExp('\\[data-grade="' + grade + '"\\]\\{([\\s\\S]*?)\\}'))[1];
    const background = rules.match(/--accent:(#[0-9a-f]+);/i)[1];
    const color = (rules.match(/--on-accent:(#[0-9a-f]+);/i) || [null, defaultOnAccent])[1];
    const expand = hex => hex.length === 4 ? "#" + [...hex.slice(1)].map(c => c + c).join("") : hex;
    const values = [luminance(expand(background)), luminance(expand(color))].sort((a, b) => b - a);
    assert.ok((values[0] + .05) / (values[1] + .05) >= 4.5, "grade " + grade);
  }
});

test("the compact composer hides attachment limits until a four-file limit is exceeded", () => {
  assert.match(html, /var ATTACH_MAX_FILES = 4;/);
  assert.match(html, /id="noamAttachButton" aria-label="צירוף צילום או קובץ"/);
  assert.match(html, /id="noamMathToggle" aria-label="פתיחת סימנים מתמטיים"/);
  assert.match(html, /id="noamAttachNote" role="status" aria-live="polite" hidden/);
  assert.match(html, /note\.hidden = !text;/);
  assert.match(html, /note\.setAttribute\("role", isError \? "alert" : "status"\);/);
  assert.doesNotMatch(html, />צירוף צילום או קובץ<\/button>/);
  assert.doesNotMatch(html, /class="noam-compose-heading"/);
});

test("an untouched chat has no instructional filler and collapses beside the scanned question", () => {
  assert.doesNotMatch(html, /בחרו סוג עזרה או כתבו שאלה/);
  assert.doesNotMatch(html, /השיחה תישמר גם אם תעברו לסעיף אחר/);
  assert.match(html, /\.noam-transcript\.is-empty\{flex:0 0 0;min-height:0;max-height:0/);
  assert.match(html, /if \(!thread\.messages\.length&&!busy\)\{ transcript\.classList\.add\("is-empty"\); \}/);
});

test("question feedback pins remain, while AI-answer feedback appears once below the composer", () => {
  assert.match(html, /report\.className = "noam-report-pin"/);
  assert.match(html, /report\.dataset\.label = "יש הערה על השאלה\?"/);
  assert.equal((html.match(/id=\\?"noamAiFeedback\\?"/g) || []).length, 1);
  assert.match(html, /hasAssistantAnswer[\s\S]*?יש הערה על התשובה שקיבלתם מנועם AI\? כתבו לנו/);
  assert.match(html, /feedbackLocation\(exercise\) \+ " · משוב על תשובת נועם AI"/);
});

test("local visual analysis deduplicates identical manifest text before parsing", () => {
  assert.match(html, /values\.indexOf\(value\)===index/);
  assert.match(html, /if \(!tryNoamLocalVisual\(message\)\)\{askNoam\("free_question",message\);\}/);
  assert.match(html, /noam-didactic-guides\.js\?v=20260920-3/);
  assert.match(html, /noam-local-visual\.js\?v=20260920-3/);
  assert.ok(html.indexOf("noam-didactic-guides.js")<html.indexOf("noam-local-visual.js"));
});

test("visual geometry help always renders the authoritative scanned question beside the answer", () => {
  assert.match(html,/noamResponseVisual\(exercise,thread,studentMessage,answer,helpKind,hintIndex,requestAnalysis\)/);
  assert.match(html,/type:"question-image",exerciseId:exercise\.id/);
  assert.match(html,/noam-question-visual-image/);
  const responseVisual = html.slice(html.indexOf("function noamResponseVisual("), html.indexOf("function noamCanOfferDrawing("));
  assert.doesNotMatch(responseVisual,/parseLabeledTriangle|labeled-triangle/);
});

test("question drawings use deterministic guide focus when available and safely fall back when absent", () => {
  const ctx = {
    window:{NoamDidacticGuides:DidacticGuides},
    Set,Math,String,Number,Array,Object,RegExp
  };
  vm.createContext(ctx);
  vm.runInContext(askSource,ctx);
  const selected=DidacticGuides.resolveVisual("G9-T15-E-Q04א",{key:"q4a-angle-edb"});
  assert.deepEqual(
    JSON.parse(JSON.stringify(ctx.noamDidacticVisualFocus("G9-T15-E-Q04א","q4a-angle-edb"))),
    selected.focus
  );
  assert.equal(ctx.noamDidacticVisualFocus("plain"),null);
  assert.match(html,/noamDidacticVisualSelection\(visual\.exerciseId,\{key:visual\.focusKey\}\)/);
  assert.doesNotMatch(
    html.slice(html.indexOf("function addTranscriptBubble("),html.indexOf("function ensureNoamGlossaryPopover(")),
    /focus\s*:\s*visual\.focus(?:\s*[,}])/
  );
  assert.match(html,/noam-question-visual-stage/);
  assert.match(html,/noam-question-focus-segment\.is-parallel/);
});

test("geometry answers offer a free local drawing action and hide it after use", () => {
  assert.match(html,/drawButton\.textContent="הדגם באמצעות שרטוט"/);
  assert.match(html,/message\.visual=manualVisual;[\s\S]*?saveNoamState\(\);[\s\S]*?renderNoamChat\(\)/);
  assert.match(html,/message\.role!=="assistant"\|\|message\.visual/);
  assert.match(html,/failed\\s\+to\\s\+fetch/);
  const handler = html.slice(html.indexOf('drawButton.addEventListener("click"'), html.indexOf("bubble.appendChild(drawButton)"));
  assert.doesNotMatch(handler,/askNoam|postJson|fetch\(/);

  const ctx = {
    ttl:"משולשים וזוויות",
    window:{NoamLocalVisual:{}},
    localVisualExerciseSource:()=>"משולש EDB",
    Set,Math,String,Number,Array,Object,RegExp
  };
  vm.createContext(ctx);
  vm.runInContext(askSource,ctx);
  const thread={history:[]};
  const message={role:"assistant",text:"סמנו את הזווית."};
  assert.equal(ctx.noamCanOfferDrawing({id:"q"},thread,message),true);
  assert.deepEqual(
    JSON.parse(JSON.stringify(ctx.noamManualVisual({id:"q"},thread,message))),
    {type:"question-image",exerciseId:"q",label:"השרטוט מתוך השאלה",focusKey:""}
  );
  message.visual={type:"question-image"};
  assert.equal(ctx.noamCanOfferDrawing({id:"q"},thread,message),false);
});

test("manual Question 4 drawings follow the latest student question and keep only a verified focus key", () => {
  const ctx = {
    ttl:"הוכחה גאומטרית",
    window:{NoamLocalVisual:{},NoamDidacticGuides:DidacticGuides},
    localVisualExerciseSource:()=>"משולש ABC",
    Set,Math,String,Number,Array,Object,RegExp
  };
  vm.createContext(ctx);
  vm.runInContext(askSource,ctx);
  const thread={hintIndex:2,history:[],messages:[{role:"user",text:"איפה הזווית ∠EDB?"}]};
  const visual=JSON.parse(JSON.stringify(ctx.noamManualVisual(
    {id:"G9-T15-E-Q04א"},thread,{role:"assistant",text:"סמנו את ∠EDB."}
  )));
  assert.equal(visual.focusKey,"q4a-angle-edb");
  assert.equal(Object.hasOwn(visual,"focus"),false);
});

test("a model-supplied geometry explanation selects a guide-owned focus key", async () => {
  const f = await requestFixture({ok:true,answer:"סמנו תחילה את הזווית ∠EDB ליד הקודקוד D."}, {
    exercise:{id:"G9-T15-E-Q04א",q:4,part:"א"},
    didacticGuides:Object.assign({},DidacticGuides,{respond:()=>null}),
    wantsVisualSupport:()=>true,
    analysis:question4Analysis,
    topic:"הוכחה גאומטרית",
    helpKind:"free_question",
    studentMessage:"אפשר שרטוט של הזווית ∠EDB?"
  });
  const visual=f.thread.messages.at(-1).visual;
  assert.equal(visual.focusKey,"q4a-angle-edb");
  assert.equal(Object.hasOwn(visual,"focus"),false);
});

test("a contradictory model refusal is replaced when the viewer supplies the requested drawing", () => {
  const ctx = {
    window:{NoamLocalVisual:{wantsDrawing:text=>/לצייר/.test(text)}},
    Set,Math,String,Number,Array,Object,RegExp
  };
  vm.createContext(ctx);
  vm.runInContext(askSource,ctx);
  const visual={type:"labeled-triangle",vertices:["E","D","B"],angles:["EBD","BDE"]};
  assert.equal(
    ctx.noamVisualAnswer("אפשר לצייר לי?","אני לא יכול לצייר, הסתכלו בדף.",visual),
    "הנה משולש EDB לבדו. האות האמצעית בשם כל זווית היא הקודקוד שלה."
  );
  assert.equal(
    ctx.noamVisualAnswer("אפשר לצייר לי?","האתר יציג את השרטוט לצד התשובה.",visual),
    "הנה משולש EDB לבדו. האות האמצעית בשם כל זווית היא הקודקוד שלה."
  );
});

test("the viewer remains valid JavaScript with one main target and one persistent announcer", () => {
  const script = html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
  assert.doesNotThrow(() => new vm.Script(script));
  assert.equal((html.match(/<main\b/g) || []).length, 1);
  assert.equal((html.match(/<\/main>/g) || []).length, 1);
  assert.match(html, /href="#worksheetMain"/);
  assert.match(html, /<main[^>]+id="worksheetMain"[^>]+tabindex="-1"/);
  assert.equal((html.match(/id="noamAnnouncements"/g) || []).length, 1);
  assert.match(html, /\.noam-input-shell:focus-within\{[\s\S]*?outline:3px/);
});
