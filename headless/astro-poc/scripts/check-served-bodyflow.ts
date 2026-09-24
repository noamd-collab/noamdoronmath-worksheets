#!/usr/bin/env node
/**
 * Served DOM bodyFlow order + parity skim vs production fixtures.
 * Usage: PREVIEW=https://... npx tsx scripts/check-served-bodyflow.ts
 */
import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { TOPIC_PARITY_EXTRACTOR } from './topic-parity-extractor.js';
import {
  diffTopicParity,
  assertJsonLdFaqVisible,
  type TopicParitySnapshot,
} from '../src/lib/parity/topicParity.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fixtureDir = join(root, 'tests', 'fixtures', 'topic-parity');
const PREVIEW = (process.env.PREVIEW || '').replace(/\/$/, '');
if (!PREVIEW) {
  console.error('Set PREVIEW=...');
  process.exit(1);
}

function skim(flow: any[] = []) {
  return flow
    .filter(
      (b) =>
        b.type === 'heading' ||
        b.type === 'cta' ||
        (b.type === 'paragraph' && b.role === 'intro')
    )
    .map((b) => {
      if (b.type === 'heading') return `h2:${b.text}`;
      if (b.type === 'cta') {
        const topic = (String(b.href).match(/[?&]topic=(\d+)/) || [])[1] || '?';
        return `cta:${topic}`;
      }
      return 'intro';
    });
}

function firstCtaRelativeToPracticeH2(flow: any[] = []) {
  const practiceIdx = flow.findIndex(
    (b) => b.type === 'heading' && String(b.text || '').includes('מוכנים לתרגל')
  );
  const ctaIdx = flow.findIndex((b) => b.type === 'cta');
  return { practiceIdx, ctaIdx };
}

