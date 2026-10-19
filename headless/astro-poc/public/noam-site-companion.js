/* Noam AI site companion. Compact navigation bar, then an engaged rail that reflows the page.
   Modes: closed | compact | engaged. Expanded layout is only the engaged mode.
   Not Ramzi. */
(function () {
  "use strict";
  if (window.__noamSiteCompanion) return;
  window.__noamSiteCompanion = true;

  var API_BASE = "/api";
  var API = API_BASE + "/noamSiteCompanion";
  var FALLBACK = "מנווט AI לא זמין כרגע. לא הצגתי הצעה מומצאת. נסו שוב בעוד רגע.";
  var SITE_FONT = "Heebo,'Arial Hebrew',Arial,sans-serif";
  var EXPORT_NOTE = "במקרה פירוק לגורמים לכיתה ט׳ רמה א׳, אפשר לסמן את השאלות שנבחרו על דף המקור המלא, או להדפיס דף מצומצם שנחתך מאותו מקור עם ההוראה והנוסח המקוריים.";
  var RAMZI_TEXT = "עזרה בפתרון השאלה שייכת לרמזי, עוזר הלמידה בדף העבודה. לחצו על «עזרה מרמזי». מנווט AI מכוון באתר ולא נותן רמז לפתרון.";
  var SOLVE_REQUEST = /רמז|לפתור|תפתור|מה התשובה|איך פותרים|הדרך לפתרון|\bhint\b|\bsolve\b|the answer/i;
  var botClientPromise = null;
  var navigationPromise = null;
  var RESOURCE_REQUEST = /דפים|דפי|דף עבודה|תרגול|מחפש|מחפשת|מאגר|worksheet|practice|find/i;
  var historyKey = "noam-navigation-conversation-v1";
  var conversation = [];
  try {
    var saved = JSON.parse(sessionStorage.getItem(historyKey) || "null");
    if (saved && Date.now() - saved.at < 30 * 60 * 1000 && Array.isArray(saved.turns)) {
      conversation = saved.turns.filter(function (turn) {
        return turn && (turn.role === "user" || turn.role === "assistant") && typeof turn.content === "string";
      }).slice(-8).map(function (turn) { return {role: turn.role, content: turn.content.slice(0, 700)}; });
    }
  } catch (_) {}
  function remember(message, result) {
    var labels = [result.primary].concat(result.chips || []).filter(Boolean).map(function (action) { return action.label; }).filter(Boolean);
    conversation.push({role: "user", content: message.slice(0, 700)},
      {role: "assistant", content: [result.answer || result.text || "", labels.join("; ")].join("\n").slice(0, 700)});
    conversation = conversation.slice(-8);
    try { sessionStorage.setItem(historyKey, JSON.stringify({at: Date.now(), turns: conversation})); } catch (_) {}
  }
  function loadNavigation() {
    if (!navigationPromise) {
      var controller = new AbortController();
      var timer;
      var timeout = new Promise(function (_, reject) {
        timer = setTimeout(function () { controller.abort(); reject(new Error("NAVIGATION_TIMEOUT")); }, 5000);
      });
      navigationPromise = Promise.race([timeout, Promise.all([
        import("/noam-navigation.js?v=758e498be7a22201"),
        fetch("/noam-navigation-guide.json?v=758e498be7a22201", {signal: controller.signal}).then(function (response) {
          if (!response.ok) throw new Error("NAVIGATION_UNAVAILABLE");
          return response.json();
        }),
      ])]).then(function (loaded) { clearTimeout(timer); return loaded; }).catch(function (error) { clearTimeout(timer); navigationPromise = null; throw error; });
    }
    return navigationPromise;
  }
  function navigationFallback(payload) {
    return loadNavigation().then(function (loaded) {
      var result = loaded[0].navigateSite(payload, loaded[1], "") || loaded[0].navigationHelp(loaded[1], true);
      return Object.assign({}, result, {source: "local-fallback", answer: "החיבור למנווט AI לא הצליח כרגע. הנה ניווט בסיסי: " + (result.answer || "בחרו דף מהרשימה.")});
    }).catch(function () {
      return {source: "local-fallback", answer: "החיבור למנווט AI לא הצליח כרגע. אפשר להמשיך דרך מאגר דפי העבודה.", primary: {label: "דפי עבודה", href: "/worksheets"}, chips: []};
    });
  }
  var script = document.currentScript;
  var avatarSrc = (script && script.getAttribute("data-avatar")) || "/design-exact/assets/avatar/ramzi-A-idle.svg";
  var mode = "closed";
  var streaming = false;
  var hasAnswer = false;

  function panelSize(vw, vh) {
    vw = Math.max(1, Math.floor(vw || 1));
    vh = Math.max(1, Math.floor(vh || 1));
    var maxArea = (vw * vh) / 16;
    var width = Math.floor(vw * 0.25);
    var height = Math.floor(vh * 0.25);
    if (width < 168) {
      var widthCap = Math.max(1, Math.floor(maxArea / 96));
      width = Math.min(168, widthCap);
      height = Math.floor(maxArea / width);
    }
    if (width * height > maxArea) height = Math.floor(maxArea / Math.max(1, width));
    width = Math.max(1, Math.min(width, vw));
    height = Math.max(1, Math.min(height, vh));
    if (width * height > maxArea) height = Math.max(1, Math.floor(maxArea / width));
    return { width: width, height: height, maxArea: maxArea };
  }

  function pageKind() {
    if (document.body && document.body.getAttribute("data-noam-companion") === "teacher") return "teachers";
    var path = location.pathname || "";
    if (/worksheet-viewer-noam\.html/.test(path) || document.getElementById("fab")) return "worksheet";
    if (path === "/" || /\/index\.html$/.test(path)) return "home";
    if (/grade-\d+/.test(path)) return "topic";
    return "other";
  }

  function teacherContext() {
    if (pageKind() !== "teachers") return null;
    function value(id) {
      var el = document.getElementById(id);
      return el ? String(el.value || "").trim() : "";
    }
    function checked(name) {
      var el = document.querySelector('input[name="' + name + '"]:checked');
      return el ? el.value : "";
    }
    var goals = { first: "מפגש ראשון", spiral: "חזרה ספירלית", practice: "תרגול וביסוס", exam: "לקראת מבחן", other: "אחר" };
    var styles = { scaffold: "מדורגת", creative: "יצירתית", blended: "משולבת" };
    var grade = document.getElementById("grade");
    var topic = document.getElementById("topic");
    var goal = checked("scenario");
    var style = checked("style");
    return {
      grade: value("grade"),
      gradeLabel: grade && grade.selectedOptions[0] ? grade.selectedOptions[0].textContent.trim() : "",
      topic: value("topic"),
      topicLabel: topic && topic.selectedOptions[0] ? topic.selectedOptions[0].textContent.trim() : "",
      goal: goal,
      goalLabel: goals[goal] || "",
      style: style,
      styleLabel: styles[style] || "",
      note: value("teacher-note"),
    };
  }

  function siteHref(path) {
    if (location.port === "4337" || /(^|\.)noamdoronmath\.co\.il$/.test(location.hostname)) return path;
    return "https://www.noamdoronmath.co.il" + path;
  }

  function pathOf(href) {
    try {
      return new URL(href, location.href).pathname.replace(/\/$/, "") || "/";
    } catch (error) {
      return "";
    }
  }

  function starterLinks() {
    var kind = pageKind();
    var here = (location.pathname || "/").replace(/\/$/, "") || "/";
    var grades = { "7": "ז׳", "8": "ח׳", "9": "ט׳" };
    var catalog = [
      { label: "דפי עבודה", href: siteHref("/worksheets") },
      { label: "כיתה ט׳", href: siteHref("/grade-9") },
      { label: "בלוג", href: siteHref("/blog") },
    ];
    if (kind === "topic") {
      var grade = ((location.pathname || "").match(/grade-(\d+)/) || [])[1];
      catalog = [{ label: "דפי עבודה", href: siteHref("/worksheets") }];
      if (grade && grades[grade]) catalog.push({ label: "כיתה " + grades[grade], href: siteHref("/grade-" + grade) });
    } else if (kind === "worksheet") {
      catalog = [
        { label: "דפי עבודה", href: siteHref("/worksheets") },
        { label: "בית", href: siteHref("/") },
      ];
    } else if (kind === "teachers") {
      catalog = [
        { label: "דפי עבודה", href: siteHref("/worksheets") },
        { label: "כיתה ט׳", href: siteHref("/grade-9") },
      ];
    } else if (kind !== "home") {
      catalog = [
        { label: "דפי עבודה", href: siteHref("/worksheets") },
        { label: "בית", href: siteHref("/") },
      ];
    }
    var found = [];
    var seen = {};
    for (var i = 0; i < catalog.length; i++) {
      var item = catalog[i];
      if (!item || seen[item.href]) continue;
      var itemPath = pathOf(item.href);
      if (itemPath === here) continue;
      if (kind === "home" && (item.label === "בית" || itemPath === "/")) continue;
      seen[item.href] = true;
      found.push(item);
    }
    return found.slice(0, 3);
  }

  function isLocalSolve(message) {
    return pageKind() === "worksheet" && SOLVE_REQUEST.test(String(message || "")) && !RESOURCE_REQUEST.test(String(message || ""));
  }

  function forceSiteFont(scope) {
    if (!scope || !scope.style) return;
    scope.style.setProperty("font-family", SITE_FONT, "important");
    var nodes = scope.querySelectorAll("*");
    for (var i = 0; i < nodes.length; i++) nodes[i].style.setProperty("font-family", SITE_FONT, "important");
  }

  var style = document.createElement("style");
  style.textContent = [
    "#noam-site-companion{position:fixed;z-index:9990;right:8px;bottom:8px;left:auto;font-family:" + SITE_FONT + ";color:#22305a}",
    "#noam-site-companion-launch{width:48px;height:48px;padding:4px;border:2px solid #22305a;border-radius:16px 6px 18px 7px;background:#2a7c7a;box-shadow:3px 3px 0 #e6a534;cursor:pointer}",
    "#noam-site-companion-launch img{width:32px;height:32px;display:block;border-radius:50%;background:#fff}",
    // Keep the shared avatar, but make site navigation secondary on worksheets.
    "body.exact-viewer #noam-site-companion-launch{box-sizing:border-box;width:44px;height:44px;min-width:44px;min-height:44px;padding:7px;border:1px solid #aab6c5;border-radius:12px;background:#fbfaf5;box-shadow:none}",
    "body.exact-viewer #noam-site-companion-launch img{width:28px;height:28px}",
    "#noam-site-companion-panel :focus-visible{outline:3px solid #1e605e;outline-offset:2px}",
    "#noam-site-companion-panel{display:flex;flex-direction:column;gap:6px;box-sizing:border-box;overflow:auto;background:#fbfaf5;color:#22305a;border:2px solid #22305a;border-radius:16px 6px 18px 7px;box-shadow:3px 3px 0 #e6a534;padding:8px;font-size:16px;line-height:1.35;font-family:" + SITE_FONT + ";direction:rtl;text-align:right}",
    "#noam-site-companion-panel[hidden]{display:none!important}",
    "#noam-site-companion-panel header{display:flex;align-items:center;gap:6px;flex:none}",
    "#noam-site-companion-panel header img{width:24px;height:24px;flex:none;border-radius:50%;background:#fff}",
    "#noam-site-companion-panel h2{margin:0;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700;font-size:16px;line-height:1.3;font-family:" + SITE_FONT + "}",
    "#noam-site-companion-panel button,#noam-site-companion-panel a,#noam-site-companion-panel input,#noam-site-companion-answer,#noam-site-companion-details,#noam-site-companion-chips{font-family:" + SITE_FONT + "}",
    "#noam-site-companion-panel button,#noam-site-companion-panel a,#noam-site-companion-panel input{font-weight:700;font-size:16px;line-height:1.3}",
    "#noam-site-companion-close,#noam-ai-expand,#noam-ai-collapse{box-sizing:border-box;min-width:44px;min-height:44px;height:44px;border:2px solid #22305a;border-radius:10px;background:#fff;color:#22305a;padding:4px 8px;cursor:pointer}",
    "#noam-site-companion-close{width:44px;padding:0;flex:none}",
    "#noam-site-companion-answer{margin:0;flex:none;font-size:16px;line-height:1.35;min-height:1.35em;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}",
    "#noam-site-companion-primary,#noam-site-companion-ramzi{display:inline-flex;align-items:center;min-height:44px;padding:4px 8px;border-radius:10px;background:#2a7c7a;color:#fff;text-decoration:none;border:2px solid #22305a;cursor:pointer}",
    "#noam-site-companion-primary[hidden],#noam-site-companion-ramzi[hidden],#noam-ai-expand[hidden],#noam-ai-collapse[hidden],#noam-site-companion-details[hidden],#noam-site-companion-more[hidden]{display:none!important}",
    "#noam-site-companion-chips{display:flex;flex-wrap:wrap;gap:6px}",
    "#noam-site-companion-chips a,#noam-site-companion-chips button{display:inline-flex;align-items:center;min-height:44px;padding:4px 8px;border:2px solid #22305a;border-radius:999px;background:#fff;color:#22305a;text-decoration:none;cursor:pointer}",
    "#noam-site-companion-details{margin:0;font-size:16px;font-weight:500;line-height:1.35;overflow:auto;white-space:pre-wrap}",
    "#noam-site-companion-request{margin:4px 0;color:#4c5978;font-size:16px;overflow-wrap:anywhere;flex:none}",
    "#noam-site-companion-reset{align-self:flex-start;border:0;background:transparent;color:#1d6362;text-decoration:underline;min-height:36px;cursor:pointer;flex:none}",
    "#noam-site-companion-panel.is-compact #noam-site-companion-request,#noam-site-companion-panel.is-compact #noam-site-companion-reset{display:none}",
    "#noam-site-companion-form{display:flex;gap:6px;flex:none}",
    "#noam-site-companion-input{flex:1;min-width:0;height:44px;border:2px solid #22305a;border-radius:10px;padding:4px 8px;font-weight:500}",
    "#noam-site-companion-form button{min-height:44px;min-width:44px;border:2px solid #22305a;border-radius:10px;background:#22305a;color:#fff;padding:4px 8px;cursor:pointer;flex:none}",
    "#noam-site-companion-panel.is-compact{overflow:hidden;padding:3px;gap:1px}",
    "#noam-site-companion-panel.is-compact header,#noam-site-companion-panel.is-compact #noam-site-companion-form{flex:none}",
    "#noam-site-companion-panel.is-compact #noam-site-companion-answer{order:1}",
    "#noam-site-companion-panel.is-compact #noam-site-companion-form{order:2}",
    "#noam-site-companion-panel.is-compact #noam-site-companion-primary,#noam-site-companion-panel.is-compact #noam-site-companion-ramzi{order:3}",
    "#noam-site-companion-panel.is-compact #noam-site-companion-chips{order:4}",
    "#noam-site-companion-panel.is-compact #noam-site-companion-more{order:5}",
    ".compact-dropped{display:none!important}",
    "#noam-site-companion-panel.is-compact.is-tight{padding:2px;gap:2px;font-size:16px}",
    "#noam-site-companion-panel.is-compact.is-tight header{position:relative;min-height:22px;padding-inline-end:46px}",
    "#noam-site-companion-panel.is-compact.is-tight header img,#noam-site-companion-panel.is-compact.is-tight #noam-ai-expand{display:none!important}",
    "#noam-site-companion-panel.is-compact.is-tight #noam-site-companion-close{position:absolute;inset-inline-end:0;top:0}",
    "#noam-site-companion-panel.is-compact.is-tight h2{font-size:16px;line-height:1.3}",
    "#noam-site-companion-panel.is-compact.is-teacher #noam-site-companion-answer{-webkit-line-clamp:1}",
    "#noam-site-companion-panel.is-compact.is-tight #noam-site-companion-answer{font-size:16px;-webkit-line-clamp:1;min-height:0;box-sizing:border-box;padding-inline-end:46px}",
    "#noam-site-companion-panel.is-compact.is-tight #noam-site-companion-input,#noam-site-companion-panel.is-compact.is-tight #noam-site-companion-form button,#noam-site-companion-panel.is-compact.is-tight #noam-site-companion-primary,#noam-site-companion-panel.is-compact.is-tight #noam-site-companion-ramzi{font-size:16px}",
    "#noam-site-companion-panel.is-compact.is-tight #noam-site-companion-form{width:100%;gap:4px;box-sizing:border-box;padding-inline-end:46px}",
    "#noam-site-companion-panel.is-compact.is-xtight #noam-site-companion-form{padding-inline-end:0}",
    "#noam-site-companion-panel.is-compact.is-tight.has-answer #noam-site-companion-form{padding-inline-end:0}",
    "#noam-site-companion-panel.is-compact.is-tight #noam-site-companion-form button{padding:0 6px}",
    "#noam-site-companion-panel.is-compact.is-tight #noam-site-companion-primary,#noam-site-companion-panel.is-compact.is-tight #noam-site-companion-ramzi{padding-inline-end:48px}",
    "#noam-site-companion-panel.is-compact.is-xtight{padding:0;gap:0}",
    "#noam-site-companion-panel.is-compact.is-xtight header{min-height:44px;padding-inline-end:0}",
    "#noam-site-companion-panel.is-compact.is-xtight #noam-site-companion-close{position:static}",
    "#noam-site-companion-panel.is-compact.is-xtight.has-answer header{min-height:22px;padding-inline-end:46px}",
    "#noam-site-companion-panel.is-compact.is-xtight.has-answer #noam-site-companion-close{position:absolute;inset-inline-end:0;top:0}",
    "#noam-site-companion-panel.is-compact.is-xtight.has-answer #noam-site-companion-answer{padding-inline-end:46px}",
    "html.noam-ai-engaged{display:grid;direction:rtl;grid-template-columns:360px minmax(0,1fr);grid-template-rows:minmax(0,100dvh);height:100dvh;overflow:hidden}",
    "html.noam-ai-engaged body{direction:rtl;grid-column:2;grid-row:1;min-width:0;min-height:0;height:auto!important;max-height:100%!important;overflow:auto!important}",
    "html.noam-ai-engaged #noam-site-companion-panel{direction:rtl;grid-column:1;grid-row:1;position:relative;right:auto;bottom:auto;width:auto;height:auto;max-height:100dvh;border-radius:0;box-shadow:none}",
    "html.noam-ai-engaged #noam-site-companion-details{flex:1;min-height:0}",
    "@media (max-width:767px){",
    "html.noam-ai-engaged{grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(0,1fr) minmax(168px,42dvh)}",
    "html.noam-ai-engaged body{grid-column:1;grid-row:1}",
    "html.noam-ai-engaged #noam-site-companion-panel{grid-column:1;grid-row:2;position:relative;height:auto;max-height:42dvh;width:100%;border-start-start-radius:18px;border-start-end-radius:18px;border-end-start-radius:0;border-end-end-radius:0;box-shadow:0 -3px 0 #e6a534;z-index:9991}",
    "html.noam-ai-engaged #noam-site-companion-close{width:auto;min-width:72px;padding:4px 10px}",
    "html.noam-ai-engaged #noam-accessibility{top:auto!important;bottom:8px!important;left:auto!important;right:auto!important;inset-inline-end:8px!important;z-index:10001!important}",
    "html.noam-ai-engaged #noam-site-companion-form{padding-inline-end:56px}",
    "html.noam-ai-engaged .fab{inset-block-end:calc(42dvh + 8px)!important}",
    "}",
    "@media (min-width:768px){",
    "html.noam-ai-engaged #noam-accessibility{left:8px!important;right:auto!important}",
    "}",
    "@keyframes noam-think-dot{0%,80%,100%{opacity:.25}40%{opacity:1}}",
    "#noam-site-companion-panel.is-thinking #noam-site-companion-answer{display:block;-webkit-line-clamp:unset;overflow:visible}",
    "#noam-site-companion-thinking{display:inline-flex;align-items:center;gap:6px}",
    "#noam-site-companion-thinking .noam-think-dots{display:inline-flex;gap:3px}",
    "#noam-site-companion-thinking .noam-think-dots i{width:6px;height:6px;border-radius:50%;background:currentColor;animation:noam-think-dot 1.2s infinite}",
    "#noam-site-companion-thinking .noam-think-dots i:nth-child(2){animation-delay:.2s}",
    "#noam-site-companion-thinking .noam-think-dots i:nth-child(3){animation-delay:.4s}",
    "@media (prefers-reduced-motion:reduce){",
    "html.noam-ai-engaged,html.noam-ai-engaged body,#noam-site-companion-panel{scroll-behavior:auto;transition:none;animation:none}",
    "#noam-site-companion-thinking .noam-think-dots i{animation:none;opacity:1}",
    "}",
    "@media print{#noam-site-companion,#noam-site-companion-panel{display:none!important}html.noam-ai-engaged{display:block!important;height:auto!important;overflow:visible!important}html.noam-ai-engaged body{max-height:none!important;overflow:visible!important}}",
    "#noam-site-companion,#noam-site-companion *,#noam-site-companion-panel,#noam-site-companion-panel *{font-family:" + SITE_FONT + " !important}",
  ].join("");
  document.head.appendChild(style);

  var root = document.createElement("div");
  root.id = "noam-site-companion";
  root.innerHTML =
    '<button type="button" id="noam-site-companion-launch" aria-expanded="false" aria-controls="noam-site-companion-panel" aria-label="פתיחת מנווט AI"><img alt="" width="32" height="32"></button>';
  document.body.appendChild(root);
  var launch = document.getElementById("noam-site-companion-launch");
  launch.querySelector("img").src = avatarSrc;
  if (pageKind() === "worksheet") {
    launch.title = "מנווט AI — ניווט באתר";
    launch.setAttribute("aria-label", launch.title);
    launch.textContent = "ניווט";
  }

  var panel = document.createElement("section");
  panel.id = "noam-site-companion-panel";
  panel.hidden = true;
  panel.setAttribute("role", "region");
  panel.setAttribute("aria-labelledby", "noam-site-companion-title");
  panel.innerHTML =
    '<header><img alt="" width="24" height="24"><h2 id="noam-site-companion-title">מנווט AI</h2>' +
    '<button type="button" id="noam-ai-expand" aria-expanded="false" aria-label="הרחבה">הרחבה</button>' +
    '<button type="button" id="noam-ai-collapse" hidden>צמצום</button>' +
    '<button type="button" id="noam-site-companion-close" aria-label="סגירת מנווט AI">×</button></header>' +
    '<p id="noam-site-companion-request" hidden></p>' +
    '<p id="noam-site-companion-answer" aria-live="polite"></p>' +
    '<a id="noam-site-companion-primary" hidden></a>' +
    '<button type="button" id="noam-site-companion-ramzi" hidden>עזרה מרמזי</button>' +
    '<div id="noam-site-companion-chips" role="group" aria-label="הצעות"></div>' +
    '<button type="button" id="noam-site-companion-more" aria-expanded="false" aria-controls="noam-site-companion-details">עוד פרטים</button>' +
    '<p id="noam-site-companion-details" hidden tabindex="0"></p>' +
    '<form id="noam-site-companion-form"><label for="noam-site-companion-input" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">מה אתם מחפשים?</label>' +
    '<input id="noam-site-companion-input" type="text" maxlength="700" autocomplete="off" aria-label="מה אתם מחפשים?">' +
    '<button type="submit" aria-label="שליחה">שליחה</button></form>' +
    '<button type="button" id="noam-site-companion-reset" hidden>שיחה חדשה</button>';
  root.appendChild(panel);
  panel.querySelector("header img").src = avatarSrc;
  if (pageKind() === "worksheet") panel.querySelector("header img").remove();
  forceSiteFont(root);

  var answerEl = document.getElementById("noam-site-companion-answer");
  var primaryEl = document.getElementById("noam-site-companion-primary");
  var ramziEl = document.getElementById("noam-site-companion-ramzi");
  var chipsEl = document.getElementById("noam-site-companion-chips");
  var moreEl = document.getElementById("noam-site-companion-more");
  var detailsEl = document.getElementById("noam-site-companion-details");
  var form = document.getElementById("noam-site-companion-form");
  var requestEl = document.getElementById("noam-site-companion-request");
  var resetEl = document.getElementById("noam-site-companion-reset");
  resetEl.hidden = !conversation.length;
  resetEl.addEventListener("click", function () {
    if (streaming) return;
    conversation = [];
    try { sessionStorage.removeItem(historyKey); } catch (_) {}
    resetEl.hidden = true;
    requestEl.hidden = true;
    showIdle();
    input.focus();
  });
  var input = document.getElementById("noam-site-companion-input");
  var expandEl = document.getElementById("noam-ai-expand");
  var collapseEl = document.getElementById("noam-ai-collapse");
  var closer = document.getElementById("noam-site-companion-close");

  function ramziCoversPage() {
    if (pageKind() !== "worksheet") return false;
    var ramzi = document.getElementById("panel");
    if (!ramzi || ramzi.classList.contains("hidden")) return false;
    var box = ramzi.getBoundingClientRect();
    return box.width > 8 && box.height > 8;
  }

  function lift() {
    var extra = 8;
    var a11y = document.getElementById("noam-accessibility");
    if (a11y) {
      var box = a11y.getBoundingClientRect();
      if (box.width > 0 && box.right > window.innerWidth - 90) {
        extra = Math.max(extra, Math.round(window.innerHeight - box.top + 8));
      }
    }
    return extra;
  }

  function teacherGoalChips() {
    return [
      { label: "מפגש ראשון", goal: "first" },
      { label: "תרגול וביסוס", goal: "practice" },
      { label: "אחר", goal: "other" },
    ];
  }

  function appendChip(item) {
    if (!item) return;
    if (item.goal) {
      var button = document.createElement("button");
      button.type = "button";
      button.textContent = item.label;
      button.addEventListener("click", function () {
        document.dispatchEvent(new CustomEvent("noam-teacher-option", { detail: { goal: item.goal } }));
      });
      chipsEl.appendChild(button);
      return;
    }
    if (!item.href) return;
    var link = document.createElement("a");
    link.href = item.href;
    link.textContent = item.label;
    chipsEl.appendChild(link);
  }

  function setChips(items) {
    chipsEl.textContent = "";
    var seen = {};
    var primaryHref = !primaryEl.hidden ? primaryEl.getAttribute("href") || "" : "";
    var added = 0;
    var list = items || [];
    for (var i = 0; i < list.length && added < 8; i++) {
      var item = list[i];
      if (!item) continue;
      var href = item.href || "";
      var label = item.label || "";
      if (href && primaryHref && href === primaryHref) continue;
      if (href && seen["href:" + href]) continue;
      if (label && seen["label:" + label]) continue;
      if (href) seen["href:" + href] = true;
      if (label) seen["label:" + label] = true;
      appendChip(item);
      added += 1;
    }
    if (pageKind() === "teachers") teacherGoalChips().forEach(appendChip);
    forceSiteFont(panel);
  }

  function showIdle() {
    hasAnswer = false;
    var links = starterLinks();
    answerEl.textContent = pageKind() === "teachers"
      ? "אפשר להתחיל ממפגש ראשון בפירוק לגורמים לכיתה ט׳, לבחור שאלות קיימות, ולסמן אותן על דף המקור."
      : "מה לחפש באתר?";
    if (pageKind() === "worksheet") {
      primaryEl.hidden = true;
      ramziEl.hidden = false;
      setChips(links.slice(0, 2));
    } else {
      ramziEl.hidden = true;
      primaryEl.hidden = !links[0];
      if (links[0]) {
        primaryEl.href = links[0].href;
        primaryEl.textContent = links[0].label;
      }
      setChips(links.slice(1, 3));
    }
    var details = "מנווט AI מכוון לדפים קיימים. עזרה בפתרון שאלה נמצאת אצל רמזי.";
    if (pageKind() === "teachers") details += "\n" + EXPORT_NOTE;
    detailsEl.textContent = details;
    moreEl.hidden = false;
  }

  var thinkTimer = null;

  function thinkingLabel(seconds) {
    if (!seconds) return "חושב…";
    if (seconds === 1) return "חושב… 1 שנייה";
    return "חושב… " + seconds + " שניות";
  }

  function sendButton() {
    return form.querySelector("button");
  }

  function stopThinking() {
    if (thinkTimer) clearInterval(thinkTimer);
    thinkTimer = null;
    panel.classList.remove("is-thinking");
    var button = sendButton();
    if (button) button.disabled = false;
  }

  function showThinking() {
    stopThinking();
    var started = Date.now();
    hasAnswer = true;
    panel.classList.add("is-thinking");
    primaryEl.hidden = true;
    ramziEl.hidden = true;
    moreEl.hidden = true;
    detailsEl.hidden = true;
    setChips([]);
    answerEl.innerHTML = '<span id="noam-site-companion-thinking"><span class="noam-think-text">חושב…</span><span class="noam-think-dots" aria-hidden="true"><i></i><i></i><i></i></span></span>';
    var button = sendButton();
    if (button) button.disabled = true;
    thinkTimer = setInterval(function () {
      var seconds = Math.floor((Date.now() - started) / 1000);
      var text = answerEl.querySelector(".noam-think-text");
      if (text) text.textContent = thinkingLabel(seconds);
    }, 250);
    if (mode === "compact") fitCompact();
  }

  function answerKind(result) {
    var source = String(result && result.source || "");
    if (source === "model" || source === "classifier") return "model";
    if (source === "fallback" || source === "local-fallback") return "fallback";
    return "hardcoded";
  }

  function markAnswer(result) {
    var source = (result && result.source) || "local";
    panel.setAttribute("data-response-source", source);
    panel.setAttribute("data-answer-kind", answerKind(result));
  }

  function showResult(result) {
    stopThinking();
    hasAnswer = true;
    markAnswer(result);
    answerEl.textContent = (result && (result.answer || result.text)) || FALLBACK;
    var primary = result && result.primary;
    if (primary && primary.action === "ramzi") {
      primaryEl.hidden = true;
      ramziEl.hidden = false;
    } else if (primary && primary.href) {
      ramziEl.hidden = true;
      primaryEl.hidden = false;
      primaryEl.href = primary.href;
      primaryEl.textContent = primary.label || primary.href;
    } else {
      primaryEl.hidden = true;
      ramziEl.hidden = true;
    }
    setChips((result && result.chips) || []);
    detailsEl.textContent = (result && result.details) || answerEl.textContent;
    moreEl.hidden = !detailsEl.textContent || detailsEl.textContent === answerEl.textContent;
    if (mode === "compact") fitCompact();
  }

  function clearInline() {
    panel.style.position = "";
    panel.style.right = "";
    panel.style.bottom = "";
    panel.style.width = "";
    panel.style.height = "";
  }

  function panelFocused() {
    var active = document.activeElement;
    return !!(active && panel.contains(active));
  }

  function mountPanel(parent, force) {
    if (panel.parentNode === parent) return;
    if (!force && panelFocused()) return;
    parent.appendChild(panel);
  }

  function undrop(el) {
    if (el) el.classList.remove("compact-dropped");
  }

  function drop(el) {
    if (el) el.classList.add("compact-dropped");
  }

  function clearCompactDrops() {
    undrop(chipsEl);
    undrop(moreEl);
    undrop(primaryEl);
    undrop(ramziEl);
    undrop(answerEl);
    var links = chipsEl.querySelectorAll("a, button");
    for (var i = 0; i < links.length; i++) undrop(links[i]);
  }

  function fitCompact() {
    clearCompactDrops();
    panel.classList.toggle("has-answer", hasAnswer);
    var tight = panel.classList.contains("is-tight");
    var wide = !tight && window.innerWidth >= 768;
    var teacher = pageKind() === "teachers";
    var links = chipsEl.querySelectorAll("a, button");
    var visibleChips = 0;
    for (var i = 0; i < links.length; i++) {
      var keep = teacher ? i === links.length - 1 : wide && i === 0;
      if (!keep) drop(links[i]);
      else visibleChips += 1;
    }
    if (visibleChips === 0 || (!wide && !teacher)) drop(chipsEl);
    if (tight && !hasAnswer && !panel.classList.contains("is-thinking")) drop(answerEl);
    var order = teacher
      ? [primaryEl, ramziEl, moreEl, answerEl]
      : tight && hasAnswer
        ? [primaryEl, ramziEl, moreEl, chipsEl]
        : [moreEl, chipsEl, primaryEl, ramziEl];
    for (var n = 0; n < order.length; n++) {
      if (panel.scrollHeight <= panel.clientHeight + 1) return;
      drop(order[n]);
    }
  }

  function rectsOverlap(a, b) {
    return a.width > 0 && b.width > 0 && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  }

  function placeLauncher() {
    root.style.right = "8px";
    root.style.left = "auto";
    root.style.bottom = "8px";
    /* Phone dock keeps this launcher on the bottom-right. Do not stack it
       over the accessibility button or the first screen of text. */
    if (window.matchMedia("(max-width: 800px)").matches) return;
    var a11y = document.getElementById("noam-accessibility");
    if (!a11y) return;
    var box = a11y.getBoundingClientRect();
    var mine = root.getBoundingClientRect();
    if (!rectsOverlap(mine, box)) return;
    root.style.bottom = Math.round(window.innerHeight - box.top + 8) + "px";
    mine = root.getBoundingClientRect();
    if (!rectsOverlap(mine, box)) return;
    root.style.right = Math.round(window.innerWidth - box.left + 8) + "px";
  }

  function layoutCompact(force) {
    if (ramziCoversPage()) return;
    document.documentElement.classList.remove("noam-ai-engaged");
    mountPanel(root, force);
    panel.classList.add("is-compact");
    panel.classList.toggle("is-teacher", pageKind() === "teachers");
    var size = panelSize(window.innerWidth, window.innerHeight);
    panel.classList.toggle("is-tight", size.height < 160);
    panel.classList.toggle("is-xtight", size.height < 110);
    var bottom = lift();
    var avail = window.innerHeight - bottom - 8;
    var height = Math.min(size.height, Math.max(72, avail));
    if (size.width * height > size.maxArea) height = Math.floor(size.maxArea / size.width);
    panel.style.position = "fixed";
    panel.style.right = "8px";
    panel.style.left = "auto";
    panel.style.bottom = bottom + "px";
    panel.style.width = size.width + "px";
    panel.style.height = height + "px";
    panel.dataset.width = String(size.width);
    panel.dataset.height = String(height);
    panel.dataset.area = String(size.width * height);
    panel.dataset.maxArea = String(Math.floor(size.maxArea));
    expandEl.hidden = false;
    collapseEl.hidden = true;
    closer.textContent = "×";
    var sendBtn = form.querySelector("button");
    if (sendBtn) {
      sendBtn.textContent = panel.classList.contains("is-tight") ? "שלח" : "שליחה";
      sendBtn.disabled = streaming;
    }
    expandEl.setAttribute("aria-expanded", "false");
    fitCompact();
  }

  function revealLessonCard() {
    if (window.innerWidth >= 768) return;
    var card = document.querySelector(".exact-topic-demo, .concept-loop__card, .ka-film");
    if (!card) return;
    var sheet = Math.round(window.innerHeight * 0.42);
    var room = window.innerHeight - sheet - 8;
    var rect = card.getBoundingClientRect();
    var delta = 0;
    if (rect.height >= room - 8) delta = rect.top - 8;
    else if (rect.bottom > room) delta = rect.bottom - room + 8;
    else if (rect.top < 0) delta = rect.top - 8;
    if (Math.abs(delta) < 2) return;
    var before = document.body.scrollTop;
    document.body.scrollTop = before + delta;
    if (document.body.scrollTop === before && document.scrollingElement && document.scrollingElement !== document.body) {
      document.scrollingElement.scrollTop += delta;
    }
  }

  function layoutEngaged(force) {
    if (ramziCoversPage()) return;
    clearInline();
    mountPanel(document.documentElement, force);
    panel.classList.remove("is-compact");
    panel.classList.remove("is-tight");
    panel.classList.remove("is-xtight");
    clearCompactDrops();
    var sendBtn = form.querySelector("button");
    if (sendBtn) {
      sendBtn.textContent = "שליחה";
      sendBtn.disabled = streaming;
    }
    document.documentElement.classList.add("noam-ai-engaged");
    closer.textContent = window.innerWidth < 768 ? "סגירה" : "×";
    expandEl.hidden = true;
    collapseEl.hidden = false;
    window.requestAnimationFrame(revealLessonCard);
    expandEl.setAttribute("aria-expanded", "true");
    panel.dataset.mode = "engaged";
  }

  function paintChrome(force) {
    if (!force && (panelFocused() || streaming)) return;
    var covered = ramziCoversPage();
    root.hidden = covered;
    panel.hidden = covered || mode === "closed";
    launch.hidden = mode !== "closed" || covered;
    launch.setAttribute("aria-expanded", mode === "closed" ? "false" : "true");
    document.documentElement.dataset.noamAiMode = covered ? "suspended" : mode;
    if (covered) {
      document.documentElement.classList.remove("noam-ai-engaged");
      return;
    }
    if (mode === "compact") layoutCompact(force);
    if (mode === "engaged") layoutEngaged(force);
    if (mode === "closed") {
      document.documentElement.classList.remove("noam-ai-engaged");
      clearInline();
      panel.classList.remove("is-compact");
      panel.classList.remove("is-tight");
      panel.classList.remove("is-xtight");
      placeLauncher();
    }
  }

  function setMode(next) {
    mode = next;
    panel.dataset.mode = next;
    paintChrome(true);
  }

  function engage(reason) {
    if (mode === "closed") return;
    var keepInput = reason === "input-focus" || reason === "typing" || document.activeElement === input;
    if (mode !== "engaged") {
      panel.dataset.engageReason = reason || "";
      setMode("engaged");
    }
    if (keepInput && document.activeElement !== input) input.focus();
  }

  function compact() {
    setMode("compact");
    detailsEl.hidden = true;
    moreEl.setAttribute("aria-expanded", "false");
  }

  function openCompact() {
    if (!hasAnswer) showIdle();
    setMode("compact");
    if (expandEl.offsetWidth > 0) expandEl.focus();
    else closer.focus();
  }

  launch.addEventListener("click", openCompact);
  expandEl.addEventListener("click", function () { engage("expand"); });
  collapseEl.addEventListener("click", compact);
  closer.addEventListener("click", function () { setMode("closed"); launch.focus(); });
  moreEl.addEventListener("click", function () {
    detailsEl.hidden = false;
    moreEl.setAttribute("aria-expanded", "true");
    engage("details");
    detailsEl.scrollTop = 0;
    detailsEl.focus();
  });
  input.addEventListener("focus", function () { engage("input-focus"); });
  input.addEventListener("input", function () { engage("typing"); });
  function openRamzi() {
    var body = document.body;
    var toggle = document.getElementById("noamAiToggle");
    var modeOn = !!(body && body.classList.contains("noam-ai-on"));
    if (!modeOn && toggle) toggle.click();
    var help = document.getElementById("exactHelpTab");
    var fab = document.getElementById("fab");
    var narrow = window.innerWidth < 1000 || window.innerHeight < 640;
    if (narrow && help && !help.disabled) help.click();
    else if (fab) fab.click();
    var ramziPanel = document.getElementById("panel");
    if (!ramziPanel) return;
    var box = ramziPanel.getBoundingClientRect();
    if ((box.width < 8 || box.height < 8) && fab) fab.click();
  }

  ramziEl.addEventListener("click", function () {
    openRamzi();
    paintChrome(true);
  });
  function botClientSrc() {
    var versioned = "noam-bot-client.js?v=20260921-diagnostics1";
    var nodes = document.getElementsByTagName("script");
    for (var i = 0; i < nodes.length; i++) {
      var src = nodes[i].getAttribute("src") || "";
      if (src.indexOf("noam-site-companion.js") !== -1) return src.replace("noam-site-companion.js", versioned);
    }
    return "/" + versioned;
  }

  function ensureBotClient() {
    if (botClientPromise) return botClientPromise;
    botClientPromise = new Promise(function (resolve, reject) {
      function finish(ok) {
        if (ok && window.NoamBotClient && typeof window.NoamBotClient.create === "function") {
          resolve(window.NoamBotClient.create({ api: API_BASE, enabled: true, modelTimeoutMs: 30000 }));
          return;
        }
        reject(new Error(FALLBACK));
      }
      if (window.NoamBotClient) { finish(true); return; }
      var loader = document.createElement("script");
      loader.src = botClientSrc();
      loader.async = true;
      loader.onload = function () { finish(true); };
      loader.onerror = function () { finish(false); };
      document.head.appendChild(loader);
    }).catch(function (error) {
      botClientPromise = null;
      throw error;
    });
    return botClientPromise;
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var message = input.value.trim();
    if (!message || streaming) return;
    input.value = "";
    input.focus();
    if (isLocalSolve(message)) {
      showResult({ answer: RAMZI_TEXT, details: RAMZI_TEXT, primary: { action: "ramzi", label: "עזרה מרמזי" }, chips: [] });
      return;
    }
    streaming = true;
    requestEl.textContent = "אתם: " + message.slice(0, 700);
    requestEl.hidden = false;
    resetEl.hidden = false;
    resetEl.disabled = true;
    showThinking();
    var payload = {
      message: message.slice(0, 700),
      page: { kind: pageKind(), path: location.pathname + location.search, title: document.title },
      teacher: teacherContext(),
      history: conversation.slice(-8),
    };
    panel.removeAttribute("data-response-error");
    ensureBotClient().then(function (client) { return client.postJson(API, payload); }).then(function (result) {
      var code = result && result.code;
      if (typeof code === "string" && /^[A-Z0-9_]{1,40}$/.test(code)) {
        panel.setAttribute("data-response-error", code);
      }
      if (result && result.source === "fallback" && result.primary && result.active !== false) return result;
      if (!result || result.ok === false || result.active === false) return navigationFallback(payload);
      if (!code) panel.removeAttribute("data-response-error");
      return result;
    }).catch(function (error) {
      var code = String(error && error.code || "CONNECTION_FAILED");
      panel.setAttribute("data-response-error", /^[A-Z0-9_]{1,80}$/.test(code) ? code : "CONNECTION_FAILED");
      return navigationFallback(payload);
    }).then(function (result) {
      streaming = false;
      resetEl.disabled = false;
      remember(message, result);
      showResult(result);
    });
  });
  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape" || mode === "closed") return;
    if (document.querySelector("dialog[open]")) return;
    event.preventDefault();
    if (mode === "engaged") compact();
    else setMode("closed");
  });
  window.addEventListener("resize", function () {
    if (panelFocused() || streaming) return;
    if (mode === "compact") layoutCompact(false);
    if (mode === "closed") placeLauncher();
  });
  window.setInterval(function () { paintChrome(false); }, 1000);
  showIdle();
  placeLauncher();
  window.requestAnimationFrame(placeLauncher);
})();
