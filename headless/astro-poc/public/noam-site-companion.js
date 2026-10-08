/* Noam AI site companion. Compact navigation bar, then an engaged rail that reflows the page.
   Modes: closed | compact | engaged. Expanded layout is only the engaged mode.
   Not Ramzi. */
(function () {
  "use strict";
  if (window.__noamSiteCompanion) return;
  window.__noamSiteCompanion = true;

  var API = "https://amiramnoam.wixstudio.com/my-site-2/_functions/noamSiteCompanion";
  var FALLBACK = "נועם AI לא זמין כרגע. לא הצגתי הצעה מומצאת. נסו שוב בעוד רגע.";
  var EXPORT_NOTE = "סימון וחיתוך של דף המקור עדיין לא ממומשים. אין כאן ייצוא מזויף.";
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

  function starterLinks() {
    var found = [];
    var seen = {};
    var nodes = document.querySelectorAll("a[href]");
    for (var i = 0; i < nodes.length && found.length < 3; i++) {
      var anchor = nodes[i];
      if (anchor.closest("#noam-site-companion,#noam-site-companion-panel")) continue;
      var href = anchor.getAttribute("href") || "";
      if (!href || href.charAt(0) === "#" || href.indexOf("mailto:") === 0) continue;
      var label = anchor.textContent.replace(/\s+/g, " ").trim();
      if (label.length < 2 || label.length > 32) continue;
      var abs = anchor.href;
      if (seen[abs]) continue;
      seen[abs] = true;
      found.push({ label: label, href: abs });
    }
    var extras = [
      { label: "דפי עבודה", href: siteHref("/worksheets") },
      { label: "בית", href: siteHref("/") },
    ];
    for (var j = 0; j < extras.length && found.length < 3; j++) {
      if (!seen[extras[j].href]) found.push(extras[j]);
    }
    return found;
  }

  var style = document.createElement("style");
  style.textContent = [
    "#noam-site-companion{position:fixed;z-index:9990;right:8px;bottom:8px;left:auto;font-family:Heebo,Arial,sans-serif;color:#22305a}",
    "#noam-site-companion-launch{width:48px;height:48px;padding:4px;border:2px solid #22305a;border-radius:16px 6px 18px 7px;background:#2a7c7a;box-shadow:3px 3px 0 #e6a534;cursor:pointer}",
    "#noam-site-companion-launch img{width:32px;height:32px;display:block;border-radius:50%;background:#fff}",
    "#noam-site-companion-panel :focus-visible{outline:3px solid #1e605e;outline-offset:2px}",
    "#noam-site-companion-panel{display:flex;flex-direction:column;gap:6px;box-sizing:border-box;overflow:auto;background:#fbfaf5;color:#22305a;border:2px solid #22305a;border-radius:16px 6px 18px 7px;box-shadow:3px 3px 0 #e6a534;padding:8px;font-size:16px;line-height:1.35;direction:rtl;text-align:right}",
    "#noam-site-companion-panel[hidden]{display:none!important}",
    "#noam-site-companion-panel header{display:flex;align-items:center;gap:6px;flex:none}",
    "#noam-site-companion-panel header img{width:24px;height:24px;flex:none;border-radius:50%;background:#fff}",
    "#noam-site-companion-panel h2{margin:0;flex:1;min-width:0;font:700 16px/1.3 Heebo,Arial,sans-serif}",
    "#noam-site-companion-panel button,#noam-site-companion-panel a,#noam-site-companion-panel input{font:700 16px/1.3 Heebo,Arial,sans-serif}",
    "#noam-site-companion-close,#noam-ai-expand,#noam-ai-collapse{min-height:44px;border:2px solid #22305a;border-radius:10px;background:#fff;color:#22305a;padding:4px 8px;cursor:pointer}",
    "#noam-site-companion-answer{margin:0;font-size:16px;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}",
    "#noam-site-companion-primary,#noam-site-companion-ramzi{display:inline-flex;align-items:center;min-height:44px;padding:4px 8px;border-radius:10px;background:#2a7c7a;color:#fff;text-decoration:none;border:2px solid #22305a;cursor:pointer}",
    "#noam-site-companion-primary[hidden],#noam-site-companion-ramzi[hidden],#noam-ai-expand[hidden],#noam-ai-collapse[hidden],#noam-site-companion-details[hidden],#noam-site-companion-more[hidden]{display:none!important}",
    "#noam-site-companion-chips{display:flex;flex-wrap:wrap;gap:6px}",
    "#noam-site-companion-chips a{display:inline-flex;align-items:center;min-height:44px;padding:4px 8px;border:2px solid #22305a;border-radius:999px;background:#fff;color:#22305a;text-decoration:none}",
    "#noam-site-companion-details{margin:0;font-size:16px;font-weight:500;line-height:1.35;overflow:auto;white-space:pre-wrap}",
    "#noam-site-companion-form{display:flex;gap:6px;flex:none}",
    "#noam-site-companion-input{flex:1;min-width:0;height:44px;border:2px solid #22305a;border-radius:10px;padding:4px 8px;font-weight:500}",
    "#noam-site-companion-form button{min-height:44px;border:2px solid #22305a;border-radius:10px;background:#22305a;color:#fff;padding:4px 8px;cursor:pointer}",
    "html.noam-ai-engaged{display:grid;direction:rtl;grid-template-columns:360px minmax(0,1fr);grid-template-rows:minmax(0,100dvh);height:100dvh;overflow:hidden}",
    "html.noam-ai-engaged body{direction:rtl;grid-column:2;grid-row:1;min-width:0;min-height:0;height:auto!important;max-height:100%!important;overflow:auto!important}",
    "html.noam-ai-engaged #noam-site-companion-panel{direction:rtl;grid-column:1;grid-row:1;position:relative;right:auto;bottom:auto;width:auto;height:auto;max-height:100dvh;border-radius:0;box-shadow:none}",
    "html.noam-ai-engaged #noam-site-companion-details{flex:1;min-height:0}",
    "@media (max-width:767px){",
    "html.noam-ai-engaged{grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(0,1fr) 40dvh}",
    "html.noam-ai-engaged body{grid-column:1;grid-row:1}",
    "html.noam-ai-engaged #noam-site-companion-panel{grid-column:1;grid-row:2;height:40dvh;max-height:40dvh;width:100%}",
    "html.noam-ai-engaged #noam-accessibility{bottom:calc(40dvh + 8px)!important}",
    "html.noam-ai-engaged .fab{inset-block-end:calc(40dvh + 8px)!important}",
    "}",
    "@media (min-width:768px){",
    "html.noam-ai-engaged #noam-accessibility{left:8px!important;right:auto!important}",
    "}",
    "@media (prefers-reduced-motion:reduce){",
    "html.noam-ai-engaged,html.noam-ai-engaged body,#noam-site-companion-panel{scroll-behavior:auto;transition:none;animation:none}",
    "}",
    "@media print{#noam-site-companion,#noam-site-companion-panel{display:none!important}html.noam-ai-engaged{display:block!important;height:auto!important;overflow:visible!important}html.noam-ai-engaged body{max-height:none!important;overflow:visible!important}}",
  ].join("");
  document.head.appendChild(style);

  var root = document.createElement("div");
  root.id = "noam-site-companion";
  root.innerHTML =
    '<button type="button" id="noam-site-companion-launch" aria-expanded="false" aria-controls="noam-site-companion-panel" aria-label="פתיחת נועם AI"><img alt="" width="32" height="32"></button>';
  document.body.appendChild(root);
  var launch = document.getElementById("noam-site-companion-launch");
  launch.querySelector("img").src = avatarSrc;

  var panel = document.createElement("section");
  panel.id = "noam-site-companion-panel";
  panel.hidden = true;
  panel.setAttribute("role", "region");
  panel.setAttribute("aria-labelledby", "noam-site-companion-title");
  panel.innerHTML =
    '<header><img alt="" width="24" height="24"><h2 id="noam-site-companion-title">נועם AI</h2>' +
    '<button type="button" id="noam-ai-expand" aria-expanded="false">הרחבה</button>' +
    '<button type="button" id="noam-ai-collapse" hidden>צמצום</button>' +
    '<button type="button" id="noam-site-companion-close" aria-label="סגירת נועם AI">×</button></header>' +
    '<p id="noam-site-companion-answer" aria-live="polite"></p>' +
    '<a id="noam-site-companion-primary" hidden></a>' +
    '<button type="button" id="noam-site-companion-ramzi" hidden>עזרה מרמזי</button>' +
    '<div id="noam-site-companion-chips" role="group" aria-label="הצעות"></div>' +
    '<button type="button" id="noam-site-companion-more" aria-expanded="false" aria-controls="noam-site-companion-details">עוד פרטים</button>' +
    '<p id="noam-site-companion-details" hidden tabindex="0"></p>' +
    '<form id="noam-site-companion-form"><label for="noam-site-companion-input" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">מה אתם מחפשים?</label>' +
    '<input id="noam-site-companion-input" type="text" maxlength="700" autocomplete="off" aria-label="מה אתם מחפשים?">' +
    '<button type="submit">שליחה</button></form>';
  root.appendChild(panel);
  panel.querySelector("header img").src = avatarSrc;

  var answerEl = document.getElementById("noam-site-companion-answer");
  var primaryEl = document.getElementById("noam-site-companion-primary");
  var ramziEl = document.getElementById("noam-site-companion-ramzi");
  var chipsEl = document.getElementById("noam-site-companion-chips");
  var moreEl = document.getElementById("noam-site-companion-more");
  var detailsEl = document.getElementById("noam-site-companion-details");
  var form = document.getElementById("noam-site-companion-form");
  var input = document.getElementById("noam-site-companion-input");
  var expandEl = document.getElementById("noam-ai-expand");
  var collapseEl = document.getElementById("noam-ai-collapse");
  var closer = document.getElementById("noam-site-companion-close");

  function ramziCoversPage() {
    if (pageKind() !== "worksheet") return false;
    var ramzi = document.getElementById("panel");
    return !!(ramzi && !ramzi.classList.contains("hidden"));
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

  function setChips(items) {
    chipsEl.textContent = "";
    (items || []).slice(0, 2).forEach(function (item) {
      if (!item || !item.href) return;
      var link = document.createElement("a");
      link.href = item.href;
      link.textContent = item.label;
      chipsEl.appendChild(link);
    });
  }

  function showIdle() {
    hasAnswer = false;
    var links = starterLinks();
    answerEl.textContent = "מה לחפש באתר?";
    primaryEl.hidden = !links[0];
    ramziEl.hidden = true;
    if (links[0]) {
      primaryEl.href = links[0].href;
      primaryEl.textContent = links[0].label;
    }
    setChips(links.slice(1, 3));
    var details = "נועם AI מכוון לדפים קיימים. עזרה בפתרון שאלה נמצאת אצל רמזי.";
    if (pageKind() === "teachers") details += "\n" + EXPORT_NOTE;
    detailsEl.textContent = details;
    moreEl.hidden = false;
  }

  function showResult(result) {
    hasAnswer = true;
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
    moreEl.hidden = !detailsEl.textContent;
  }

  function clearInline() {
    panel.style.position = "";
    panel.style.right = "";
    panel.style.bottom = "";
    panel.style.width = "";
    panel.style.height = "";
  }

  function layoutCompact() {
    if (ramziCoversPage()) return;
    document.documentElement.classList.remove("noam-ai-engaged");
    if (panel.parentNode !== root) root.appendChild(panel);
    var size = panelSize(window.innerWidth, window.innerHeight);
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
    expandEl.setAttribute("aria-expanded", "false");
  }

  function layoutEngaged() {
    if (ramziCoversPage()) return;
    clearInline();
    document.documentElement.appendChild(panel);
    document.documentElement.classList.add("noam-ai-engaged");
    expandEl.hidden = true;
    collapseEl.hidden = false;
    expandEl.setAttribute("aria-expanded", "true");
    panel.dataset.mode = "engaged";
  }

  function paintChrome() {
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
    if (mode === "compact") layoutCompact();
    if (mode === "engaged") layoutEngaged();
    if (mode === "closed") {
      document.documentElement.classList.remove("noam-ai-engaged");
      clearInline();
    }
  }

  function setMode(next) {
    mode = next;
    panel.dataset.mode = next;
    paintChrome();
  }

  function engage(reason) {
    if (mode === "closed") return;
    var keepInput = reason === "input-focus" || reason === "typing" || document.activeElement === input;
    if (mode !== "engaged") {
      panel.dataset.engageReason = reason || "";
      setMode("engaged");
    }
    if (keepInput) input.focus();
  }

  function compact() {
    setMode("compact");
    detailsEl.hidden = true;
    moreEl.setAttribute("aria-expanded", "false");
  }

  function openCompact() {
    if (!hasAnswer) showIdle();
    setMode("compact");
    expandEl.focus();
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
  ramziEl.addEventListener("click", function () {
    var fab = document.getElementById("fab");
    if (fab) fab.click();
  });
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var message = input.value.trim();
    if (!message || streaming) return;
    streaming = true;
    answerEl.textContent = "בודק בקטלוג המאומת…";
    fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: message.slice(0, 700),
        page: { kind: pageKind(), path: location.pathname + location.search, title: document.title },
        teacher: teacherContext(),
      }),
    }).then(function (response) {
      if (!response.ok) throw new Error("HTTP");
      return response.json();
    }).then(function (result) {
      streaming = false;
      showResult(result);
    }).catch(function () {
      streaming = false;
      showResult({ answer: FALLBACK, details: FALLBACK, primary: null, chips: [] });
    });
  });
  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape" || mode === "closed") return;
    event.preventDefault();
    if (mode === "engaged") compact();
    else setMode("closed");
  });
  window.addEventListener("resize", function () { if (mode === "compact") layoutCompact(); });
  window.setInterval(paintChrome, 1000);
  showIdle();
})();
