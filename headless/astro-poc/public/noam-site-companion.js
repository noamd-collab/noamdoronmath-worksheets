/* Noam AI site companion. Navigation and material finding only. Not Ramzi. */
(function () {
  "use strict";
  if (window.__noamSiteCompanion) return;
  window.__noamSiteCompanion = true;

  var API = "https://amiramnoam.wixstudio.com/my-site-2/_functions/noamSiteCompanion";
  var FALLBACK = "נועם AI לא זמין כרגע. לא הצגתי הצעה מומצאת. נסו שוב בעוד רגע.";
  var EXPORT_NOTE = "סימון וחיתוך של דף המקור עדיין לא ממומשים. אין כאן ייצוא מזויף.";
  var script = document.currentScript;
  var avatarSrc = (script && script.getAttribute("data-avatar")) || "/design-exact/assets/avatar/ramzi-A-idle.svg";

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
      gradeLabel: grade && grade.selectedOptions && grade.selectedOptions[0] ? grade.selectedOptions[0].textContent.trim() : "",
      topic: value("topic"),
      topicLabel: topic && topic.selectedOptions && topic.selectedOptions[0] ? topic.selectedOptions[0].textContent.trim() : "",
      goal: goal,
      goalLabel: goals[goal] || "",
      style: style,
      styleLabel: styles[style] || "",
      note: value("teacher-note"),
    };
  }

  var style = document.createElement("style");
  style.textContent = [
    "#noam-site-companion{position:fixed;z-index:9990;right:8px;bottom:8px;left:auto;font-family:Heebo,Arial,sans-serif;color:#22305a}",
    "#noam-site-companion-launch{width:44px;height:44px;padding:0;border:2px solid #22305a;border-radius:16px 6px 18px 7px;background:#2a7c7a;color:#fff;font:800 11px/1.1 Heebo,Arial,sans-serif;box-shadow:3px 3px 0 #e6a534;cursor:pointer}",
    "#noam-site-companion-launch:focus-visible,#noam-site-companion-panel button:focus-visible,#noam-site-companion-panel a:focus-visible,#noam-site-companion-panel textarea:focus-visible{outline:3px solid #1e605e;outline-offset:2px}",
    "#noam-site-companion-panel{position:fixed;right:8px;left:auto;display:flex;flex-direction:column;overflow:hidden;background:#fbfaf5;border:2px solid #22305a;border-radius:16px 6px 18px 7px;box-shadow:3px 3px 0 #e6a534;box-sizing:border-box}",
    "#noam-site-companion-panel[hidden]{display:none!important}",
    "#noam-site-companion-panel header{display:flex;align-items:center;gap:6px;padding:4px 6px;background:#fffaf3;border-bottom:1px solid #22305a}",
    "#noam-site-companion-panel img{width:22px;height:22px;flex:none;border-radius:50%;background:#fff}",
    "#noam-site-companion-panel h2{margin:0;flex:1;min-width:0;font:800 13px/1.2 Heebo,Arial,sans-serif}",
    "#noam-site-companion-close{width:28px;height:28px;border:2px solid #22305a;border-radius:8px;background:#fff;font:800 16px/1 Heebo,Arial,sans-serif;cursor:pointer}",
    "#noam-site-companion-log{flex:1;min-height:0;overflow:auto;padding:4px 6px;font-size:12px;line-height:1.35}",
    "#noam-site-companion-log p{margin:0 0 4px}",
    "#noam-site-companion-log a{color:#1e605e;font-weight:700}",
    "#noam-site-companion-options{display:flex;flex-direction:column;gap:3px;margin:4px 0}",
    "#noam-site-companion-options button{min-height:28px;text-align:right;border:1px solid #22305a;border-radius:8px;background:#fff;color:#22305a;font:700 11px/1.2 Heebo,Arial,sans-serif;padding:3px 6px;cursor:pointer}",
    "#noam-site-companion-form{display:flex;gap:4px;padding:4px 6px 6px;border-top:1px solid rgba(34,48,90,.25)}",
    "#noam-site-companion-form textarea{flex:1;min-width:0;min-height:36px;max-height:48px;resize:none;border:1px solid #22305a;border-radius:8px;font:12px/1.3 Heebo,Arial,sans-serif;padding:4px}",
    "#noam-site-companion-form button{border:2px solid #22305a;border-radius:8px;background:#2a7c7a;color:#fff;font:800 12px Heebo,Arial,sans-serif;padding:0 8px;cursor:pointer}",
    "#noam-site-companion-export{margin:0;padding:0 6px 4px;font-size:10px;line-height:1.3;color:#22305a}",
    "@media print{#noam-site-companion{display:none!important}}",
  ].join("");
  document.head.appendChild(style);

  var root = document.createElement("div");
  root.id = "noam-site-companion";
  root.innerHTML =
    '<button type="button" id="noam-site-companion-launch" aria-expanded="false" aria-controls="noam-site-companion-panel">נועם<br>AI</button>' +
    '<section id="noam-site-companion-panel" hidden role="dialog" aria-modal="false" aria-labelledby="noam-site-companion-title">' +
    '<header><img alt="" width="22" height="22"><h2 id="noam-site-companion-title">נועם AI</h2>' +
    '<button type="button" id="noam-site-companion-close" aria-label="סגירת נועם AI">×</button></header>' +
    '<div id="noam-site-companion-log" role="log" aria-live="polite"></div>' +
    '<form id="noam-site-companion-form"><label class="noam-sr" for="noam-site-companion-input" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">מה אתם מחפשים?</label>' +
    '<textarea id="noam-site-companion-input" maxlength="700" placeholder="מה לחפש?"></textarea>' +
    '<button type="submit">שליחה</button></form>' +
    '<p id="noam-site-companion-export" hidden></p></section>';
  document.body.appendChild(root);

  var launch = document.getElementById("noam-site-companion-launch");
  var panel = document.getElementById("noam-site-companion-panel");
  var log = document.getElementById("noam-site-companion-log");
  var form = document.getElementById("noam-site-companion-form");
  var input = document.getElementById("noam-site-companion-input");
  var closer = document.getElementById("noam-site-companion-close");
  var exportNote = document.getElementById("noam-site-companion-export");
  var avatar = panel.querySelector("img");
  avatar.src = avatarSrc;
  var openedOnce = false;
  var busy = false;

  function ramziCoversPage() {
    if (pageKind() !== "worksheet") return false;
    var ramzi = document.getElementById("panel");
    if (!ramzi) return false;
    return !ramzi.classList.contains("hidden") && ramzi.getAttribute("hidden") === null;
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

  function layout() {
    var hide = ramziCoversPage();
    root.hidden = hide;
    if (hide) return;
    var size = panelSize(window.innerWidth, window.innerHeight);
    var bottom = lift();
    var avail = window.innerHeight - bottom - 8;
    var height = Math.min(size.height, Math.max(72, avail));
    if (size.width * height > size.maxArea) height = Math.floor(size.maxArea / size.width);
    panel.style.width = size.width + "px";
    panel.style.height = height + "px";
    panel.style.bottom = bottom + "px";
    root.style.bottom = bottom + "px";
    panel.dataset.width = String(size.width);
    panel.dataset.height = String(height);
    panel.dataset.area = String(size.width * height);
    panel.dataset.maxArea = String(Math.floor(size.maxArea));
  }

  function addText(text) {
    var p = document.createElement("p");
    p.textContent = text;
    log.appendChild(p);
    log.scrollTop = log.scrollHeight;
  }

  function addOptions(options) {
    if (!options || !options.length) return;
    var wrap = document.createElement("div");
    wrap.id = "noam-site-companion-options";
    wrap.className = "noam-site-companion-options";
    options.forEach(function (option) {
      var button = document.createElement("button");
      button.type = "button";
      button.textContent = option.label;
      button.addEventListener("click", function () {
        if (option.other) {
          input.focus();
          return;
        }
        ask(option.label, option.id);
      });
      wrap.appendChild(button);
    });
    var other = document.createElement("button");
    other.type = "button";
    other.textContent = "אחר";
    other.addEventListener("click", function () { input.focus(); });
    wrap.appendChild(other);
    log.appendChild(wrap);
  }

  function addLinks(links) {
    (links || []).forEach(function (link) {
      if (!link || !link.href) return;
      var p = document.createElement("p");
      var a = document.createElement("a");
      a.href = link.href;
      a.textContent = link.title || link.href;
      p.appendChild(a);
      log.appendChild(p);
    });
  }

  function paint(result) {
    log.textContent = "";
    addText((result && result.text) || FALLBACK);
    if (result && result.linkNote) addText(result.linkNote);
    addOptions(result && result.options);
    addLinks(result && result.links);
    if (result && result.essentialNote) addText(result.essentialNote);
    if (pageKind() === "teachers") {
      exportNote.hidden = false;
      exportNote.textContent = (result && result.exportNote) || EXPORT_NOTE;
    } else {
      exportNote.hidden = true;
    }
  }

  function payload(message, choiceId) {
    return {
      message: String(message || "").slice(0, 700),
      choiceId: choiceId || "",
      page: { kind: pageKind(), path: location.pathname + location.search, title: document.title },
      teacher: teacherContext(),
    };
  }

  function ask(message, choiceId) {
    if (busy) return;
    busy = true;
    addText("נועם AI בודק את הקטלוג המאומת…");
    fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload(message, choiceId)),
    }).then(function (response) {
      if (!response.ok) throw new Error("HTTP");
      return response.json();
    }).then(function (result) {
      busy = false;
      paint(result);
    }).catch(function () {
      busy = false;
      paint({ ok: false, source: "fallback", text: FALLBACK, options: [], links: [] });
    });
  }

  function openPanel() {
    layout();
    panel.hidden = false;
    launch.hidden = true;
    launch.setAttribute("aria-expanded", "true");
    if (pageKind() === "teachers") {
      exportNote.hidden = false;
      exportNote.textContent = EXPORT_NOTE;
    }
    if (!openedOnce) {
      openedOnce = true;
      if (pageKind() === "teachers") ask(teacherContext() && teacherContext().note, "");
      else addText("מה לחפש באתר? אכתוב איפה ללחוץ ואביא קישור מדף קיים.");
    }
    input.focus();
  }

  function closePanel() {
    panel.hidden = true;
    launch.hidden = false;
    launch.setAttribute("aria-expanded", "false");
    launch.focus();
  }

  launch.addEventListener("click", openPanel);
  closer.addEventListener("click", closePanel);
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var message = input.value.trim();
    if (!message) return;
    input.value = "";
    ask(message, "");
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !panel.hidden) {
      event.preventDefault();
      closePanel();
    }
  });
  window.addEventListener("resize", layout);
  layout();
  window.setInterval(layout, 1000);
})();
