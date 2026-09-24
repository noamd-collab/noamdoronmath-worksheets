/**
 * Shared Puppeteer in-page extractor for post chrome sections that appear
 * after the article body on live Wix blog posts.
 * Returns: readingTime, authorEditor, faq, whatsapp, category, recentPosts
 */
export const BLOG_CHROME_EXTRACTOR = `(() => {
  const clean = (s) => (s || '').replace(/\\s+/g, ' ').trim();
  const desc = document.querySelector('[data-hook="post-description"]');

  // Author avatar near byline (live AX: alt "תמונת הסופר/ת: …")
  let authorAvatar = null;
  const avatarImg = [...document.querySelectorAll('img')].find((img) => {
    const alt = clean(img.getAttribute('alt'));
    return /תמונת הסופר/.test(alt) || (/avatar|fluid-avatar/i.test(img.className || '') && alt.length > 0);
  });
  if (avatarImg) {
    const src =
      avatarImg.currentSrc ||
      avatarImg.getAttribute('src') ||
      avatarImg.getAttribute('data-src') ||
      '';
    const alt = clean(avatarImg.getAttribute('alt'));
    if (src && alt && (src.startsWith('http://') || src.startsWith('https://'))) {
      authorAvatar = { src, alt };
    }
  }

  let readingTime = null;
  for (const el of document.querySelectorAll('span, p, div, time')) {
    const t = clean(el.textContent);
    if (/^זמן קריאה\\s+\\d+/.test(t) && t.length < 40) { readingTime = t; break; }
  }

  let authorEditor = null;
  const authorCandidates = [...document.querySelectorAll('p, div')].filter((el) => {
    if (desc && desc.contains(el)) return false;
    const t = clean(el.textContent);
    return /נכתב ונערך על ידי|נכתב על ידי/.test(t) && t.length < 400;
  });
  if (authorCandidates[0]) {
    const el = authorCandidates[0];
    const about = el.querySelector('a[href*="aboutus"]');
    let relatedLinks = [];
    const scope = el.closest('section, article, div') || el.parentElement;
    for (const a of (scope?.querySelectorAll('a[href]') || [])) {
      if (desc && desc.contains(a)) continue;
      const href = a.getAttribute('href') || '';
      const text = clean(a.textContent);
      if (!text || !href) continue;
      if (/aboutus/.test(href)) continue;
      if (/facebook|twitter|whatsapp|blog\\/categories/i.test(href)) continue;
      relatedLinks.push({ text, href });
    }
    const relatedLabel = [...document.querySelectorAll('p, div, span, h2, h3')].find((n) => {
      if (desc && desc.contains(n)) return false;
      const t = clean(n.textContent);
      return t === 'נושאים קשורים' || t.startsWith('נושאים קשורים:');
    });
    if (relatedLabel) {
      const box = relatedLabel.closest('section, div') || relatedLabel.parentElement || relatedLabel;
      relatedLinks = [...box.querySelectorAll('a[href]')].map((a) => ({
        text: clean(a.textContent),
        href: a.getAttribute('href') || '',
      })).filter((x) => x.text && x.href && !/aboutus/.test(x.href));
    }
    const seen = new Set();
    relatedLinks = relatedLinks.filter((r) => {
      const k = r.href + '|' + r.text;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    authorEditor = {
      text: clean(el.textContent),
      aboutHref: about?.getAttribute('href') || null,
      aboutLabel: about ? clean(about.textContent) : null,
      relatedHeading: relatedLabel ? 'נושאים קשורים' : (relatedLinks.length ? 'נושאים קשורים' : null),
      relatedLinks,
    };
  }

  let faq = null;
  const faqH = [...document.querySelectorAll('h2')].find((h) => clean(h.textContent) === 'שאלות נפוצות');
  if (faqH) {
    const scope = faqH.closest('section') || faqH.parentElement;
    const items = [];
    const kids = [...(scope?.querySelectorAll('h2, h3, p') || [])];
    let on = false;
    for (const el of kids) {
      const t = clean(el.textContent);
      if (el.tagName === 'H2') {
        if (t === 'שאלות נפוצות') { on = true; continue; }
        if (on) break;
      }
      if (!on) continue;
      if (el.tagName === 'H3' && t) items.push({ question: t, answer: '' });
      else if (el.tagName === 'P' && items.length && !items[items.length - 1].answer) {
        items[items.length - 1].answer = t;
      }
    }
    if (items.length) faq = { heading: 'שאלות נפוצות', items };
  }

  let whatsapp = null;
  const waH = [...document.querySelectorAll('h2')].find((h) => clean(h.textContent) === 'נפגשים גם בוואטסאפ');
  if (waH) {
    const scope = waH.closest('section') || waH.parentElement;
    const body = clean(scope?.querySelector('.nw-description, p')?.textContent || '');
    const cta = scope?.querySelector('a[href*="whatsapp"], a.nw-button, a[href*="chat.whatsapp"]');
    const note = clean(scope?.querySelector('.nw-note')?.textContent || '');
    const paras = [...(scope?.querySelectorAll('p') || [])].map((p) => clean(p.textContent)).filter(Boolean);
    whatsapp = {
      heading: 'נפגשים גם בוואטסאפ',
      body: body || paras[0] || '',
      ctaLabel: cta ? clean(cta.textContent) : null,
      ctaHref: cta?.getAttribute('href') || null,
      note: note || paras.find((p) => /ההצטרפות|בלי להצטרף/.test(p)) || null,
    };
  }

  let category = null;
  const recentRoot = document.querySelector('[data-hook="recent-posts"]');
  const waY = waH?.getBoundingClientRect().bottom ?? 0;
  const recentY = recentRoot?.getBoundingClientRect().y ?? 1e9;
  // Post category chip sits between WhatsApp and recent posts. Wix may place it in a
  // <footer> landmark — still capture it; exclude only header nav + recent/body links.
  const catCands = [...document.querySelectorAll('a[href*="/blog/categories/"]')]
    .map((a) => ({
      text: clean(a.textContent),
      href: a.getAttribute('href') || '',
      y: a.getBoundingClientRect().y,
      h: a.getBoundingClientRect().height,
      inHeader: !!a.closest('header'),
      inNav: !!a.closest('nav'),
      inRecent: !!(recentRoot && recentRoot.contains(a)),
      inDesc: !!(desc && desc.contains(a)),
    }))
    .filter(
      (c) =>
        c.h > 0 &&
        c.text &&
        c.text.length <= 40 &&
        !c.inHeader &&
        !c.inNav &&
        !c.inRecent &&
        !c.inDesc &&
        c.y > waY - 20 &&
        c.y < recentY
    )
    .sort((a, b) => a.y - b.y);
  if (catCands[0]) category = { text: catCands[0].text, href: catCands[0].href };

  let recentPosts = null;
  if (recentRoot) {
    const heading = clean(recentRoot.querySelector('h2')?.textContent || 'פוסטים אחרונים');
    const viewAll = [...recentRoot.querySelectorAll('a')].find((a) => /הצג הכול/.test(clean(a.textContent)));
    const items = [];
    const seen = new Set();
    const cards = [...recentRoot.querySelectorAll('[data-hook="recent-post-list-item"]')];
    const sources = cards.length
      ? cards
      : [...recentRoot.querySelectorAll('a[href*="/post/"]')].map((a) => a.closest('article, li, section, div') || a);
    for (const card of sources) {
      const titleEl =
        card.querySelector?.('[data-hook="recent-post__title"] a') ||
        card.querySelector?.('[data-hook="recent-post__title"]') ||
        card.querySelector?.('a[href*="/post/"]') ||
        (card.matches?.('a[href*="/post/"]') ? card : null);
      const a = card.querySelector?.('a[href*="/post/"]') || (card.matches?.('a[href*="/post/"]') ? card : null);
      const title = clean(titleEl?.textContent || a?.textContent || '');
      const href = a?.getAttribute?.('href') || '';
      if (!title || title.length < 5 || /הצג הכול/.test(title) || !href) continue;
      if (seen.has(href)) continue;
      seen.add(href);
      const description = clean(
        card.querySelector?.('[data-hook="recent-post__description"]')?.textContent ||
        card.querySelector?.('[data-hook="post-description"]')?.textContent ||
        ''
      );
      const img = card.querySelector?.('img');
      items.push({
        title,
        href,
        description: description || undefined,
        imageSrc: img?.getAttribute('src') || undefined,
        imageAlt: img?.getAttribute('alt') || undefined,
      });
    }
    recentPosts = {
      heading,
      viewAllLabel: viewAll ? clean(viewAll.textContent) : null,
      viewAllHref: viewAll?.getAttribute('href') || null,
      items: items.slice(0, 3),
    };
  }

  return { readingTime, authorAvatar, authorEditor, faq, whatsapp, category, recentPosts };
})()`;