async function main() {
  const productionFixtures = readdirSync(fixtureDir)
    .filter((f) => f.endsWith('.production.json'))
    .map((f) => f.replace('.production.json', ''));

  // Migrated slugs = those with page modules
  const pagesDir = join(root, 'src', 'pages');
  const migrated = productionFixtures.filter((slug) =>
    existsSync(join(pagesDir, `${slug}.astro`))
  );

  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome-stable',
    headless: true,
    args: ['--no-sandbox', '--disable-gpu'],
  });

  const results: Record<string, unknown>[] = [];
  let fail = 0;

  for (const slug of migrated) {
    const page = await browser.newPage();
    page.setDefaultTimeout(90000);
    const url = `${PREVIEW}/${slug}`;
    const resp = await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });
    await new Promise((r) => setTimeout(r, 1500));
    const raw = (await page.evaluate((code: string) => {
      // eslint-disable-next-line no-eval
      return (0, eval)('(' + code + ')')();
    }, TOPIC_PARITY_EXTRACTOR)) as any;

    const served: TopicParitySnapshot = {
      slug,
      source: 'preview',
      url,
      capturedAt: new Date().toISOString(),
      httpStatus: resp?.status(),
      title: raw.title,
      description: raw.description,
      h1: raw.h1,
      intro: raw.intro || '',
      updatedLine: raw.updatedLine,
      authorLine: raw.authorLine,
      authorAboutHref: raw.authorAboutHref,
      sections: raw.sections,
      bodyFlow: raw.bodyFlow || [],
      faqGroups: raw.faqGroups,
      relatedLinks: raw.relatedLinks,
      catalogCta: raw.catalogCta,
      catalogCtas: raw.catalogCtas || [],
      images: raw.images,
      jsonLd: { types: raw.jsonLdTypes, faq: raw.jsonLdFaq },
    };

    const source = JSON.parse(
      readFileSync(join(fixtureDir, `${slug}.production.json`), 'utf8')
    ) as TopicParitySnapshot;

    // Ensure source bodyFlow exists for skim when we just captured it
    const diffs = diffTopicParity(source, served).filter((d) => {
      if (d.field === 'images' && (!source.images || source.images.length === 0)) return false;
      // Related href host may differ only in path matching — keep errors
      return d.severity === 'error';
    });
    let schemaOk = true;
    try {
      assertJsonLdFaqVisible(served, slug);
    } catch (e) {
      schemaOk = false;
      fail++;
    }

    const sSkim = skim(source.bodyFlow || []);
    const pSkim = skim(served.bodyFlow || []);
    const orderOk =
      !source.bodyFlow?.length || sSkim.join('|') === pSkim.join('|');

    let distributiveOk = true;
    if (slug === 'distributive-law-grade-9') {
      const { practiceIdx, ctaIdx } = firstCtaRelativeToPracticeH2(served.bodyFlow || []);
      distributiveOk = practiceIdx >= 0 && ctaIdx > practiceIdx;
      if (!distributiveOk) fail++;
    }

    // Paragraph self-check pages: no invented H2
    let paragraphSelfOk = true;
    if (slug === 'binomial-square-grade-9' || slug === 'difference-of-squares-grade-9') {
      const invented = (served.sections || []).some(
        (s) => (s.heading || '').trim() === 'בדקו את עצמכם'
      );
      const hasPara = (served.sections || []).some((s) =>
        (s.paragraphs || []).some((p) => p.includes('בדקו את עצמכם'))
      );
      paragraphSelfOk = !invented && hasPara;
      if (!paragraphSelfOk) fail++;
    }

    const parityErrors = diffs.length;
    if (parityErrors || !orderOk || !schemaOk || !distributiveOk || !paragraphSelfOk) {
      fail++;
    }

    results.push({
      slug,
      http: served.httpStatus,
      parityErrors,
      schemaOk,
      orderOk,
      distributiveOk: slug === 'distributive-law-grade-9' ? distributiveOk : undefined,
      paragraphSelfOk:
        slug === 'binomial-square-grade-9' || slug === 'difference-of-squares-grade-9'
          ? paragraphSelfOk
          : undefined,
      servedSkim: pSkim,
      sourceSkim: sSkim,
      diffs: diffs.slice(0, 8).map((d) => `${d.field}: ${d.message}`),
    });

    // Write preview fixture for debugging
    writeFileSync(
      join(fixtureDir, `${slug}.preview.json`),
      JSON.stringify(served, null, 2) + '\n'
    );
    await page.close();
    const status =
      parityErrors || !orderOk || !schemaOk || !distributiveOk || !paragraphSelfOk
        ? 'FAIL'
        : 'OK';
    console.log(
      `${status} ${slug} http=${served.httpStatus} parity=${parityErrors} order=${orderOk} schema=${schemaOk} skim=${pSkim.slice(0, 4).join(' → ')}`
    );
  }

  // 390px viewport for the two new pages
  for (const slug of ['binomial-square-grade-9', 'difference-of-squares-grade-9']) {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
    await page.goto(`${PREVIEW}/${slug}`, { waitUntil: 'networkidle2', timeout: 90000 });
    await new Promise((r) => setTimeout(r, 1200));
    const metrics = await page.evaluate(() => {
      const main = document.querySelector('main.topic-page');
      const h1 = document.querySelector('h1');
      const cta = document.querySelector('a.topic-page__cta');
      const self = [...document.querySelectorAll('p')].find((p) =>
        (p.textContent || '').includes('בדקו את עצמכם')
      );
      const overflow = document.documentElement.scrollWidth > window.innerWidth + 2;
      return {
        hasMain: !!main,
        h1: (h1?.textContent || '').trim().slice(0, 60),
        ctaHref: cta?.getAttribute('href') || null,
        selfCheck: (self?.textContent || '').trim().slice(0, 80),
        overflowX: overflow,
        vw: window.innerWidth,
      };
    });
    const ok =
      metrics.hasMain &&
      !!metrics.ctaHref &&
      !!metrics.selfCheck &&
      !metrics.overflowX &&
      metrics.vw === 390;
    if (!ok) fail++;
    console.log(`390px ${ok ? 'OK' : 'FAIL'} ${slug}`, JSON.stringify(metrics));
    results.push({ slug, viewport390: metrics, ok390: ok });
    await page.close();
  }

  await browser.close();
  mkdirSync('/tmp/topic-m19', { recursive: true });
  writeFileSync('/tmp/topic-m19/served-bodyflow-check.json', JSON.stringify(results, null, 2));
  console.log('\nMigrated checked:', migrated.length, 'fail-units:', fail);
  if (fail) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
