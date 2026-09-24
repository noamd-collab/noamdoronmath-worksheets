/**
 * Aboutus contact form — dry-run posts to /api/contact-form (server adapter).
 * Never enables live Wix submit from the browser.
 */
(function () {
  'use strict';
  var root = document.querySelector('[data-contact-form]');
  if (!root) return;

  var status = root.querySelector('[data-contact-status]');
  var form = root.querySelector('form');
  if (!form) return;

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var fd = new FormData(form);
    var payload = {
      firstName: String(fd.get('firstName') || '').trim(),
      lastName: String(fd.get('lastName') || '').trim(),
      email: String(fd.get('email') || '').trim(),
      message: String(fd.get('message') || '').trim(),
    };
    if (!payload.firstName || !payload.lastName || !payload.email || !payload.message) {
      if (status) {
        status.textContent = 'נא למלא את כל השדות.';
        status.dataset.state = 'error';
      }
      return;
    }
    if (status) {
      status.textContent = 'שולחים בדיקה (dry-run)…';
      status.dataset.state = 'pending';
    }
    fetch('/api/contact-form', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(function (r) {
        return r.json().then(function (j) {
          return { okHttp: r.ok, j: j };
        });
      })
      .then(function (res) {
        if (status) {
          if (res.j && res.j.ok && res.j.mode === 'dry-run') {
            status.textContent =
              'מצב בדיקה: ההודעה לא נמסרה לבעל האתר (dry-run — אין שליחה ב־Wix Forms)';
            status.dataset.state = 'dry-run';
            form.reset();
          } else {
            status.textContent = 'הבדיקה נכשלה. ניתן לפנות בדוא״ל.';
            status.dataset.state = 'error';
          }
        }
      })
      .catch(function () {
        if (status) {
          status.textContent = 'הבדיקה נכשלה. ניתן לפנות בדוא״ל.';
          status.dataset.state = 'error';
        }
      });
  });
})();
