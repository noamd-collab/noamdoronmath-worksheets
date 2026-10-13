/**
 * Production site-entry gate (ndGate) — copy and behavior from live
 * www.noamdoronmath.co.il custom embed. Privacy href localized to the
 * combined accessibility+privacy page (live /privacy 301s there).
 * No invented legal text.
 */
(function () {
  var STORAGE_KEY = 'nd_gate_accepted_v1';
  var TERMS_URL = '/terms';
  var PRIVACY_URL = '/accessibilityadaptation#privacy-policy';

  try {
    if (localStorage.getItem(STORAGE_KEY)) return;
  } catch (e) {}

  function build() {
    var overlay = document.createElement('div');
    overlay.id = 'ndGateOverlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'ndGateTitle');
    overlay.setAttribute('data-site-gate', '1');
    overlay.dir = 'rtl';

    overlay.innerHTML =
      '<div class="nd-gate-box">' +
      '<h2 id="ndGateTitle">הבהרה</h2>' +
      '<p>האתר נמצא כעת בשלבי הקמה ופיתוח, וכל השירותים והתכנים המוצגים בו ניתנים <b>ללא תשלום</b>. אין לראות באמור באתר משום התחייבות סופית מצד בעלי האתר, וייתכנו שינויים בתכנים בהמשך.</p>' +
      '<p>אנו מכבדים את פרטיותכם — למידע נוסף ניתן לעיין ב<a href="' +
      PRIVACY_URL +
      '" target="_blank" rel="noopener">מדיניות הפרטיות</a> ובהצהרת הנגישות של האתר. לשאלות ובירורים ניתן ליצור קשר ישירות.</p>' +
      '<label class="nd-gate-check" for="ndGateCheck">' +
      '<input type="checkbox" id="ndGateCheck">' +
      '<span>קראתי והבנתי את ההבהרה ואת <a href="' +
      TERMS_URL +
      '" target="_blank" rel="noopener">תנאי השימוש</a> של האתר, ואני מסכים/ה להם.</span>' +
      '</label>' +
      '<button class="nd-gate-btn" id="ndGateBtn" disabled>אישור וכניסה לאתר</button>' +
      '<div class="nd-gate-foot">האישור נשמר בדפדפן זה בלבד ויוצג פעם אחת.</div>' +
      '</div>';

    document.body.appendChild(overlay);
    document.documentElement.style.overflow = 'hidden';

    var check = overlay.querySelector('#ndGateCheck');
    var btn = overlay.querySelector('#ndGateBtn');
    setTimeout(function () {
      check.focus();
    }, 350);

    check.addEventListener('change', function () {
      btn.disabled = !check.checked;
    });
    btn.addEventListener('click', function () {
      try {
        localStorage.setItem(STORAGE_KEY, new Date().toISOString());
      } catch (e) {}
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity .3s';
      document.documentElement.style.overflow = '';
      setTimeout(function () {
        overlay.remove();
      }, 300);
    });

    overlay.addEventListener('click', function (e) {
      e.stopPropagation();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && document.getElementById('ndGateOverlay')) e.preventDefault();
    });
  }

  if (document.body) build();
  else document.addEventListener('DOMContentLoaded', build);
})();
