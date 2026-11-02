/** @typedef {{ value: string, title: string, disabled: boolean, hidden: boolean }} TopicOption */
/** @typedef {{ sync: () => void, focus: () => void, close: () => void }} TopicSearchController */
/** @type {WeakMap<HTMLSelectElement, TopicSearchController>} */
const enhancements = new WeakMap();

/** @param {string} value */
function searchText(value) {
  return String(value || '').normalize('NFKD')
    .replace(/[\u0591-\u05BD\u05BF\u05C1-\u05C2\u05C4-\u05C5\u05C7]/g, '')
    .replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Enhance the existing topic select without owning its value or options.
 * The caller commits (or cancels) an explicit choice through onChoose.
 * @param {HTMLSelectElement} select
 * @param {{ onChoose: (value: string) => unknown | Promise<unknown> }} options
 * @returns {{ sync: () => void, focus: () => void, close: () => void }}
 */
export function enhanceTopicSelect(select, { onChoose }) {
  const existing = enhancements.get(select);
  if (existing) return existing;
  if (!select || !select.parentNode || typeof onChoose !== 'function') {
    throw new Error('A mounted topic select and onChoose callback are required');
  }
  const document = select.ownerDocument;
  const originallyHidden = select.hidden;
  const hadFocus = document.activeElement === select;
  const labels = [...document.querySelectorAll('label')].filter(label => label.getAttribute('for') === select.id);
  const wrapper = document.createElement('div');
  wrapper.className = 'topic-search';
  const control = document.createElement('div');
  control.className = 'topic-search-control';
  const input = document.createElement('input');
  input.id = 'topic-search';
  input.type = 'text';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.placeholder = 'חיפוש נושא';
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-haspopup', 'listbox');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-controls', 'topic-search-list');
  input.setAttribute('aria-describedby', ['topic-search-help', select.getAttribute('aria-describedby')].filter(Boolean).join(' '));
  const ariaLabel = select.getAttribute('aria-label');
  if (ariaLabel) input.setAttribute('aria-label', ariaLabel);
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'topic-search-toggle';
  toggle.textContent = '▾';
  toggle.setAttribute('aria-label', 'הצגת כל הנושאים');
  toggle.setAttribute('aria-controls', 'topic-search-list');
  toggle.setAttribute('aria-expanded', 'false');
  const popup = document.createElement('div');
  popup.className = 'topic-search-popup';
  popup.hidden = true;
  const list = document.createElement('ul');
  list.id = 'topic-search-list';
  list.className = 'topic-search-list';
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', 'נושאים');
  const empty = document.createElement('p');
  empty.className = 'topic-search-empty';
  empty.textContent = 'לא נמצאו נושאים מתאימים. אפשר לנסות מילה אחרת.';
  empty.hidden = true;
  const help = document.createElement('p');
  help.id = 'topic-search-help';
  help.className = 'topic-search-help';
  help.textContent = 'הקלידו לחיפוש או פתחו את הרשימה';
  const status = document.createElement('p');
  status.className = 'topic-search-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');
  const fallback = document.createElement('button');
  fallback.type = 'button';
  fallback.className = 'topic-search-fallback';
  fallback.textContent = 'בחירה מהרשימה הרגילה';
  control.append(input, toggle);
  popup.append(list, empty);
  wrapper.append(control, popup, help, status, fallback);

  let destroyed = false;
  let opened = false;
  let composing = false;
  let pending = false;
  let signature = '';
  /** @type {TopicOption[]} */
  let records = [];
  /** @type {TopicOption[]} */
  let matches = [];
  let activeIndex = -1;

  function current() {
    const items = [...select.querySelectorAll('option')].map(option => ({
      value: option.value,
      title: option.label || option.textContent || '',
      disabled: option.disabled || option.parentElement?.getAttribute('disabled') != null,
      hidden: option.hidden,
    }));
    return { items, value: select.value, disabled: select.disabled };
  }

  /** @param {string} text */
  function announce(text) {
    if (status.textContent !== text) status.textContent = text;
  }

  function selectedTitle() {
    return current().items.find(item => item.value === select.value)?.title || '';
  }

  function updateDisabled() {
    input.disabled = select.disabled;
    input.readOnly = pending;
    toggle.disabled = select.disabled || pending;
  }

  function close() {
    if (destroyed) return;
    opened = false;
    popup.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    activeIndex = -1;
    input.value = selectedTitle();
    announce('');
  }

  function sync() {
    if (destroyed) return;
    const state = current();
    const next = JSON.stringify(state);
    updateDisabled();
    if (next === signature) return;
    signature = next;
    records = state.items.filter(item => !item.disabled && !item.hidden);
    close();
    matches = [];
    list.replaceChildren();
    empty.hidden = true;
  }

  /** @param {number} index */
  function activate(index, scroll = true) {
    activeIndex = index;
    [...list.children].forEach((item, position) => item.setAttribute('aria-selected', String(position === index)));
    const active = list.children[index];
    if (!active) {
      input.removeAttribute('aria-activedescendant');
      return;
    }
    input.setAttribute('aria-activedescendant', active.id);
    if (scroll && list.clientHeight > 0) {
      // Move only the result list, never the page containing the wizard.
      const itemRect = active.getBoundingClientRect();
      const listRect = list.getBoundingClientRect();
      const top = itemRect.top - listRect.top - list.clientTop + list.scrollTop;
      const bottom = top + itemRect.height;
      if (top < list.scrollTop) list.scrollTop = Math.max(0, top);
      else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
    }
  }

  /** @param {boolean} all */
  function show(all) {
    if (destroyed || pending || select.disabled) return;
    const next = JSON.stringify(current());
    if (next !== signature) sync();
    const query = all ? '' : searchText(input.value);
    matches = records.filter(item => !query || searchText(item.title).includes(query));
    list.replaceChildren();
    matches.forEach((item, index) => {
      const option = document.createElement('li');
      option.id = list.id + '-' + index;
      option.dataset.index = String(index);
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', 'false');
      option.textContent = item.title;
      list.appendChild(option);
    });
    opened = true;
    popup.hidden = false;
    empty.hidden = matches.length !== 0;
    input.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-expanded', 'true');
    const selectedIndex = all ? matches.findIndex(item => item.value === select.value) : -1;
    if (selectedIndex < 0) list.scrollTop = 0;
    activate(selectedIndex);
    announce(matches.length === 1 ? 'נמצא נושא אחד.' : matches.length ? `נמצאו ${matches.length} נושאים.` : 'לא נמצאו נושאים.');
  }

  /** @param {TopicOption | undefined} item */
  async function choose(item) {
    if (destroyed || pending || !item || select.disabled) return;
    if (JSON.stringify(current()) !== signature) { sync(); return; }
    if (!records.some(record => record.value === item.value && record.title === item.title)) return;
    input.focus({ preventScroll: true });
    close();
    pending = true;
    updateDisabled();
    let failed = false;
    try {
      await onChoose(item.value);
    } catch (error) {
      failed = true;
    } finally {
      pending = false;
      if (!destroyed) {
        sync();
        close();
        updateDisabled();
        if (failed) announce('לא ניתן להשלים את בחירת הנושא. אפשר לנסות שוב.');
      }
    }
  }

  input.addEventListener('focus', () => {
    input.select();
    if (!opened) show(true);
  });
  input.addEventListener('blur', close);
  input.addEventListener('compositionstart', () => { composing = true; });
  input.addEventListener('compositionend', () => { composing = false; show(false); });
  input.addEventListener('input', event => {
    if (!composing && !('isComposing' in event && event.isComposing === true)) show(false);
  });
  input.addEventListener('keydown', event => {
    if (composing || event.isComposing || event.keyCode === 229 || pending) return;
    if (event.key === 'Tab') { close(); return; }
    if (event.key === 'Escape') {
      if (opened) event.preventDefault();
      close();
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!opened) {
        show(true);
        activate(activeIndex >= 0 ? activeIndex : event.key === 'ArrowDown' ? 0 : matches.length - 1);
      } else {
        const next = activeIndex < 0 ? (event.key === 'ArrowDown' ? 0 : matches.length - 1)
          : Math.max(0, Math.min(matches.length - 1, activeIndex + (event.key === 'ArrowDown' ? 1 : -1)));
        activate(next);
      }
      return;
    }
    if (event.key === 'Enter' && opened) {
      event.preventDefault();
      if (activeIndex >= 0) void choose(matches[activeIndex]);
    }
  });
  // Prevent mouse/synthetic touch clicks from moving DOM focus off the input.
  // No touchstart handler is cancelled, so the result list remains scrollable.
  list.addEventListener('mousedown', event => event.preventDefault());
  toggle.addEventListener('mousedown', event => event.preventDefault());
  list.addEventListener('click', event => {
    const target = /** @type {Element | null} */ (event.target);
    const option = target && typeof target.closest === 'function' ? target.closest('[role="option"]') : null;
    if (option && list.contains(option)) void choose(matches[Number(option.getAttribute('data-index'))]);
  });
  toggle.addEventListener('click', () => {
    input.value = selectedTitle();
    input.focus({ preventScroll: true });
    input.select();
    show(true);
  });

  function restoreNative() {
    if (destroyed) return;
    destroyed = true;
    wrapper.remove();
    select.hidden = originallyHidden;
    labels.forEach(label => label.setAttribute('for', select.id));
    select.removeEventListener('change', sync);
    select.focus();
  }
  fallback.addEventListener('click', restoreNative);
  const api = {
    sync,
    close,
    focus() {
      if (destroyed) { select.focus(); return; }
      input.focus();
      input.select();
    },
  };
  // All construction and event setup precede hiding the working native select.
  try {
    sync();
    select.before(wrapper);
    labels.forEach(label => label.setAttribute('for', input.id));
    select.hidden = true;
    select.addEventListener('change', sync);
    enhancements.set(select, api);
    if (hadFocus) api.focus();
    return api;
  } catch (error) {
    enhancements.delete(select);
    wrapper.remove();
    select.hidden = originallyHidden;
    labels.forEach(label => label.setAttribute('for', select.id));
    select.removeEventListener('change', sync);
    throw error;
  }
}
