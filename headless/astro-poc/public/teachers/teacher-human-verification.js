/* Human-operated security step. This module never executes or solves a CAPTCHA. */
export function requestTeacherHumanVerification({ challenge, client, anchor, isCurrent, onSubmitting }) {
  const failure = (code, message) => Object.assign(new Error(message), { code });
  if (!challenge || challenge.expiresAt <= Date.now() || !isCurrent()) {
    return Promise.reject(failure('BOT_CHALLENGE_EXPIRED', 'האימות פג או שהבחירה השתנתה. אפשר לבקש שוב.'));
  }
  const doc = anchor.ownerDocument;
  const win = doc.defaultView;
  const controller = new win.AbortController();
  const opener = doc.activeElement;
  const section = doc.createElement('section');
  section.className = 'teacher-human-verification';
  section.dir = 'rtl';
  section.setAttribute('role', 'region');
  section.setAttribute('aria-labelledby', 'teacher-human-verification-title');
  if (!doc.getElementById('teacher-human-verification-style')) {
    const style = doc.createElement('style');
    style.id = 'teacher-human-verification-style';
    style.textContent = '.teacher-human-verification{box-sizing:border-box;max-width:100%;margin:12px 0;padding:16px;border:2px solid #22305a;border-radius:14px;background:#fff9df;color:#22305a;overflow-wrap:anywhere}.teacher-human-verification h3{font-size:20px;margin:0 0 8px}.teacher-human-verification p{margin:8px 0}.teacher-human-verification-actions{display:flex;flex-wrap:wrap;gap:10px}.teacher-human-verification button{min-height:44px;max-width:100%;padding:10px 14px;font:inherit;white-space:normal;cursor:pointer}.teacher-human-verification-widget{max-width:100%;margin:12px 0;direction:ltr}.teacher-human-verification button:focus-visible{outline:3px solid #157e80;outline-offset:3px}';
    doc.head.append(style);
  }
  const heading = doc.createElement('h3');
  heading.id = 'teacher-human-verification-title';
  heading.textContent = 'נדרש אימות אנושי להמשך בחירת AI';
  const note = doc.createElement('p');
  note.setAttribute('role', 'status');
  note.textContent = 'הבחירה שלכם נשמרה. כדי להמשיך, פתחו והשלימו את בדיקת האבטחה.';
  const actions = doc.createElement('div');
  actions.className = 'teacher-human-verification-actions';
  const open = doc.createElement('button');
  open.type = 'button';
  open.className = 'primary';
  open.textContent = 'אימות אנושי והמשך בחירת AI';
  const cancel = doc.createElement('button');
  cancel.type = 'button';
  cancel.textContent = 'ביטול וחזרה לבחירה';
  const widget = doc.createElement('div');
  widget.className = 'teacher-human-verification-widget';
  widget.hidden = true;
  widget.tabIndex = -1;
  actions.append(open, cancel);
  section.append(heading, note, actions, widget);
  anchor.after(section);
  open.focus();
  return new Promise((resolve, reject) => {
    let done = false, started = false;
    const cleanup = () => {
      clearTimeout(expiry);
      clearInterval(contextWatch);
      controller.abort();
      const restore = section.contains(doc.activeElement);
      section.remove();
      if (restore && opener && opener.isConnected && typeof opener.focus === 'function') opener.focus();
    };
    const finish = (error, token) => {
      if (done) return;
      done = true;
      cleanup();
      if (error) reject(error); else resolve(token);
    };
    const expiry = setTimeout(() => finish(failure('BOT_CHALLENGE_EXPIRED', 'אימות האבטחה פג. הבחירה שלכם נשמרה; אפשר לבקש שוב.')), Math.max(1, challenge.expiresAt - Date.now()));
    const contextWatch = setInterval(() => {
      if (!isCurrent()) finish(failure('BOT_CHALLENGE_CONTEXT_CHANGED', 'הנושא או הבחירה השתנו. האימות בוטל והבחירה שלכם נשמרה.'));
    }, 250);
    cancel.addEventListener('click', () => finish(failure('BOT_CHALLENGE_CANCELLED', 'האימות בוטל. הבחירה שלכם נשמרה.')));
    section.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') { event.preventDefault(); cancel.click(); }
    });
    open.addEventListener('click', () => {
      if (started || done) return;
      if (!isCurrent()) { finish(failure('BOT_CHALLENGE_CONTEXT_CHANGED', 'הבחירה השתנתה. אפשר לבקש שוב.')); return; }
      started = true;
      open.disabled = true;
      widget.hidden = false;
      note.textContent = 'השלימו את בדיקת האבטחה שמופיעה כאן. אפשר לבטל ולבחור שאלות ידנית.';
      widget.focus();
      Promise.resolve().then(() => client.completeChallenge(challenge, widget, { signal: controller.signal })).then((token) => {
        if (done) return;
        if (!isCurrent()) { finish(failure('BOT_CHALLENGE_CONTEXT_CHANGED', 'הבחירה השתנתה. אפשר לבקש שוב.')); return; }
        if (challenge.expiresAt <= Date.now()) { finish(failure('BOT_CHALLENGE_EXPIRED', 'אימות האבטחה פג. אפשר לבקש שוב.')); return; }
        if (typeof onSubmitting === 'function') onSubmitting();
        finish(null, token);
      }, (error) => finish(error));
    });
  });
}
