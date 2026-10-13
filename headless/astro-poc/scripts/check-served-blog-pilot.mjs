/**
 * M25 served DOM parity for blog pilot + 390px + prior regression samples.
 * Fails when a live-visible chrome section present in the fixture is missing
 * from the served DOM (reading time, author/editor, FAQ, WhatsApp, category, recent).
 * Usage: PREVIEW_BASE=https://… node scripts/check-served-blog-pilot.mjs
 */
import puppeteer from 'puppeteer-core';
import { readdirSync, readFileSync } from 'node:fs';

const PREVIEW = (process.env.PREVIEW_BASE || '').replace(/\/$/, '');
if (!PREVIEW) {
  console.error('Set PREVIEW_BASE');
  process.exit(1);
}

const posts = readdirSync('src/data/blog-posts')
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(`src/data/blog-posts/${f}`, 'utf8')));

const LOCAL_TOPIC_PATHS = new Set(
  JSON.parse(readFileSync('reports/m27-blog/local-topic-paths.json', 'utf8'))
);

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome-stable',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu'],
});

let failures = 0;

function pathsEqual(a, b) {
  if (a === b) return true;
  try {
    return decodeURIComponent(a) === decodeURIComponent(b);
  } catch {
    return false;
  }
}

function isPilotPath(pathname, pilotPaths) {
  const norm = pathname.replace(/\/$/, '') || '/';
  return pilotPaths.some((p) => pathsEqual(p.replace(/\/$/, '') || '/', norm));
}

/** Mirror of isLocallyServedPath for served DOM checks. */
function isLocallyServedPath(pathname, pilotPaths) {
  const path = pathname.replace(/\/$/, '') || '/';
  if (isPilotPath(path, pilotPaths)) return true;
  if (
    [
      '/',
      '/aboutus',
      '/math-tools',
      '/terms',
      '/accessibilityadaptation',
      '/conditionforfreeworksheets',
      '/high-school-math',
      '/worksheets',
    ].includes(path)
  )
    return true;
  if (/^\/grade-[1-9]$/.test(path)) return true;
  if (path.startsWith('/worksheets')) return true;
  if (
    path === '/blog' ||
    path === '/blog/categories/elementary-math' ||
    path === '/blog/categories/middle-school-math' ||
    path === '/blog/categories/teachers-and-parents'
  )
    return true;
  if (path.startsWith('/post/') || path === '/blog' || path.startsWith('/blog/')) return false;
  if (LOCAL_TOPIC_PATHS.has(path)) return true;
  return false;
}

function expectChrome(post) {
  return {
    readingTime: !!post.readingTime,
    authorEditor: !!post.authorEditor?.text,
    faq: !!(post.faq?.items && post.faq.items.length > 0),
    whatsapp: !!post.whatsapp?.heading,
    postCategory: !!post.postCategory?.text,
    recentPosts: !!(post.recentPosts?.items && post.recentPosts.items.length > 0),
  };
}

