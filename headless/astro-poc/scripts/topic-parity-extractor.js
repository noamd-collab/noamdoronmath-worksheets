/**
 * Browser-side extractor for topic parity — plain JS string for Puppeteer.
 * Supports Astro TopicPage preview markers AND Wix production rich-text DOM.
 */
export const TOPIC_PARITY_EXTRACTOR = `() => {
  const clean = (s) =>
    (s || '').replace(/[\\u200b\\u200e\\u200f\\ufeff\\u2066\\u2067\\u2068\\u2069]/g, '').replace(/\\s+/g, ' ').trim();

  const isAstro = !!document.querySelector('main.topic-page');
  if (isAstro) {
    const title = document.title || '';
    const description =
      document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
    const h1 = clean(document.querySelector('h1')?.textContent);
    const updatedLine = clean(document.querySelector('[data-updated-line]')?.textContent) || null;
    const authorEl = document.querySelector('.topic-page__author');
    const authorLine = authorEl ? clean(authorEl.textContent) : null;
    const authorAboutHref = authorEl?.querySelector('a[href*="aboutus"]')?.href || null;
    const sections = [...document.querySelectorAll('.topic-page__section')].map((sec) => ({
      heading: clean(sec.querySelector('h2')?.textContent),
      paragraphs: [...sec.querySelectorAll(':scope > p')].map((p) => clean(p.textContent)).filter((t) => t.length > 8),
      listItems: [...sec.querySelectorAll('li')].map((li) => clean(li.textContent)).filter(Boolean),
    }));
    const faqGroups = [...document.querySelectorAll('[data-faq-group]')].map((g) => ({
      heading: clean(g.querySelector('h2')?.textContent) || 'שאלות נפוצות',
      items: [...g.querySelectorAll('[data-faq-item], details.topic-page__faq-item')].map((d) => {
        const question = clean(
          d.querySelector('h3')?.textContent || d.querySelector('summary')?.textContent
        );
        const answer = clean(d.querySelector('p')?.textContent);
        return { question, answer };
      }).filter((i) => i.question && i.answer),
    }));
    const relatedLinks = [...document.querySelectorAll('.topic-page__related a')].map((a) => ({
      href: a.href,
      label: clean(a.textContent),
    }));
    const catalogCtas = [...document.querySelectorAll('a.topic-page__cta')].map((a) => ({
      href: a.href,
      label: clean(a.textContent),
    }));
    const catalogCta = catalogCtas[0] || null;
    const images = [...document.querySelectorAll('.topic-page img')].map((img) => ({
      src: img.currentSrc || img.src,
      alt: clean(img.alt),
    }));
    let jsonLdRaw = null;
    const types = [];
    const ldFaq = [];
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      try { jsonLdRaw = JSON.parse(s.textContent || ''); break; } catch (e) {}
    }
    const graph = jsonLdRaw && jsonLdRaw['@graph'] ? jsonLdRaw['@graph'] : jsonLdRaw ? [jsonLdRaw] : [];
    for (const node of graph) {
      const t = node['@type'];
      if (typeof t === 'string') types.push(t);
      if (Array.isArray(t)) types.push(...t.map(String));
      if (node['@type'] === 'FAQPage' && Array.isArray(node.mainEntity)) {
        for (const q of node.mainEntity) {
          ldFaq.push({
            question: clean(String(q.name || '')),
            answer: clean(String((q.acceptedAnswer && q.acceptedAnswer.text) || '')),
          });
        }
      }
    }
    const intro = clean(document.querySelector('.topic-page__intro')?.textContent);
    const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content') || null;
    const bodyFlow = [];
    const flowRoot = document.querySelector('[data-body-flow]');
    const pushFlowEl = (el) => {
      const kind = el.getAttribute('data-flow');
      if (kind === 'paragraph') {
        const text = clean(el.textContent);
        if (text) {
          bodyFlow.push({
            type: 'paragraph',
            text,
            role: el.getAttribute('data-role') || (el.classList.contains('topic-page__intro') ? 'intro' : 'body'),
          });
        }
        return;
      }
      if (kind === 'cta') {
        const a = el.querySelector('a.topic-page__cta') || el.querySelector('a');
        if (a) {
          bodyFlow.push({
            type: 'cta',
            label: clean(a.textContent),
            href: a.getAttribute('href') || a.href,
            catalogTopicId: a.getAttribute('data-catalog-topic')
              ? Number(a.getAttribute('data-catalog-topic'))
              : null,
          });
        }
        return;
      }
      if (kind === 'list') {
        const items = [...el.querySelectorAll('li')].map((li) => clean(li.textContent)).filter(Boolean);
        if (items.length) bodyFlow.push({ type: 'list', ordered: el.tagName === 'OL', items });
        return;
      }
      if (kind === 'heading' || el.classList.contains('topic-page__section')) {
        const text = clean(el.querySelector(':scope > h2')?.textContent || '');
        if (text) bodyFlow.push({ type: 'heading', text });
        for (const child of el.children) {
          if (child.tagName === 'H2') continue;
          pushFlowEl(child);
        }
      }
    };
    if (flowRoot) {
      for (const el of flowRoot.children) pushFlowEl(el);
    }
    return {
      title, description, h1, intro, updatedLine, authorLine, authorAboutHref,
      sections, faqGroups, relatedLinks, catalogCta, catalogCtas, images, ogImage,
      bodyFlow,
      jsonLdRaw, jsonLdTypes: types, jsonLdFaq: ldFaq,
      bodyHasSelfCheck: true,
    };
  }

  const title = document.title || '';
  const description =
    document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
  const h1 = clean(document.querySelector('h1')?.textContent);
  const bodyText = document.body.innerText || '';
  const updateMatch = bodyText.match(/נועם דורון מתמטיקה\\s*·\\s*עודכן\\s*[\\d.]+/);
  const updatedLine = updateMatch ? clean(updateMatch[0]) : null;

  let authorLine = null;
  let authorAboutHref = null;
  for (const el of document.querySelectorAll('p,div,span')) {
    const t = clean(el.textContent);
    if (t.startsWith('נכתב ונערך על ידי')) {
      authorLine = t;
      const a = el.querySelector('a[href*="aboutus"]');
      if (a) authorAboutHref = a.href;
      break;
    }
  }
  if (!authorAboutHref) {
    const a = document.querySelector('a[href*="aboutus"]');
    if (a) authorAboutHref = a.href;
  }

  const STOP_H2 = new Set([
    'שאלות נפוצות',
    'נושאים קשורים',
    'נפגשים גם בוואטסאפ',
    'מידע נוסף',
    'הבהרה',
  ]);

  const h2s = [...document.querySelectorAll('h2')];
  const richAll = [...document.querySelectorAll('[data-testid="richTextElement"]')];

  function textsBetween(hStart, hEnd) {
    const paragraphs = [];
    const listItems = [];
    for (const rt of richAll) {
      if (rt.contains(hStart)) continue;
      if (!(hStart.compareDocumentPosition(rt) & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
      if (hEnd) {
        const pos = rt.compareDocumentPosition(hEnd);
        if (!(pos & Node.DOCUMENT_POSITION_FOLLOWING) && rt !== hEnd && !hEnd.contains(rt)) continue;
      }
      for (const li of rt.querySelectorAll('li')) {
        const t = clean(li.textContent);
        if (t) listItems.push(t);
      }
      const ps = [...rt.querySelectorAll('p')];
      if (ps.length) {
        for (const p of ps) {
          const t = clean(p.textContent);
          if (
            t.length > 8 &&
            !t.includes('נועם דורון מתמטיקה · עודכן') &&
            !t.startsWith('נכתב ונערך') &&
            !STOP_H2.has(t) &&
            !paragraphs.includes(t)
          ) {
            paragraphs.push(t);
          }
        }
      } else {
        const t = clean(rt.textContent);
        if (rt.querySelector('h2,h3') && t.length < 80) continue;
        if (
          t.length > 15 &&
          !t.includes('נועם דורון מתמטיקה · עודכן') &&
          !t.startsWith('נכתב ונערך') &&
          !STOP_H2.has(t) &&
          !paragraphs.includes(t)
        ) {
          paragraphs.push(t);
        }
      }
    }
    return { paragraphs, listItems };
  }

  const sections = [];
  for (let i = 0; i < h2s.length; i++) {
    const heading = clean(h2s[i].textContent);
    if (!heading || STOP_H2.has(heading)) continue;
    const hEnd = h2s[i + 1] || null;
    const { paragraphs, listItems } = textsBetween(h2s[i], hEnd);
    const nextHeading = hEnd ? clean(hEnd.textContent) : '';
    const noise = (t) =>
      t.startsWith('מערכת צירים וקנה מידה') ||
      t.startsWith('לכל דפי כיתה') ||
      t.startsWith('חזרה לדפי') ||
      t.includes('נועם דורון מתמטיקה · עודכן');
    const paras = paragraphs.filter(
      (p) => p !== nextHeading && !STOP_H2.has(p) && !noise(p)
    );
    sections.push({ heading, paragraphs: paras, listItems });
  }

  const faqHeads = h2s.filter((h) => clean(h.textContent) === 'שאלות נפוצות');
  const faqGroups = [];
  for (let i = 0; i < faqHeads.length; i++) {
    const head = faqHeads[i];
    const nextHead = faqHeads[i + 1] || null;
    const items = [];
    for (const item of document.querySelectorAll('.ng-faq-item')) {
      if (!(head.compareDocumentPosition(item) & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
      if (nextHead) {
        if (!(item.compareDocumentPosition(nextHead) & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
      }
      const q = clean(item.querySelector('h3,summary')?.textContent);
      const a = clean(item.querySelector('p')?.textContent);
      if (q && a) items.push({ question: q, answer: a });
    }
    if (items.length === 0) {
      for (const rt of richAll) {
        if (rt.contains(head)) continue;
        if (!(head.compareDocumentPosition(rt) & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
        if (nextHead && !(rt.compareDocumentPosition(nextHead) & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
        for (const h3 of rt.querySelectorAll('h3')) {
          const q = clean(h3.textContent);
          let a = '';
          let sib = h3.nextElementSibling;
          while (sib && sib.tagName !== 'H3') {
            if (sib.tagName === 'P') { a = clean(sib.textContent); break; }
            sib = sib.nextElementSibling;
          }
          if (q.includes('?') && a) items.push({ question: q, answer: a });
        }
      }
      if (items.length === 0) {
        const { paragraphs } = textsBetween(head, nextHead);
        const blob = paragraphs.join(' ');
        if (blob.includes('?')) {
          const chunks = blob.split(/(?<=\\?)\\s+/);
          for (let ci = 0; ci < chunks.length; ) {
            const q = clean(chunks[ci]);
            if (!q.endsWith('?')) { ci++; continue; }
            let a = '';
            let cj = ci + 1;
            while (cj < chunks.length && !clean(chunks[cj]).endsWith('?')) {
              a = (a + ' ' + clean(chunks[cj])).trim();
              cj++;
            }
            if (a.length > 5) items.push({ question: q, answer: a });
            ci = Math.max(cj, ci + 1);
          }
        }
      }
    }
    if (items.length) faqGroups.push({ heading: 'שאלות נפוצות', items });
  }

  const relatedLinks = [];
  const relatedHeading = h2s.find((h) => clean(h.textContent) === 'נושאים קשורים');
  const relatedRoot =
    document.querySelector('[aria-label="נושאים קשורים"]') ||
    relatedHeading?.closest('section,nav,div') ||
    relatedHeading?.parentElement;
  if (relatedRoot) {
    for (const a of relatedRoot.querySelectorAll('a[href]')) {
      const href = a.href;
      const label = clean(a.textContent);
      if (label && href && !href.includes('aboutus') && !href.includes('github.io')) {
        relatedLinks.push({ href, label });
      }
    }
  }
  if (relatedLinks.length === 0) {
    const seen = new Set();
    for (const a of document.querySelectorAll('a[href*="-grade-"]')) {
      const href = a.href;
      const label = clean(a.textContent);
      let path = '';
      try { path = new URL(href).pathname.replace(/\\/$/, ''); } catch (e) { continue; }
      if (!label || seen.has(href)) continue;
      if (!href.includes('noamdoronmath')) continue;
      if (/\\/grade-[1-9]$/.test(path)) continue;
      if (!/-grade-[1-9]$/.test(path)) continue;
      seen.add(href);
      relatedLinks.push({ href, label });
    }
  }

  let catalogCta = null;
  // DOM order (not visual y) — production source order for multi-CTA pages
  const catalogCtas = [...document.querySelectorAll('a[href*="github.io"]')]
    .filter((a) => a.href.includes('worksheets') && a.href.includes('topic='))
    .map((a) => ({
      href: a.href,
      label: clean(a.textContent) || 'פתיחת דפי העבודה ובחירת רמה',
    }));
  if (catalogCtas.length) {
    catalogCta =
      catalogCtas.find((g) => g.label.includes('פתיחת דפי')) || catalogCtas[0];
    // Keep catalogCta as first in DOM order for multi-CTA fidelity
    catalogCta = catalogCtas[0];
  }

  const images = [];
  const seenImg = new Set();
  for (const img of document.querySelectorAll('img[src*="wixstatic"], img[src*="static.wix"]')) {
    const src = img.currentSrc || img.src;
    if (!src || seenImg.has(src)) continue;
    const w = img.naturalWidth || 0;
    if (w && w < 80) continue;
    seenImg.add(src);
    images.push({ src, alt: clean(img.alt) });
  }

  let jsonLdRaw = null;
  const types = [];
  const ldFaq = [];
  for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
    try { jsonLdRaw = JSON.parse(s.textContent || ''); break; } catch (e) {}
  }
  const graph = jsonLdRaw && jsonLdRaw['@graph'] ? jsonLdRaw['@graph'] : jsonLdRaw ? [jsonLdRaw] : [];
  for (const node of graph) {
    const t = node['@type'];
    if (typeof t === 'string') types.push(t);
    if (Array.isArray(t)) types.push(...t.map(String));
    if (node['@type'] === 'FAQPage' && Array.isArray(node.mainEntity)) {
      for (const q of node.mainEntity) {
        ldFaq.push({
          question: clean(String(q.name || '')),
          answer: clean(String((q.acceptedAnswer && q.acceptedAnswer.text) || '')),
        });
      }
    }
  }

  if (faqGroups.length === 0 && ldFaq.length) {
    const visible = ldFaq.filter((item) => bodyText.includes(item.question.slice(0, 20)));
    if (visible.length) faqGroups.push({ heading: 'שאלות נפוצות', items: visible });
  }

  let intro = '';
  const h1El = document.querySelector('h1');
  const firstH2 = document.querySelector('h2');
  const isBadIntro = (t) => {
    if (!t || t.length < 40) return true;
    if (t === h1) return true;
    if (t.includes('דלג לתוכן')) return true;
    if (t.startsWith('נכתב ונערך')) return true;
    if (t.includes('נועם דורון מתמטיקה · עודכן')) return true;
    if (t.includes('בחירת דף ורמה') && t.length < 80) return true;
    if (t.includes('פתיחת דפי העבודה') && t.length < 80) return true;
    return false;
  };
  // Prefer rich-text blocks after H1 and before first H2 (true lead paragraph).
  for (const rt of richAll) {
    if (h1El && rt.contains(h1El)) continue;
    if (h1El && !(h1El.compareDocumentPosition(rt) & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
    if (firstH2) {
      if (rt.contains(firstH2)) continue;
      if (!(rt.compareDocumentPosition(firstH2) & Node.DOCUMENT_POSITION_FOLLOWING) && rt !== firstH2) continue;
    }
    if (rt.querySelector('h2,h3')) continue;
    const t = clean(rt.textContent);
    if (!isBadIntro(t)) {
      intro = t;
      break;
    }
  }
  if (!intro) {
    const banner = h1El?.parentElement;
    if (banner) {
      for (const p of banner.querySelectorAll('p')) {
        const t = clean(p.textContent);
        if (!isBadIntro(t)) {
          intro = t;
          break;
        }
      }
    }
  }
  // Last resort: body text between h1 and first h2
  if (!intro && h1) {
    const h1Idx = bodyText.indexOf(h1);
    const h2Text = firstH2 ? clean(firstH2.textContent) : '';
    const h2Idx = h2Text ? bodyText.indexOf(h2Text, h1Idx + h1.length) : -1;
    if (h1Idx >= 0) {
      const chunk = clean(
        bodyText.slice(h1Idx + h1.length, h2Idx > h1Idx ? h2Idx : h1Idx + 500)
      );
      // take first sentence-like paragraph
      const parts = chunk.split(/\\n+/).map(clean).filter((p) => !isBadIntro(p));
      if (parts[0]) intro = parts[0];
    }
  }

  const ogImage =
    document.querySelector('meta[property="og:image"]')?.getAttribute('content') || null;

  // Ordered body flow: intro / H2 / paragraphs / worksheet CTAs until FAQ/related.
  const STOP_FLOW = new Set(['שאלות נפוצות', 'נושאים קשורים', 'כלי נגישות', 'נפגשים גם בוואטסאפ']);
  const bodyFlow = [];
  let flowStarted = false;
  let introPlaced = false;
  const allFlowNodes = [...document.querySelectorAll('h1, h2, p, a[href*="github.io"]')];
  for (const n of allFlowNodes) {
    const tag = n.tagName.toLowerCase();
    const t = clean(n.textContent);
    if (tag === 'h1') {
      flowStarted = true;
      continue;
    }
    if (!flowStarted) continue;
    if (tag === 'h2') {
      if (STOP_FLOW.has(t) || t.startsWith('נפגשים גם')) break;
      bodyFlow.push({ type: 'heading', text: t });
      continue;
    }
    if (tag === 'a' && n.href.includes('github.io') && n.href.includes('topic=') && n.href.includes('worksheets')) {
      const topicM = n.href.match(/[?&]topic=(\\d+)/);
      bodyFlow.push({
        type: 'cta',
        label: t || 'פתיחת דפי העבודה ובחירת רמה',
        href: n.href,
        catalogTopicId: topicM ? Number(topicM[1]) : null,
      });
      continue;
    }
    if (tag === 'p') {
      if (!t || t.length < 12) continue;
      if (t.startsWith('נכתב ונערך')) continue;
      if (t.includes('נועם דורון מתמטיקה · עודכן')) continue;
      if (STOP_FLOW.has(t)) break;
      let role = 'body';
      if (!introPlaced && intro && t === intro) {
        role = 'intro';
        introPlaced = true;
      } else if (!introPlaced && intro && normalizeLike(t) === normalizeLike(intro)) {
        role = 'intro';
        introPlaced = true;
      } else if (t.includes('בדקו את עצמכם')) {
        role = 'self-check';
      }
      // Skip tiny CTA-echo paragraphs
      if (t.includes('בחירת דף ורמה') && t.length < 60) continue;
      bodyFlow.push({ type: 'paragraph', text: t, role });
    }
  }
  function normalizeLike(s) {
    return clean(s).slice(0, 80);
  }
  // Ensure intro is first paragraph if missed
  if (intro && !bodyFlow.some((b) => b.type === 'paragraph' && b.role === 'intro')) {
    bodyFlow.unshift({ type: 'paragraph', text: intro, role: 'intro' });
  }

  return {
    title,
    description,
    h1,
    intro,
    updatedLine,
    authorLine,
    authorAboutHref,
    sections,
    faqGroups,
    relatedLinks,
    catalogCta,
    catalogCtas,
    images,
    ogImage,
    bodyFlow,
    jsonLdRaw,
    jsonLdTypes: types,
    jsonLdFaq: ldFaq,
    bodyHasSelfCheck: bodyText.includes('בדקו את עצמכם') || bodyText.includes('שאלת בדיקה'),
  };
}`;
