/* Headless-only Claude Design adapter. Calls the viewer's existing controls;
   it never creates demo questions, AI answers, PDF URLs, or a second API. */
(() => {
  const panel = document.getElementById('panel');
  const fab = document.getElementById('fab');
  const toolbar = document.getElementById('ramziToolbar');
  const pageTab = document.getElementById('ramziPageTab');
  const helpTab = document.getElementById('ramziHelpTab');
  const close = document.getElementById('closePanel');
  const avatar = document.getElementById('ramziAvatar');
  const panelBody = document.getElementById('panelBody');
  if (!panel || !fab || !toolbar || !pageTab || !helpTab || !close || !avatar || !panelBody) return;

  const avatarBase = '/ramzi/ramzi-A-';
  const isOpen = () => !panel.classList.contains('hidden');
  const ready = () => panel.style.display !== 'none' && !fab.classList.contains('hidden') || isOpen();
  let currentMood = 'idle';

  function setMood(mood) {
    if (mood === currentMood) return;
    currentMood = mood;
    avatar.src = `${avatarBase}${mood}.svg`;
    avatar.classList.toggle('is-thinking', mood === 'thinking');
  }

  function sync() {
    const open = isOpen();
    const available = ready();
    toolbar.disabled = !available;
    helpTab.disabled = !available;
    toolbar.setAttribute('aria-expanded', String(open));
    helpTab.setAttribute('aria-current', open ? 'page' : 'false');
    pageTab.setAttribute('aria-current', open ? 'false' : 'page');

    // The real question preview can be tall. Keep the composer in view until
    // the student explicitly opens the source question.
    const context = panelBody.querySelector('.noam-picked');
    const heading = context?.querySelector('.noam-picked-heading');
    if (heading && !heading.querySelector('.ramzi-context-toggle')) {
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'ramzi-context-toggle';
      toggle.textContent = 'הצגת השאלה';
      toggle.setAttribute('aria-expanded', 'false');
      toggle.addEventListener('click', () => {
        const expanded = context.classList.toggle('ramzi-expanded');
        const preview = context.querySelector('.noam-picked-preview');
        if (preview && preview.querySelector('img')) preview.hidden = !expanded;
        toggle.textContent = expanded ? 'הסתרת השאלה' : 'הצגת השאלה';
        toggle.setAttribute('aria-expanded', String(expanded));
      });
      heading.appendChild(toggle);
    }

    const thinking = panelBody.querySelector('.noam-bubble.thinking');
    const error = panelBody.querySelector('.noam-retry-action');
    const rows = panelBody.querySelectorAll('.noam-row');
    const last = rows[rows.length - 1];
    const hints = panelBody.querySelectorAll('.noam-kind');
    const lastKind = hints[hints.length - 1];
    if (thinking) setMood('thinking');
    else if (error && last?.classList.contains('assistant')) setMood('error');
    else if (last?.classList.contains('assistant') && lastKind && /^רמז\s*\d/.test(lastKind.textContent || '')) setMood('hint');
    else setMood('idle');

    const hintButton = document.getElementById('noamHint');
    if (hintButton) {
      const text = hintButton.textContent || '';
      let label;
      if (/3 רמזים/.test(text)) {
        label = 'שלושת הרמזים נפתחו';
      } else if (/שלושת הרמזים/.test(text)) {
        label = text;
      } else {
        const n = /אחרון/.test(text) ? 3 : /נוסף/.test(text) ? 2 : 1;
        label = /^רמז \d מתוך 3$/.test(text) ? text : `רמז ${n} מתוך 3`;
      }
      if (text !== label) hintButton.textContent = label;
    }
  }

  function showHelp() {
    if (!ready()) return;
    if (!isOpen()) fab.click();
    sync();
  }
  function showPage() {
    if (isOpen()) close.click();
    sync();
  }

  toolbar.addEventListener('click', () => isOpen() ? showPage() : showHelp());
  helpTab.addEventListener('click', showHelp);
  pageTab.addEventListener('click', showPage);
  panelBody.addEventListener('click', () => queueMicrotask(sync));
  new MutationObserver(sync).observe(panel, { attributes: true, attributeFilter: ['class', 'style'] });
  new MutationObserver(sync).observe(fab, { attributes: true, attributeFilter: ['class'] });
  new MutationObserver(sync).observe(panelBody, { childList: true, subtree: true });
  sync();
})();