async function checkPost(post) {
  const page = await browser.newPage();
  page.setDefaultTimeout(90000);
  const url = PREVIEW + post.path;
  const resp = await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });
  const status = resp?.status() ?? 0;
  if (status >= 400) {
    console.error('FAIL', post.path, 'HTTP', status);
    failures++;
    await page.close();
    return;
  }
  await new Promise((r) => setTimeout(r, 700));
  const snap = await page.evaluate(`(() => {
    const clean = (s) => (s || '').replace(/\\s+/g, ' ').trim();
    const main = document.querySelector('[data-blog-post]') || document.querySelector('main');
    const h1 = clean(main?.querySelector('h1')?.textContent || '');
    const title = document.title || '';
    const body = clean(main?.querySelector('[data-blog-body]')?.innerText || '');
    const h2s = [...(main?.querySelectorAll('[data-blog-body] h2') || [])].map((h) => clean(h.textContent || ''));
    const author = clean(main?.querySelector('[data-blog-author]')?.textContent || '');
    const readingTime = clean(main?.querySelector('[data-blog-reading-time]')?.textContent || '');
    const authorEditor = clean(main?.querySelector('[data-blog-author-editor]')?.textContent || '');
    const authorEditorAbout = main?.querySelector('[data-blog-author-editor] a[href*="aboutus"]')?.getAttribute('href') || '';
    const relatedTopics = [...(main?.querySelectorAll('[data-blog-related-topics] a') || [])].map((a) => ({
      text: clean(a.textContent || ''),
      href: a.getAttribute('href') || '',
    }));
    const faqHeading = clean(main?.querySelector('[data-blog-faq] h2')?.textContent || '');
    const faqItems = [...(main?.querySelectorAll('[data-blog-faq-item]') || [])].map((el) => ({
      question: clean(el.querySelector('h3')?.textContent || ''),
      answer: clean(el.querySelector('p')?.textContent || ''),
    }));
    const whatsappHeading = clean(main?.querySelector('[data-blog-whatsapp] h2')?.textContent || '');
    const whatsappBody = clean(main?.querySelector('[data-blog-whatsapp] p')?.textContent || '');
    const whatsappCta = main?.querySelector('[data-blog-whatsapp] a')?.getAttribute('href') || '';
    const categoryText = clean(main?.querySelector('[data-blog-category] a')?.textContent || '');
    const categoryHref = main?.querySelector('[data-blog-category] a')?.getAttribute('href') || '';
    const recentHeading = clean(main?.querySelector('[data-blog-recent] h2')?.textContent || '');
    const recentItems = [...(main?.querySelectorAll('[data-blog-recent-item]') || [])].map((el) => ({
      title: clean(el.querySelector('.blog-post__recent-body a')?.textContent || el.querySelector('a')?.textContent || ''),
      href: el.querySelector('.blog-post__recent-body a')?.getAttribute('href') || el.querySelector('a')?.getAttribute('href') || '',
      description: clean(el.querySelector('.blog-post__recent-body p')?.textContent || ''),
    }));
    const authorAvatar = {
      src: main?.querySelector('[data-blog-author-avatar]')?.getAttribute('src') || '',
      alt: main?.querySelector('[data-blog-author-avatar]')?.getAttribute('alt') || '',
    };
    const allHrefs = [...(main?.querySelectorAll('a[href]') || [])].map((a) => ({
      text: clean(a.textContent || '').slice(0, 40),
      href: a.getAttribute('href') || '',
      where: a.closest('[data-blog-recent]')
        ? 'recent'
        : a.closest('[data-blog-category]')
          ? 'category'
          : a.closest('[data-blog-whatsapp]')
            ? 'whatsapp'
            : a.closest('[data-blog-author-editor]')
              ? 'authorEditor'
              : a.closest('[data-blog-related-topics]')
                ? 'related'
                : a.closest('[data-blog-body]')
                  ? 'body'
                  : 'other',
    }));
    const hasLd = [...document.querySelectorAll('script[type="application/ld+json"]')].some((s) =>
      (s.textContent || '').includes('BlogPosting')
    );
    // Legacy generic related must not be the only stand-in for live chrome
    const legacyRelated = !!main?.querySelector('[data-blog-related]');
    return {
      h1, title, body, h2s, author, hasLd, readingTime, authorEditor, authorEditorAbout,
      relatedTopics, faqHeading, faqItems, whatsappHeading, whatsappBody, whatsappCta,
      categoryText, categoryHref, recentHeading, recentItems, legacyRelated,
      authorAvatar, allHrefs,
    };
  })()`);

  const expect = expectChrome(post);
  const issues = [];
  if (snap.h1 !== post.h1) issues.push(`h1 mismatch`);
  if (snap.title !== post.title) issues.push(`title mismatch`);
  if (snap.author && post.author && snap.author !== post.author) issues.push(`author mismatch`);
  if (!snap.hasLd) issues.push('missing BlogPosting JSON-LD');
  if (snap.legacyRelated) issues.push('legacy generic related present (not equivalent to live chrome)');

  for (const b of post.blocks) {
    if (b.type === 'h2' || b.type === 'h3') {
      if (!snap.body.includes(b.text)) issues.push(`missing ${b.type}: ${b.text.slice(0, 40)}`);
    }
    if (b.type === 'p' && b.text.length > 50) {
      if (!snap.body.includes(b.text.slice(0, 55))) issues.push(`missing para: ${b.text.slice(0, 40)}`);
    }
  }

  if (expect.readingTime) {
    if (!snap.readingTime) issues.push('missing readingTime in DOM');
    else if (snap.readingTime !== post.readingTime) issues.push(`readingTime mismatch: ${snap.readingTime}`);
  } else if (snap.readingTime) {
    issues.push('unexpected readingTime in DOM');
  }

  if (expect.authorEditor) {
    if (!snap.authorEditor) issues.push('missing authorEditor in DOM');
    else {
      if (!snap.authorEditor.includes(post.authorEditor.text.slice(0, 20))) {
        issues.push('authorEditor text mismatch');
      }
      if (post.authorEditor.aboutHref && !/aboutus/.test(snap.authorEditorAbout)) {
        issues.push('authorEditor missing /aboutus link');
      }
    }
    const expectedRelated = post.authorEditor?.relatedLinks || post.related || [];
    for (const r of expectedRelated) {
      if (!snap.relatedTopics.some((x) => x.text === r.text)) {
        issues.push(`missing related topic: ${r.text}`);
      }
    }
  }

  if (expect.faq) {
    if (!snap.faqHeading) issues.push('missing FAQ section in DOM');
    if (snap.faqItems.length !== post.faq.items.length) {
      issues.push(`FAQ count ${snap.faqItems.length} != ${post.faq.items.length}`);
    }
    for (const item of post.faq.items) {
      if (!snap.faqItems.some((x) => x.question === item.question && x.answer === item.answer)) {
        issues.push(`missing FAQ item: ${item.question.slice(0, 40)}`);
      }
    }
  } else if (snap.faqHeading || snap.faqItems.length) {
    issues.push('unexpected FAQ in DOM');
  }

  if (expect.whatsapp) {
    if (!snap.whatsappHeading) issues.push('missing WhatsApp section in DOM');
    else if (snap.whatsappHeading !== post.whatsapp.heading) issues.push('WhatsApp heading mismatch');
    if (post.whatsapp.body && !snap.whatsappBody.includes(post.whatsapp.body.slice(0, 40))) {
      issues.push('WhatsApp body missing');
    }
    if (post.whatsapp.ctaHref && !snap.whatsappCta.includes('whatsapp')) {
      issues.push('WhatsApp CTA missing');
    }
  } else if (snap.whatsappHeading) {
    issues.push('unexpected WhatsApp in DOM');
  }

  if (expect.postCategory) {
    if (!snap.categoryText) issues.push('missing postCategory in DOM');
    else if (snap.categoryText !== post.postCategory.text) {
      issues.push(`category mismatch: ${snap.categoryText}`);
    }
  } else if (snap.categoryText) {
    issues.push('unexpected postCategory in DOM');
  }

  if (expect.recentPosts) {
    if (!snap.recentHeading) issues.push('missing recentPosts section in DOM');
    if (snap.recentItems.length < Math.min(3, post.recentPosts.items.length)) {
      issues.push(`recentPosts count ${snap.recentItems.length} < expected`);
    }
    for (const item of post.recentPosts.items) {
      if (!snap.recentItems.some((x) => x.title === item.title)) {
        issues.push(`missing recent title: ${item.title.slice(0, 40)}`);
      }
      if (
        item.description &&
        !snap.recentItems.some(
          (x) => x.title === item.title && x.description.includes(item.description.slice(0, 40))
        )
      ) {
        issues.push(`missing recent desc: ${item.title.slice(0, 30)}`);
      }
    }
  } else if (snap.recentHeading || snap.recentItems.length) {
    issues.push('unexpected recentPosts in DOM');
  }

  if (post.authorAvatar?.src) {
    if (!snap.authorAvatar?.src) issues.push('missing authorAvatar in DOM');
    else if (snap.authorAvatar.alt !== post.authorAvatar.alt) {
      issues.push(`authorAvatar alt mismatch: ${snap.authorAvatar.alt}`);
    }
  }

  // Link coverage: same-site hrefs local only when route is served; else absolute prod.
  const PROD = 'https://www.noamdoronmath.co.il';
  const pilotPaths = posts.map((p) => p.path);
  for (const link of snap.allHrefs) {
    const href = link.href;
    if (!href || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('#')) continue;
    let path = '';
    let host = '';
    try {
      const u = new URL(href, PROD);
      path = u.pathname.replace(/\/$/, '') || '/';
      host = u.hostname;
    } catch {
      continue;
    }
    const isOwn =
      host === 'www.noamdoronmath.co.il' ||
      host === 'noamdoronmath.co.il' ||
      (href.startsWith('/') && !href.startsWith('//'));
    if (!isOwn) continue;

    const served = isLocallyServedPath(path, pilotPaths);
    const isLocalRel = href.startsWith('/') && !href.startsWith('//');
    const isAbsProd = href.startsWith(PROD) || href.startsWith('https://noamdoronmath.co.il');

    if (served) {
      if (!isLocalRel) {
        // Absolute to a served path is acceptable but we prefer local; only fail if it's wrong host.
        if (!isAbsProd && !isLocalRel) issues.push(`bad href ${link.where}: ${href}`);
      }
    } else {
      if (isLocalRel) {
        issues.push(`unmigrated ${link.where} href is local: ${href}`);
      } else if (!isAbsProd && (path.startsWith('/post/') || path === '/blog' || path.startsWith('/blog/'))) {
        issues.push(`unmigrated ${link.where} not on prod: ${href}`);
      }
    }
  }

  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await new Promise((r) => setTimeout(r, 250));
  const overflow = await page.evaluate(`(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }))()`);
  if (overflow.sw > overflow.cw + 2) issues.push(`390px overflow ${overflow.sw}>${overflow.cw}`);

  const hrefs = await page.evaluate(`(() =>
    [...document.querySelectorAll('[data-blog-body] a[href], [data-blog-related-topics] a[href], [data-blog-author-editor] a[href]')]
      .map((a) => a.getAttribute('href') || '')
      .filter((h) => h.startsWith('/') && !h.startsWith('//') && !h.startsWith('/post/') && !h.startsWith('/blog'))
      .slice(0, 6)
  )()`);
  for (const href of hrefs) {
    const r = await page.goto(PREVIEW + href, { waitUntil: 'domcontentloaded', timeout: 45000 });
    const st = r?.status() ?? 0;
    if (st >= 400) issues.push(`link 404 ${href}`);
  }

  if (issues.length) {
    console.error('FAIL', post.decodedSlug.slice(0, 40), issues.slice(0, 8).join(' | '));
    failures++;
  } else {
    const flags = Object.entries(expect).filter(([, v]) => v).map(([k]) => k).join(',');
    console.log('OK', post.decodedSlug.slice(0, 45), 'chrome', flags || '-');
  }
  await page.close();
}

const REGRESSION = [
  '/aboutus',
  '/terms',
  '/distributive-law-grade-9',
  '/binomial-square-grade-9',
  '/grade-7',
];

async function regress() {
  const page = await browser.newPage();
  for (const path of REGRESSION) {
    const r = await page.goto(PREVIEW + path, { waitUntil: 'networkidle2', timeout: 90000 });
    const st = r?.status() ?? 0;
    const h1 = await page.evaluate(`(() => (document.querySelector('h1')?.textContent || '').trim())()`);
    if (st >= 400 || !h1) {
      console.error('FAIL regress', path, st);
      failures++;
    } else console.log('OK regress', path);
  }
  await page.close();
}

console.log('Preview', PREVIEW, 'pilots', posts.length);
for (const p of posts) await checkPost(p);
await regress();
await browser.close();
if (failures) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log('\nAll M25 blog pilot served checks passed');
